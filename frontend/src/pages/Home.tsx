import { useState } from 'react';
import { api } from '../lib/api';
import type { Flipbook, Meta, Story } from '../types';
import { Link } from '../lib/router';
import { Icon } from '../components/Icon';
import { FlipBook } from '../components/FlipBook';
import { StoryCard } from '../components/StoryCard';
import { ErrorBox, Spinner, provinceColor, useAsync, useAutoRefresh } from '../components/ui';
import { useAuth } from '../lib/auth';

const CATS: { name: string; desc: string; icon: Parameters<typeof Icon>[0]['name']; color: string }[] = [
  { name: 'Legenda', desc: 'Kisah asal-usul tempat, tokoh, dan peristiwa yang dipercaya turun-temurun.', icon: 'globe', color: '#6E1423' },
  { name: 'Fabel', desc: 'Cerita para hewan yang menyimpan pelajaran hidup.', icon: 'sparkles', color: '#2F8466' },
  { name: 'Dongeng', desc: 'Cerita khayal penuh keajaiban untuk dibacakan bersama.', icon: 'book', color: '#C98A0B' },
];

function HeroBook() {
  const { data } = useAsync(async () => {
    const list = await api.get<{ stories: Story[] }>('stories', { limit: 6 });
    for (const s of list.stories) {
      const d = await api.get<{ story: Story; flipbook: Flipbook | null }>('stories/' + s.id);
      if (d.flipbook && d.flipbook.pages.length) return d;
    }
    return null;
  }, []);
  if (!data) return <div className="hero-book-ph" aria-hidden="true"><Icon name="book" size={56} /></div>;
  return (
    <figure className="hero-book">
      <div className="hero-book-stage"><FlipBook pages={data.flipbook!.pages} autoplay forceSingle={false} label={`Pratinjau buku ${data.story.title}`} /></div>
      <figcaption>
        <span>Sedang dibuka: <b>{data.story.title}</b></span>
        <Link to={`/baca/${data.story.id}`} className="btn btn-gold btn-sm"><Icon name="book" size={15} />Baca bukunya</Link>
      </figcaption>
    </figure>
  );
}

export function Home() {
  const { user } = useAuth();
  const meta = useAsync(() => api.get<Meta>('meta'), []);
  const [favs, setFavs] = useState<Record<number, boolean>>({});
  const popular = useAsync(() => api.get<{ stories: Story[] }>('stories', { limit: 5, sort: 'popular' }), [user?.id]);
  const featured = useAsync(() => api.get<{ stories: Story[] }>('stories', { limit: 60 }), [user?.id]);
  useAutoRefresh(() => { meta.refresh(); popular.refresh(); featured.refresh(); });
  const m = meta.data;
  const maxCount = Math.max(1, ...(m?.provinces.map((p) => p.count) ?? [1]));

  return (
    <>
      <section className="hero">
        <div className="hero-fx" aria-hidden="true">
          <i className="blob b1" /><i className="blob b2" /><i className="blob b3" />
          <i className="spark s1" /><i className="spark s2" /><i className="spark s3" /><i className="spark s4" /><i className="spark s5" /><i className="spark s6" />
        </div>
        <div className="container hero-in">
          <div className="hero-copy">
            <span className="chip chip-light"><Icon name="sparkles" size={14} />Platform cerita rakyat digital</span>
            <h1>Cerita Rakyat Nusantara</h1>
            <p>Buka buku cerita dari berbagai daerah di Indonesia, balik halamannya seperti buku sungguhan, lalu kirim cerita dari kampungmu sendiri.</p>
            <div className="hero-cta">
              <Link to="/cerita" className="btn btn-gold btn-lg"><Icon name="book" size={18} />Jelajahi Cerita</Link>
              <Link to="/tambah" className="btn btn-outline-light btn-lg"><Icon name="plus" size={18} />Kirim Ceritamu</Link>
            </div>
            <dl className="hero-stats">
              <div><dt>Cerita terbit</dt><dd>{m?.published ?? '–'}</dd></div>
              <div><dt>Daerah</dt><dd>{m?.regions ?? '–'}</dd></div>
              <div><dt>Pulau</dt><dd>{m?.provinces.length ?? '–'}</dd></div>
            </dl>
          </div>
          <HeroBook />
        </div>
      </section>

      <section className="container features" aria-label="Keunggulan">
        <div className="feature"><span className="feature-ic"><Icon name="book" size={22} /></span><div><h3>Buku yang bisa dibalik</h3><p>Baca cerita sebagai flipbook interaktif lengkap dengan gambar dan animasi.</p></div></div>
        <div className="feature"><span className="feature-ic"><Icon name="globe" size={22} /></span><div><h3>Dari seluruh Nusantara</h3><p>Legenda, fabel, dan dongeng dari berbagai pulau di Indonesia.</p></div></div>
        <div className="feature"><span className="feature-ic"><Icon name="shield" size={22} /></span><div><h3>Ditinjau oleh admin</h3><p>Setiap cerita dikurasi dulu sebelum diterbitkan untuk semua pembaca.</p></div></div>
      </section>

      <div className="ribbon" aria-hidden="true">
        <div className="ribbon-track">
          {[0, 1].map((n) => (
            <div className="ribbon-set" key={n}>
              {['Legenda', 'Fabel', 'Dongeng', 'Mitos', 'Sumatera', 'Jawa', 'Kalimantan', 'Sulawesi', 'Bali & Nusa Tenggara', 'Maluku', 'Papua'].map((t, i) => (
                <span key={t} className={`rb rb-${i % 6}`}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="container section">
        <div className="section-head">
          <div><span className="eyebrow">Kategori</span><h2>Pilih jenis ceritanya</h2><p className="muted">Mulai dari kisah asal-usul, cerita hewan, sampai dongeng turun-temurun.</p></div>
        </div>
        <div className="cat-grid">
          {CATS.map((c) => (
            <Link key={c.name} to={`/cerita?category=${encodeURIComponent(c.name)}`} className="cat-card" style={{ ['--cc' as string]: c.color }}>
              <span className="cat-ic"><Icon name={c.icon} size={24} /></span>
              <div><h3>{c.name}</h3><p>{c.desc}</p></div>
              <span className="cat-count">{m?.categories.find((x) => x.category === c.name)?.count ?? 0} cerita<Icon name="right" size={14} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div><span className="eyebrow">Daerah</span><h2>Sebaran cerita per daerah</h2><p className="muted">Pilih pulau untuk melihat cerita yang berasal dari sana.</p></div>
          <Link to="/cerita" className="btn btn-outline btn-sm">Jelajahi semua<Icon name="right" size={15} /></Link>
        </div>
        {meta.error && <ErrorBox message={meta.error} onRetry={meta.reload} />}
        {meta.loading && !m && <Spinner />}
        {m && m.provinces.length === 0 && <p className="muted">Belum ada cerita terbit.</p>}
        {m && (
          <div className="prov-grid">
            {m.provinces.map((p) => (
              <Link key={p.province} to={`/cerita?province=${encodeURIComponent(p.province)}`} className="prov-card" style={{ ['--pc' as string]: provinceColor(p.province) }}>
                <span className="prov-dot" />
                <div><h3>{p.province}</h3><p>{p.count} cerita</p></div>
                <div className="prov-bar"><span style={{ width: `${(p.count / maxCount) * 100}%` }} /></div>
                <span className="prov-go">Lihat cerita dari daerah ini<Icon name="right" size={14} /></span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container section">
        <div className="section-head">
          <div><span className="eyebrow">Populer</span><h2>Paling banyak dibaca</h2><p className="muted">Buku yang paling sering dibuka pembaca.</p></div>
          <Link to="/cerita?sort=popular" className="btn btn-outline btn-sm">Lihat peringkat<Icon name="right" size={15} /></Link>
        </div>
        {popular.loading && !popular.data && <Spinner />}
        {popular.error && <ErrorBox message={popular.error} onRetry={popular.reload} />}
        <div className="grid-cards grid-home">
          {popular.data?.stories.slice(0, 5).map((s, i) => <StoryCard key={s.id} rank={i + 1} story={{ ...s, is_favorite: favs[s.id] ?? s.is_favorite }} onFavChange={(id, f) => setFavs((x) => ({ ...x, [id]: f }))} />)}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div><span className="eyebrow">Terbaru</span><h2>Cerita pilihan</h2><p className="muted">Cerita rakyat yang baru terbit sebagai buku.</p></div>
          <Link to="/cerita" className="btn btn-outline btn-sm">Lihat semua</Link>
        </div>
        {featured.loading && !featured.data && <Spinner />}
        {featured.error && <ErrorBox message={featured.error} onRetry={featured.reload} />}
        <div className="grid-cards grid-home">
          {featured.data?.stories.map((s) => (
            <StoryCard key={s.id} story={{ ...s, is_favorite: favs[s.id] ?? s.is_favorite }} onFavChange={(id, f) => setFavs((x) => ({ ...x, [id]: f }))} />
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="steps-box">
          <div className="steps-intro">
            <span className="eyebrow">Cara kerja</span>
            <h2>Dari tulisanmu menjadi buku</h2>
            <p>Setiap cerita ditinjau dulu oleh admin, lalu didesain dan diterbitkan sebagai buku yang bisa dibalik halamannya.</p>
          </div>
          <ol className="steps">
            <li><span className="step-n">1</span><div><h3>Kirim ceritamu</h3><p>Isi judul, daerah asal, dan tulis ceritanya. Tambahkan gambar bila ada.</p></div></li>
            <li><span className="step-n">2</span><div><h3>Admin meninjau</h3><p>Statusnya "Menunggu persetujuan". Kamu mendapat notifikasi saat disetujui atau ditolak.</p></div></li>
            <li><span className="step-n">3</span><div><h3>Terbit sebagai flipbook</h3><p>Admin merancang halaman, gambar, dan animasinya, lalu menerbitkannya untuk semua pembaca.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="container section cta-wrap">
        <div className="cta-band">
          <div><h2>Punya cerita dari kampungmu?</h2><p>Tulis dan kirim, lalu biarkan cerita itu hidup sebagai buku untuk dibaca banyak orang.</p></div>
          <div className="cta-btns">
            <Link to="/tambah" className="btn btn-gold btn-lg"><Icon name="pencil" size={18} />Kirim ceritamu</Link>
            <Link to="/cerita" className="btn btn-outline-light btn-lg">Baca dulu</Link>
          </div>
        </div>
      </section>
    </>
  );
}
