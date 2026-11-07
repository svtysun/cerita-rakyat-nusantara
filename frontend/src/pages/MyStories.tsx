import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Story } from '../types';
import { Link, useLocation } from '../lib/router';
import { Icon } from '../components/Icon';
import { Empty, ErrorBox, Spinner, useAsync, useAutoRefresh } from '../components/ui';
import { MyStoryCard, SORTS, STATUS_TABS, countBy, filterStories, isStatusFilter, useStoryActions, type SortKey, type StatusFilter } from '../components/MyStories';

/** Halaman "Cerita saya": semua tulisan milik pengguna, lengkap dengan pencarian, filter, dan urutan. */
export function MyStories() {
  const { query } = useLocation();
  const mine = useAsync(() => api.get<{ stories: Story[] }>('my/stories'), []);
  useAutoRefresh(() => mine.refresh());
  const { actions, dialogs } = useStoryActions(mine.reload);

  const initStatus = query.get('status');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>(isStatusFilter(initStatus) ? initStatus : 'all');
  const [category, setCategory] = useState('');
  const [province, setProvince] = useState('');
  const [sort, setSort] = useState<SortKey>('new');
  useEffect(() => { const s = query.get('status'); if (isStatusFilter(s)) setStatus(s); }, [query]);

  const stories = mine.data?.stories ?? [];
  const counts = useMemo(() => countBy(stories), [stories]);
  const categories = useMemo(() => [...new Set(stories.map((s) => s.category).filter(Boolean))].sort(), [stories]);
  const provinces = useMemo(() => [...new Set(stories.map((s) => s.province).filter(Boolean))].sort(), [stories]);
  const shown = useMemo(() => filterStories(stories, { q, status, category, province, sort }), [stories, q, status, category, province, sort]);
  const filtered = !!(q.trim() || category || province || status !== 'all');
  const reset = () => { setQ(''); setStatus('all'); setCategory(''); setProvince(''); setSort('new'); };

  return (
    <div className="container page">
      <div className="page-head page-head-row">
        <div>
          <h1><Icon name="book" size={26} /> Cerita saya</h1>
          <p className="muted">{mine.data ? `${stories.length} tulisan yang pernah kamu kirim. Cari, saring, dan pantau statusnya di sini.` : 'Semua tulisan yang pernah kamu kirim.'}</p>
        </div>
        <div className="row-gap">
          <Link to="/dashboard" className="btn btn-outline btn-sm"><Icon name="dashboard" size={15} />Dashboard</Link>
          <Link to="/tambah" className="btn btn-primary btn-sm"><Icon name="plus" size={15} />Tulis cerita baru</Link>
        </div>
      </div>

      {mine.loading && !mine.data && <Spinner />}
      {mine.error && <ErrorBox message={mine.error} onRetry={mine.reload} />}

      {mine.data && stories.length === 0 && (
        <Empty title="Belum ada cerita" action={<Link to="/tambah" className="btn btn-primary">Tulis cerita pertamamu</Link>}>
          Kirim cerita rakyat dari daerahmu. Admin akan meninjau dan menerbitkannya sebagai buku.
        </Empty>
      )}

      {stories.length > 0 && (
        <>
          <div className="filter-bar my-filter" role="search">
            <div className="filter-title"><Icon name="filter" size={16} />Filter</div>
            <label className="input-ic">
              <Icon name="search" size={16} />
              <input type="search" placeholder="Cari judul, deskripsi, atau daerah…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari cerita saya" />
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter kategori">
              <option value="">Semua kategori</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={province} onChange={(e) => setProvince(e.target.value)} aria-label="Filter pulau">
              <option value="">Semua pulau</option>
              {provinces.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Urutkan cerita">
              {SORTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>

          <div className="chips-row" role="tablist" aria-label="Status cerita">
            {STATUS_TABS.map((t) => (
              <button key={t.v} role="tab" aria-selected={status === t.v} className={`chip-btn ${status === t.v ? 'on' : ''}`} onClick={() => setStatus(t.v)}>
                {t.l} <em className="cnt">{counts[t.v]}</em>
              </button>
            ))}
          </div>

          {filtered && (
            <div className="result-bar">
              <span><b>{shown.length}</b> dari {stories.length} cerita</span>
              <div className="active-filters">
                {q.trim() && <button className="af" onClick={() => setQ('')}>“{q.trim()}”<span aria-hidden="true">×</span></button>}
                {status !== 'all' && <button className="af" onClick={() => setStatus('all')}>Status: {STATUS_TABS.find((t) => t.v === status)?.l}<span aria-hidden="true">×</span></button>}
                {category && <button className="af" onClick={() => setCategory('')}>Kategori: {category}<span aria-hidden="true">×</span></button>}
                {province && <button className="af" onClick={() => setProvince('')}>Pulau: {province}<span aria-hidden="true">×</span></button>}
                <button className="link-btn" onClick={reset}>Hapus semua</button>
              </div>
            </div>
          )}

          {shown.length === 0 && (
            <Empty icon="search" title="Tidak ada cerita yang cocok" action={<button className="btn btn-outline" onClick={reset}>Hapus filter</button>}>
              Coba kata kunci lain, atau tampilkan semua status dan kategori.
            </Empty>
          )}
          <div className="grid-cards grid-mine">
            {shown.map((s) => <MyStoryCard key={s.id} s={s} actions={actions} />)}
          </div>
        </>
      )}
      {dialogs}
    </div>
  );
}
