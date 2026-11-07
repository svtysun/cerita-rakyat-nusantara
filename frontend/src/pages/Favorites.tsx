import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Notif, Story } from '../types';
import { Link, navigate } from '../lib/router';
import { Icon } from '../components/Icon';
import { StoryCard } from '../components/StoryCard';
import { Empty, ErrorBox, Spinner, useAsync } from '../components/ui';
import { useAuth } from '../lib/auth';
import { NotifItem } from '../components/Notifications';

const CAT_ORDER = ['Legenda', 'Fabel', 'Dongeng', 'Mitos'];
const CAT_INFO: Record<string, string> = { Legenda: 'Kisah asal-usul tempat dan peristiwa', Fabel: 'Cerita hewan penuh pelajaran', Dongeng: 'Cerita khayal turun-temurun', Mitos: 'Kepercayaan dan kisah kuno' };

/** Favorit dipisah per jenis (kategori): ada chip penyaring dan bagian per jenis. */
export function FavGroups({ stories, onChange }: { stories: Story[]; onChange: () => void }) {
  const [sel, setSel] = useState('Semua');
  const [q, setQ] = useState('');
  const [prov, setProv] = useState('');
  const provinces = useMemo(() => [...new Set(stories.map((s) => s.province).filter(Boolean))].sort(), [stories]);
  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => stories.filter((s) => (!prov || s.province === prov) && (!term || `${s.title} ${s.short_description} ${s.region} ${s.province}`.toLowerCase().includes(term))), [stories, prov, term]);
  const groups = useMemo(() => {
    const m = new Map<string, Story[]>();
    for (const s of filtered) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()].sort((a, b) => (CAT_ORDER.indexOf(a[0]) + 1 || 99) - (CAT_ORDER.indexOf(b[0]) + 1 || 99));
  }, [filtered]);
  const active = sel === 'Semua' || groups.some(([c]) => c === sel) ? sel : 'Semua';
  if (stories.length === 0) return null;
  return (
    <div className="fav-groups">
      <div className="filter-bar fav-filter" role="search">
        <label className="input-ic"><Icon name="search" size={16} /><input type="search" placeholder="Cari di cerita favorit…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari cerita favorit" /></label>
        <select value={prov} onChange={(e) => setProv(e.target.value)} aria-label="Filter pulau"><option value="">Semua pulau</option>{provinces.map((p) => <option key={p}>{p}</option>)}</select>
      </div>
      <div className="chips-row" role="tablist" aria-label="Jenis cerita favorit">
        <button role="tab" aria-selected={active === 'Semua'} className={`chip-btn ${active === 'Semua' ? 'on' : ''}`} onClick={() => setSel('Semua')}>Semua <em className="cnt">{filtered.length}</em></button>
        {groups.map(([c, l]) => <button key={c} role="tab" aria-selected={active === c} className={`chip-btn ${active === c ? 'on' : ''}`} onClick={() => setSel(c)}>{c} <em className="cnt">{l.length}</em></button>)}
      </div>
      {filtered.length === 0 && <Empty icon="search" title="Tidak ada favorit yang cocok" action={<button className="btn btn-outline" onClick={() => { setQ(''); setProv(''); }}>Hapus filter</button>}>Coba kata kunci atau pulau lain.</Empty>}
      {groups.filter(([c]) => active === 'Semua' || c === active).map(([c, l]) => (
        <section key={c} className="fav-group">
          <div className="fav-group-head"><h3>{c}</h3><span className="muted">{l.length} cerita{CAT_INFO[c] ? ` · ${CAT_INFO[c]}` : ''}</span></div>
          <div className="grid-cards">{l.map((s) => <StoryCard key={s.id} story={s} onFavChange={onChange} />)}</div>
        </section>
      ))}
    </div>
  );
}

export function Favorites() {
  const { data, loading, error, reload } = useAsync(() => api.get<{ stories: Story[] }>('favorites'), []);
  return (
    <div className="container page">
      <div className="page-head"><h1><Icon name="heart" size={26} fill style={{ color: 'var(--rose)' }} /> Cerita favorit</h1><p className="muted">Cerita yang kamu simpan, dipisah menurut jenisnya.</p></div>
      {loading && !data && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.stories.length === 0 && <Empty icon="heart" title="Belum ada cerita favorit" action={<Link to="/cerita" className="btn btn-primary">Jelajahi cerita</Link>}>Ketuk ikon hati pada sebuah cerita untuk menyimpannya di sini.</Empty>}
      {data && <FavGroups stories={data.stories} onChange={reload} />}
    </div>
  );
}

export function Notifications({ admin = false }: { admin?: boolean }) {
  const { refreshUnread } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get<{ notifications: Notif[]; unread: number }>('notifications'), []);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [nq, setNq] = useState('');
  const markRead = async () => { await api.post('notifications/read'); reload(); refreshUnread(); };
  const open = async (n: Notif) => {
    if (!n.is_read) { await api.post(`notifications/${n.id}/read`).catch(() => {}); refreshUnread(); reload(); }
    navigate(admin ? (n.type === 'request' ? '/admin/permintaan' : '/admin/cerita') : '/dashboard');
  };
  const nterm = nq.trim().toLowerCase();
  const list = (data?.notifications ?? []).filter((n) => (filter === 'all' || !n.is_read) && (!nterm || n.message.toLowerCase().includes(nterm)));
  return (
    <div className={admin ? '' : 'container page narrow'}>
      <div className="page-head row-between">
        <div>{admin ? null : <h1>Notifikasi</h1>}<p className="muted">{admin ? 'Cerita masuk dan permintaan penulis.' : 'Kabar terbaru tentang ceritamu.'}</p></div>
        <div className="row-gap">
          <div className="seg seg-sm" style={{ margin: 0 }}><button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Semua</button><button className={filter === 'unread' ? 'on' : ''} onClick={() => setFilter('unread')}>Belum dibaca{(data?.unread ?? 0) > 0 ? ` (${data!.unread})` : ''}</button></div>
          {(data?.unread ?? 0) > 0 && <button className="btn btn-outline btn-sm" onClick={markRead}>Tandai semua dibaca</button>}
        </div>
      </div>
      {data && data.notifications.length > 0 && <label className="input-ic notif-search"><Icon name="search" size={16} /><input type="search" placeholder="Cari notifikasi…" value={nq} onChange={(e) => setNq(e.target.value)} aria-label="Cari notifikasi" /></label>}
      {loading && !data && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && list.length === 0 && nterm && <Empty icon="search" title="Notifikasi tidak ditemukan">Coba kata kunci lain.</Empty>}
      {data && list.length === 0 && !nterm && <Empty icon="bell" title={filter === 'unread' ? 'Semua sudah dibaca' : 'Belum ada notifikasi'}>{admin ? 'Notifikasi muncul saat ada cerita atau permintaan baru dari penulis.' : 'Notifikasi muncul saat admin menyetujui, menolak, atau menerbitkan ceritamu.'}</Empty>}
      <div className="ni-list ni-page">{list.map((n) => <NotifItem key={n.id} n={n} onClick={() => open(n)} />)}</div>
    </div>
  );
}
