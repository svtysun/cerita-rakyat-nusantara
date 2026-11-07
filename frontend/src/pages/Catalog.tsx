import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Meta, Story } from '../types';
import { Icon } from '../components/Icon';
import { StoryCard } from '../components/StoryCard';
import { Empty, ErrorBox, Spinner, useAsync, useAutoRefresh } from '../components/ui';
import { navigate, useLocation } from '../lib/router';
import { useAuth } from '../lib/auth';

const TOP = 5; // peringkat terpopuler dibatasi sampai #5

export function Catalog() {
  const { user } = useAuth();
  const { query } = useLocation();
  const [q, setQ] = useState(query.get('q') ?? '');
  const province = query.get('province') ?? '';
  const category = query.get('category') ?? '';
  const sort = query.get('sort') === 'popular' ? 'popular' : '';
  const [term, setTerm] = useState(q);
  const meta = useAsync(() => api.get<Meta>('meta'), []);
  const list = useAsync(() => api.get<{ stories: Story[] }>('stories', { q: term, province, category, sort, limit: sort === 'popular' ? TOP : undefined }), [term, province, category, sort, user?.id]);
  useAutoRefresh(() => list.refresh());
  const [favs, setFavs] = useState<Record<number, boolean>>({});

  useEffect(() => { const t = setTimeout(() => setTerm(q), 250); return () => clearTimeout(t); }, [q]);
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams({ ...(province && { province }), ...(category && { category }), ...(sort && { sort }) });
    if (v) p.set(k, v); else p.delete(k);
    navigate('/cerita' + (p.toString() ? '?' + p.toString() : ''));
  };
  const stories = (list.data?.stories ?? []).slice(0, sort === 'popular' ? TOP : undefined);
  const clear = () => { setQ(''); navigate('/cerita'); };

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Cerita Rakyat Nusantara</h1>
        <p className="muted">{list.data ? (sort === 'popular' ? `Top ${stories.length} cerita paling banyak dibaca.` : `Jelajahi ${stories.length} cerita rakyat dari berbagai daerah di Indonesia.`) : 'Jelajahi cerita rakyat dari berbagai daerah di Indonesia.'}</p>
      </div>
      <div className="filter-bar" role="search">
        <div className="filter-title"><Icon name="filter" size={16} />Filter cerita</div>
        <label className="input-ic"><Icon name="search" size={16} /><input type="search" placeholder="Cari judul atau deskripsi…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari cerita" /></label>
        <select value={province} onChange={(e) => setParam('province', e.target.value)} aria-label="Filter pulau">
          <option value="">Semua pulau</option>
          {meta.data?.all_provinces.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={category} onChange={(e) => setParam('category', e.target.value)} aria-label="Filter kategori">
          <option value="">Semua kategori</option>
          {meta.data?.all_categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="catalog-quick" aria-label="Pilih kategori cepat">
        <span className="lbl">Kategori:</span>
        {[{ v: '', l: 'Semua' }, ...(meta.data?.all_categories ?? []).map((c) => ({ v: c, l: c }))].map((c) => (
          <button key={c.v} className={`chip-btn ${category === c.v ? 'on' : ''}`} aria-pressed={category === c.v} onClick={() => setParam('category', c.v)}>{c.l}</button>
        ))}
      </div>
      <div className="sort-row" role="group" aria-label="Urutkan cerita">
        <span className="lbl">Urutkan:</span>
        <button className={`chip-btn ${sort === '' ? 'on' : ''}`} onClick={() => setParam('sort', '')}><Icon name="clock" size={13} />Terbaru</button>
        <button className={`chip-btn ${sort === 'popular' ? 'on' : ''}`} onClick={() => setParam('sort', 'popular')}><Icon name="flame" size={13} />Terpopuler</button>
      </div>
      {list.data && (province || category || term) && (
        <div className="result-bar">
          <span><b>{stories.length}</b> cerita ditemukan</span>
          <div className="active-filters">
            {term && <button className="af" onClick={() => setQ('')}>“{term}”<span aria-hidden="true">×</span></button>}
            {province && <button className="af" onClick={() => setParam('province', '')}>Pulau: {province}<span aria-hidden="true">×</span></button>}
            {category && <button className="af" onClick={() => setParam('category', '')}>Kategori: {category}<span aria-hidden="true">×</span></button>}
            <button className="link-btn" onClick={clear}>Hapus semua</button>
          </div>
        </div>
      )}
      {list.loading && !list.data && <Spinner />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && stories.length === 0 && (
        <Empty icon="search" title="Cerita tidak ditemukan" action={<button className="btn btn-outline" onClick={clear}>Hapus filter</button>}>
          Coba kata kunci lain, atau tampilkan semua pulau dan kategori.
        </Empty>
      )}
      <div className="grid-cards">
        {stories.map((s, i) => <StoryCard key={s.id} rank={sort === 'popular' && i < TOP ? i + 1 : undefined} story={{ ...s, is_favorite: favs[s.id] ?? s.is_favorite }} onFavChange={(id, f) => setFavs((x) => ({ ...x, [id]: f }))} />)}
      </div>
    </div>
  );
}
