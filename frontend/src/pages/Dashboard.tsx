import { useMemo, useState } from 'react';
import { fmtViews } from '../lib/format';
import { api, fmtDate } from '../lib/api';
import type { Story } from '../types';
import { Link } from '../lib/router';
import { Icon, type IconName } from '../components/Icon';
import { MiniStoryCard, STATUS_TABS, countBy, filterStories, type StatusFilter } from '../components/MyStories';
import { Confirm, Empty, ErrorBox, Modal, Spinner, useAsync } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

function Stat({ icon, n, label, tone, to }: { icon: IconName; n: number; label: string; tone: string; to?: string }) {
  const body = <><span className="stat-ic"><Icon name={icon} size={20} /></span><div><b>{n}</b><small>{label}</small></div></>;
  return to ? <Link to={to} className={`stat stat-${tone} stat-link`}>{body}</Link> : <div className={`stat stat-${tone}`}>{body}</div>;
}

interface Draft { title?: string; region?: string; province?: string; category?: string; short_description?: string; full_story?: string; image_url?: string }
const DRAFT_KEY = 'crn-draft-new';
const readDraft = (): Draft | null => { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'); return d && (d.title || d.full_story) ? d : null; } catch { return null; } };

/** Draf yang belum dikirim (tersimpan di perangkat): bisa dilihat lagi, dilanjutkan, atau diunduh. */
function LocalDraft({ author }: { author: string }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(readDraft);
  const [view, setView] = useState(false);
  const [del, setDel] = useState(false);
  if (!draft) return null;
  const words = (draft.full_story ?? '').trim().split(/\s+/).filter(Boolean).length;
  const data = { title: draft.title || 'Cerita tanpa judul', region: draft.region || '-', province: draft.province || '-', category: draft.category || '-', author, short_description: draft.short_description ?? '', full_story: draft.full_story ?? '', image_url: draft.image_url || null };
  return (
    <section className="section-sm">
      <div className="section-head"><h2><Icon name="pencil" size={20} />Draf belum dikirim</h2></div>
      <article className="draft-card">
        <div className="draft-ic"><Icon name="file" size={22} /></div>
        <div className="draft-main">
          <span className="badge st-pending"><Icon name="save" size={12} />Tersimpan di perangkat ini</span>
          <h3>{data.title}</h3>
          <p className="muted">{(draft.full_story ?? '').trim().slice(0, 140) || 'Belum ada isi.'}{(draft.full_story ?? '').length > 140 ? '…' : ''}</p>
          <small className="muted">{words} kata{draft.category ? ` · ${draft.category}` : ''}{draft.region ? ` · ${draft.region}` : ''}</small>
        </div>
        <div className="card-actions draft-actions">
          <Link to="/tambah" className="btn btn-primary btn-xs"><Icon name="pencil" size={14} />Lanjutkan menulis</Link>
          <button className="btn btn-outline btn-xs" onClick={() => setView(true)}><Icon name="eye" size={14} />Lihat</button>
          <button className="btn btn-outline-danger btn-xs" onClick={() => setDel(true)}><Icon name="trash" size={14} />Buang</button>
        </div>
      </article>
      {view && (
        <Modal title={data.title} onClose={() => setView(false)} wide>
          <div className="draft-read">{data.full_story.split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}{!data.full_story && <p className="muted">Belum ada isi.</p>}</div>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setView(false)}>Tutup</button><Link to="/tambah" className="btn btn-primary" onClick={() => setView(false)}>Lanjutkan menulis</Link></div>
        </Modal>
      )}
      {del && <Confirm title="Buang draf ini?" message="Draf yang belum dikirim akan dihapus dari perangkat ini dan tidak bisa dikembalikan." confirmLabel="Buang draf" danger onClose={() => setDel(false)}
        onConfirm={() => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ } setDraft(null); setDel(false); toast('Draf dibuang.'); }} />}
    </section>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const mine = useAsync(() => api.get<{ stories: Story[] }>('my/stories'), []);
  const favs = useAsync(() => api.get<{ stories: Story[] }>('favorites'), []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const stories = mine.data?.stories ?? [];
  const counts = useMemo(() => countBy(stories), [stories]);
  const totalViews = useMemo(() => stories.reduce((n, x) => n + (x.views ?? 0), 0), [stories]);
  const MAX = 6;
  const matched = useMemo(() => filterStories(stories, { q, status }), [stories, q, status]);
  const shown = matched.slice(0, MAX);

  return (
    <div className="container page">
      <div className="page-head page-head-row">
        <div><h1>Dashboard saya</h1><p className="muted">Halo, {user?.name}. Pantau status cerita yang kamu kirim.</p></div>
        <Link to="/profil" className="btn btn-outline btn-sm"><Icon name="user" size={15} />Profil dan password</Link>
      </div>
      <div className="stats">
        <Stat icon="book" n={stories.length} label="Total cerita" tone="brand" to="/cerita-saya" />
        <Stat icon="clock" n={counts.pending} label="Menunggu" tone="amber" to="/cerita-saya?status=pending" />
        <Stat icon="check" n={counts.approved + counts.published} label="Disetujui" tone="green" to="/cerita-saya?status=approved" />
        <Stat icon="x" n={counts.rejected} label="Ditolak" tone="red" to="/cerita-saya?status=rejected" />
        <Stat icon="heart" n={favs.data?.stories.length ?? 0} label="Favorit" tone="rose" to="/favorit" />
      </div>
      <Link to="/tambah" className="btn btn-primary"><Icon name="plus" size={16} />Tambah cerita baru</Link>

      <LocalDraft author={user?.name ?? 'Penulis'} />

      <section className="section-sm" id="cerita-saya">
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <h2><Icon name="book" size={20} />Tulisan saya</h2>
              {stories.length > 0 && <p className="muted">{stories.length} cerita · <b>{fmtViews(totalViews)}</b> total pembaca</p>}
            </div>
          </div>
          {mine.loading && !mine.data && <Spinner />}
          {mine.error && <ErrorBox message={mine.error} onRetry={mine.reload} />}
          {mine.data && stories.length === 0 && <Empty title="Belum ada cerita" action={<Link to="/tambah" className="btn btn-primary">Tulis cerita pertamamu</Link>}>Kirim cerita rakyat dari daerahmu. Admin akan meninjau dan menerbitkannya sebagai buku.</Empty>}
          {stories.length > 0 && (
            <>
              <div className="mini-tools">
                <label className="input-ic"><Icon name="search" size={16} /><input type="search" placeholder="Cari tulisanmu…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari tulisan saya" /></label>
                <div className="chips-row" role="tablist" aria-label="Status tulisan">
                  {STATUS_TABS.map((t) => (
                    <button key={t.v} role="tab" aria-selected={status === t.v} className={`chip-btn ${status === t.v ? 'on' : ''}`} onClick={() => setStatus(t.v)}>{t.l} <em className="cnt">{counts[t.v]}</em></button>
                  ))}
                </div>
              </div>
              {matched.length === 0
                ? <Empty icon="search" title="Tidak ada tulisan yang cocok" action={<button className="btn btn-outline" onClick={() => { setQ(''); setStatus('all'); }}>Hapus filter</button>}>Coba kata kunci atau status lain.</Empty>
                : <div className="mini-grid">{shown.map((s) => <MiniStoryCard key={s.id} s={s} />)}</div>}
              <div className="dash-panel-foot">
                <span className="muted">{matched.length > MAX ? `Menampilkan ${MAX} dari ${matched.length} cerita` : `${matched.length} cerita`}</span>
                <Link to={status === 'all' ? '/cerita-saya' : `/cerita-saya?status=${status}`} className="btn btn-primary btn-sm">Lanjut, lihat semua<Icon name="right" size={15} /></Link>
              </div>
            </>
          )}
        </div>
      </section>

      <Link to="/favorit" className="fav-strip">
        <Icon name="heart" size={16} /><span>{favs.data ? (favs.data.stories.length ? `${favs.data.stories.length} cerita favorit tersimpan` : 'Belum ada cerita favorit') : 'Cerita favorit'}</span><b>Lihat semua<Icon name="right" size={14} /></b>
      </Link>

    </div>
  );
}
