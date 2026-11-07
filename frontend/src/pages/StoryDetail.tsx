import { useEffect, useState } from 'react';
import { api, fmtDate } from '../lib/api';
import { isStaff, type Flipbook, type Story } from '../types';
import { Link, navigate } from '../lib/router';
import { Icon } from '../components/Icon';
import { Cover, ErrorBox, Spinner, StatusBadge, useAsync, provinceColor } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ShareButton } from '../components/ShareButton';
import { fmtViews } from '../lib/format';

export function StoryDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(() => api.get<{ story: Story; flipbook: Flipbook | null }>('stories/' + id), [id, user?.id]);
  const [busy, setBusy] = useState(false);
  const isPub = data?.story.status === 'published';
  useEffect(() => { if (isPub) api.post(`stories/${id}/view`).catch(() => {}); }, [id, isPub]);
  if (loading && !data) return <div className="container page"><Spinner /></div>;
  if (error || !data) return <div className="container page"><ErrorBox message={error ?? 'Cerita tidak ditemukan.'} onRetry={reload} /></div>;
  const s = data.story;
  const isOwner = user?.id === s.user_id;
  const isAdmin = isStaff(user);
  const published = s.status === 'published' && data.flipbook?.status === 'published';

  const fav = async () => {
    if (!user) { toast('Masuk dulu untuk menyimpan cerita favorit.', 'err'); navigate('/masuk?next=' + encodeURIComponent(`/cerita/${id}`)); return; }
    setBusy(true);
    try {
      const r = await api.post<{ is_favorite: boolean }>('favorites/' + s.id);
      setData({ ...data, story: { ...s, is_favorite: r.is_favorite } });
      toast(r.is_favorite ? 'Ditambahkan ke favorit.' : 'Dihapus dari favorit.');
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const paragraphs = (s.full_story ?? '').split(/\n{2,}/).filter(Boolean);
  return (
    <>
      <section className="detail-hero" style={{ ['--pc' as string]: provinceColor(s.province) }}>
        {s.image_url && <img className="detail-bg" src={s.image_url} alt="" aria-hidden="true" />}
        <div className="detail-shade" />
        <div className="container detail-in">
          <div className="detail-bar">
            <button className="btn btn-gold btn-sm" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/cerita'))}><Icon name="left" size={15} />Kembali</button>
          </div>
          <div className="detail-main">
            <div className="detail-cover detail-cover-book">
              <Cover src={s.image_url} alt={`Sampul ${s.title}`} province={s.province} title={s.title} />
              <div className="detail-cover-copy" aria-hidden="true">
                <strong>{s.title}</strong>
                <span>{s.region}, {s.province}</span>
              </div>
              <span className="detail-cover-curl" aria-hidden="true" />
            </div>
            <div className="detail-info">
              <span className="chip chip-cat">{s.category}</span>
              <h1>{s.title}</h1>
              <p className="detail-meta">
                <span><Icon name="pin" size={15} />{s.region}, {s.province}</span>
                <span><Icon name="user" size={15} />{s.author}</span>
                <span><Icon name="clock" size={15} />{fmtDate(s.created_at)}</span>
                {s.status === 'published' && <span><Icon name="eye" size={15} />{fmtViews(s.views)} dibaca</span>}
              </p>
              {(published || s.status === 'published') && (
                <div className="detail-actions">
                  {published && <Link to={`/baca/${s.id}`} className="btn btn-gold btn-lg detail-read"><Icon name="book" size={18} />Mulai membaca</Link>}
                  <ShareButton story={s} className="btn btn-outline-light btn-lg" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container detail-wrap">
        {!published && (
          <div className={`notice notice-${s.status}`} role="status">
            <StatusBadge status={s.status} />
            <p>
              {s.status === 'pending' && 'Ceritamu sedang menunggu persetujuan admin. Setelah disetujui, admin akan mendesainnya menjadi buku flipbook.'}
              {s.status === 'approved' && 'Cerita sudah disetujui dan sedang didesain admin menjadi buku. Ceritamu akan tampil untuk publik setelah diterbitkan.'}
              {s.status === 'rejected' && `Cerita belum dapat diterbitkan.${s.reject_reason ? ' Alasan: ' + s.reject_reason : ''} Ubah ceritamu lalu kirim ulang.`}
            </p>
            {isOwner && ['pending', 'rejected'].includes(s.status) && <Link to={`/cerita/${s.id}/edit`} className="btn btn-outline btn-sm"><Icon name="pencil" size={14} />Ubah cerita</Link>}
            {isAdmin && <Link to={`/admin/editor/${s.id}`} className="btn btn-primary btn-sm"><Icon name="layers" size={14} />Buka editor flipbook</Link>}
          </div>
        )}

        <article className="reading card">
          {published && (
            <div className="read-cta">
              <div><h2>Baca sebagai buku</h2><p className="muted">Balik halamannya dengan klik, geser, atau tombol panah.</p></div>
              <Link to={`/baca/${s.id}`} className="btn btn-primary btn-lg"><Icon name="book" size={18} />Buka buku</Link>
            </div>
          )}
          <h2 className="reading-h">Ringkasan</h2>
          <p className="lead">{s.short_description}</p>
          <h2 className="reading-h">Cerita lengkap</h2>
          <div className="story-text">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
        </article>

        {published && (
          <div className="fav-panel">
            <div><b>Suka dengan cerita ini?</b><p className="muted">Simpan ke daftar favorit agar mudah ditemukan kembali.</p></div>
            <button className={`btn ${s.is_favorite ? 'btn-primary' : 'btn-outline'}`} onClick={fav} disabled={busy} aria-pressed={!!s.is_favorite}>
              <Icon name="heart" size={16} fill={!!s.is_favorite} />{s.is_favorite ? 'Tersimpan di favorit' : 'Tambah ke favorit'}
            </button>
          </div>
        )}
        <div className="more-box"><div><h3>Jelajahi cerita lainnya</h3><p className="muted">Temukan lebih banyak cerita rakyat dari seluruh Nusantara.</p></div><Link to="/cerita" className="btn btn-primary">Lihat cerita lainnya</Link></div>
      </div>
    </>
  );
}
