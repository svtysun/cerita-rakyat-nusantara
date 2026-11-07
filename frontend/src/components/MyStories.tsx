import { useState, type ReactNode } from 'react';
import { api, fmtDate } from '../lib/api';
import type { Story, StoryStatus } from '../types';
import { Link } from '../lib/router';
import { Icon } from './Icon';
import { fmtViews } from '../lib/format';
import { Confirm, Cover, Modal, StatusBadge } from './ui';
import { useToast } from '../lib/toast';

export type StatusFilter = 'all' | StoryStatus;
export type SortKey = 'new' | 'old' | 'az' | 'views';

export const STATUS_TABS: { v: StatusFilter; l: string }[] = [
  { v: 'all', l: 'Semua' },
  { v: 'pending', l: 'Menunggu' },
  { v: 'approved', l: 'Disetujui' },
  { v: 'published', l: 'Terbit' },
  { v: 'rejected', l: 'Ditolak' },
];

export const SORTS: { v: SortKey; l: string }[] = [
  { v: 'new', l: 'Terbaru diperbarui' },
  { v: 'old', l: 'Terlama' },
  { v: 'az', l: 'Judul A–Z' },
  { v: 'views', l: 'Terbanyak dibaca' },
];

export const isStatusFilter = (v: string | null): v is StatusFilter => !!v && STATUS_TABS.some((t) => t.v === v);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filterStories(list: Story[], o: { q?: string; status?: StatusFilter; category?: string; province?: string; sort?: SortKey }): Story[] {
  const q = norm((o.q ?? '').trim());
  const out = list.filter((s) => {
    if (o.status && o.status !== 'all' && s.status !== o.status) return false;
    if (o.category && s.category !== o.category) return false;
    if (o.province && s.province !== o.province) return false;
    if (q && !norm(`${s.title} ${s.short_description} ${s.region} ${s.province} ${s.category}`).includes(q)) return false;
    return true;
  });
  const t = (s: Story) => Date.parse((s.updated_at || s.created_at || '').replace(' ', 'T')) || 0;
  switch (o.sort ?? 'new') {
    case 'old': return out.sort((a, b) => t(a) - t(b));
    case 'az': return out.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    case 'views': return out.sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || t(b) - t(a));
    default: return out.sort((a, b) => t(b) - t(a));
  }
}

export const countBy = (list: Story[]) => ({
  all: list.length,
  pending: list.filter((s) => s.status === 'pending').length,
  approved: list.filter((s) => s.status === 'approved').length,
  published: list.filter((s) => s.status === 'published').length,
  rejected: list.filter((s) => s.status === 'rejected').length,
});

export function Progress({ status }: { status: Story['status'] }) {
  const steps = ['Terkirim', 'Disetujui', 'Didesain admin', 'Terbit'];
  const at = status === 'pending' ? 0 : status === 'approved' ? 2 : status === 'published' ? 3 : 0;
  const done = status === 'published' ? 4 : status === 'approved' ? 2 : status === 'pending' ? 1 : 0;
  return (
    <ol className={`progress ${status === 'rejected' ? 'is-rejected' : ''}`} aria-label="Tahap cerita">
      {steps.map((l, i) => <li key={l} className={i < done ? 'done' : i === at && status !== 'rejected' ? 'now' : ''}><span />{l}</li>)}
    </ol>
  );
}

/** Aksi hapus / ajukan edit / ajukan hapus beserta dialognya, dipakai di halaman Cerita saya dan Dashboard. */
export function useStoryActions(onChanged: () => void) {
  const toast = useToast();
  const [del, setDel] = useState<Story | null>(null);
  const [req, setReq] = useState<{ story: Story; type: 'edit' | 'delete' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const sendReq = async () => {
    if (!req) return;
    setBusy(true);
    try { await api.post(`stories/${req.story.id}/requests`, { type: req.type, reason }); toast('Permintaan terkirim ke admin.'); setReq(null); setReason(''); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const actions = { askDelete: setDel, askRequest: (story: Story, type: 'edit' | 'delete') => setReq({ story, type }) };
  const dialogs: ReactNode = (
    <>
      {del && <Confirm title="Hapus cerita?" message={`Cerita "${del.title}" akan dihapus permanen.`} confirmLabel="Hapus" danger onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.del('stories/' + del.id); toast('Cerita dihapus.'); setDel(null); onChanged(); } catch (e: any) { toast(e.message, 'err'); } }} />}
      {req && (
        <Modal title={req.type === 'edit' ? 'Ajukan perubahan cerita' : 'Ajukan penghapusan cerita'} onClose={() => setReq(null)}>
          <p className="muted">Cerita "{req.story.title}" sudah disetujui, jadi perubahannya perlu ditinjau admin.</p>
          <label className="field"><span>Alasan</span><textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan apa yang ingin diubah atau mengapa dihapus" /></label>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setReq(null)}>Batal</button><button className="btn btn-primary" disabled={busy || reason.trim().length < 5} onClick={sendReq}>Kirim permintaan</button></div>
        </Modal>
      )}
    </>
  );
  return { actions, dialogs };
}

type Actions = ReturnType<typeof useStoryActions>['actions'];

/** Kartu lengkap (halaman Cerita saya). */
export function MyStoryCard({ s, actions }: { s: Story; actions: Actions }) {
  const direct = s.status === 'pending' || s.status === 'rejected';
  return (
    <article className="card my-card">
      <div className="sc-img"><Cover src={s.image_url} alt={`Sampul ${s.title}`} province={s.province} title={s.title} /><span className="chip chip-cat">{s.category}</span></div>
      <div className="sc-body">
        <StatusBadge status={s.status} />
        <h3>{s.title}</h3>
        <small className="muted my-meta"><Icon name="pin" size={12} />{s.region || s.province} · Diperbarui {fmtDate(s.updated_at || s.created_at)}</small>
        <Progress status={s.status} />
        <p className="sc-desc">{s.short_description}</p>
        {s.status === 'published' && <p className="sc-stat-inline"><Icon name="eye" size={13} />{fmtViews(s.views)} pembaca</p>}
        {s.status === 'rejected' && s.reject_reason && <p className="reject-note"><Icon name="alert" size={14} />{s.reject_reason}</p>}
        <div className="card-actions">
          <Link to={`/cerita/${s.id}`} className="btn btn-outline btn-xs"><Icon name="eye" size={14} />Lihat</Link>
          {direct
            ? <Link to={`/cerita/${s.id}/edit`} className="btn btn-outline btn-xs"><Icon name="pencil" size={14} />Edit</Link>
            : <button className="btn btn-outline btn-xs" onClick={() => actions.askRequest(s, 'edit')}><Icon name="pencil" size={14} />Ajukan edit</button>}
          <button className="btn btn-outline-danger btn-xs" onClick={() => (direct ? actions.askDelete(s) : actions.askRequest(s, 'delete'))}><Icon name="trash" size={14} />{direct ? 'Hapus' : 'Ajukan hapus'}</button>
        </div>
      </div>
    </article>
  );
}

/** Kartu kecil (Dashboard): sampul mungil, judul, status, kategori, tanggal, jumlah pembaca, dan tombol Lanjut. */
export function MiniStoryCard({ s }: { s: Story }) {
  return (
    <Link to={`/cerita/${s.id}`} className="mini-card" title={s.title}>
      <span className="mini-cover"><Cover src={s.image_url} alt="" province={s.province} title={s.title} /></span>
      <span className="mini-body">
        <StatusBadge status={s.status} />
        <b className="mini-title">{s.title}</b>
        <small className="muted">{s.category} · {fmtDate(s.updated_at || s.created_at)}</small>
        <span className="mini-foot">
          <span className="mini-views" title="Jumlah pembaca"><Icon name="eye" size={14} /><b>{fmtViews(s.views)}</b> pembaca</span>
          <span className="mini-go">Lanjut<Icon name="right" size={13} /></span>
        </span>
      </span>
    </Link>
  );
}
