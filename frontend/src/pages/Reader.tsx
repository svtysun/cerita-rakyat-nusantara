import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { isStaff, type Flipbook, type Story } from '../types';
import { Link, navigate } from '../lib/router';
import { ShareButton } from '../components/ShareButton';
import { Icon } from '../components/Icon';
import { FlipBook, type FlipHandle, type FlipState } from '../components/FlipBook';
import { ErrorBox, Modal, Spinner, useAsync } from '../components/ui';
import { useAuth } from '../lib/auth';

export function Reader({ id }: { id: string }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.get<{ story: Story; flipbook: Flipbook | null }>('stories/' + id), [id, user?.id]);
  const ref = useRef<FlipHandle>(null);
  const [st, setSt] = useState<FlipState | null>(null);
  const [pick, setPick] = useState(false);
  const [num, setNum] = useState('');
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('crn-sound') !== 'off'; } catch { return true; } });
  const toggleSound = () => setSound((v) => { const n = !v; try { localStorage.setItem('crn-sound', n ? 'on' : 'off'); } catch { /* abaikan */ } return n; });
  const isPub = data?.story.status === 'published' && data.flipbook?.status === 'published';
  useEffect(() => { if (isPub) api.post(`stories/${id}/view`).catch(() => {}); }, [id, isPub]);

  if (loading && !data) return <div className="reader reader-msg"><Spinner /></div>;
  if (error || !data) return <div className="reader reader-msg"><ErrorBox message={error ?? 'Buku tidak ditemukan.'} onRetry={reload} /></div>;
  const { story, flipbook } = data;
  if (!flipbook || flipbook.pages.length === 0 || (flipbook.status !== 'published' && !isStaff(user))) {
    return (
      <div className="reader reader-msg">
        <div className="empty"><span className="empty-ic"><Icon name="book" size={26} /></span><h3>Buku ini belum terbit</h3><p>Cerita masih dalam proses desain. Kamu tetap bisa membaca versi teksnya.</p><Link to={`/cerita/${story.id}`} className="btn btn-primary">Baca versi teks</Link></div>
      </div>
    );
  }
  const total = flipbook.pages.length;
  const label = !st ? '' : st.single ? `Halaman ${(st.right ?? 0) + 1} dari ${total}` :
    st.left === null ? 'Sampul' : st.right === null ? 'Sampul belakang' : `Halaman ${st.left + 1}–${st.right + 1} dari ${total}`;
  const goFull = () => { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); };
  const page = st ? (st.single ? st.right ?? 0 : st.right ?? st.left ?? 0) : 0;

  const go = (p: number) => { ref.current?.goTo(Math.max(0, Math.min(total - 1, p))); setPick(false); };
  const submitNum = (e: FormEvent) => { e.preventDefault(); const v = parseInt(num, 10); if (!Number.isNaN(v)) go(v - 1); };

  return (
    <div className="reader">
      <div className="reader-bar">
        <button className="btn btn-ghost-light btn-sm" onClick={() => (window.history.length > 1 ? window.history.back() : navigate(`/cerita/${story.id}`))}><Icon name="left" size={15} />Kembali</button>
        <div className="reader-title"><b>{story.title}</b><span>{story.region}, {story.province}</span></div>
        <div className="reader-tools">
          <button className="btn btn-ghost-light btn-sm" onClick={() => { setNum(String(page + 1)); setPick(true); }} aria-label="Pilih halaman"><Icon name="grid" size={15} /><span className="hide-sm">Halaman</span></button>
          <Link to={`/cerita/${story.id}`} className="btn btn-ghost-light btn-sm"><Icon name="file" size={15} /><span className="hide-sm">Mode teks</span></Link>
          {story.status === 'published' && <ShareButton story={story} className="btn btn-ghost-light btn-sm" label="Bagikan" />}
          <button className="btn btn-ghost-light btn-sm" onClick={toggleSound} aria-label={sound ? 'Matikan suara kertas' : 'Nyalakan suara kertas'} aria-pressed={sound} title={sound ? 'Suara kertas: nyala' : 'Suara kertas: mati'}><Icon name={sound ? 'volume' : 'mute'} size={15} /></button>
          <button className="btn btn-ghost-light btn-sm" onClick={goFull} aria-label="Layar penuh"><Icon name="expand" size={15} /></button>
        </div>
      </div>
      {flipbook.status !== 'published' && <div className="reader-draft">Pratinjau draf: buku ini belum diterbitkan.</div>}
      <div className="reader-stage">
        <FlipBook ref={ref} pages={flipbook.pages} speed={flipbook.settings?.speed ?? 'normal'} onState={setSt} sound={sound} label={`Buku ${story.title}`} />
      </div>
      <div className="reader-ctl">
        <button className="round-btn" onClick={() => ref.current?.prev()} disabled={!st || st.atStart} aria-label="Halaman sebelumnya"><Icon name="left" size={20} /></button>
        <div className="reader-prog">
          <span aria-live="polite">{label}</span>
          <input type="range" min={0} max={total - 1} value={page} onChange={(e) => ref.current?.jump(Number(e.target.value))} aria-label="Pilih halaman" />
        </div>
        <button className="round-btn" onClick={() => ref.current?.next()} disabled={!st || st.atEnd} aria-label="Halaman berikutnya"><Icon name="right" size={20} /></button>
      </div>
      {pick && (
        <Modal title="Pilih halaman" onClose={() => setPick(false)}>
          <form className="pick-form" onSubmit={submitNum}>
            <label htmlFor="pick-num">Lompat ke halaman</label>
            <input id="pick-num" className="input" type="number" inputMode="numeric" min={1} max={total} value={num} onChange={(e) => setNum(e.target.value)} autoFocus />
            <span className="muted">dari {total}</span>
            <button className="btn btn-primary" type="submit">Pergi</button>
          </form>
          <div className="pick-quick">
            <button className="btn btn-outline btn-xs" onClick={() => go(0)}>Awal</button>
            <button className="btn btn-outline btn-xs" onClick={() => go(Math.floor((total - 1) / 2))}>Tengah</button>
            <button className="btn btn-outline btn-xs" onClick={() => go(total - 1)}>Akhir</button>
          </div>
          <div className="pick-grid" role="list">
            {Array.from({ length: total }, (_, i) => (
              <button key={i} role="listitem" className={`pick-chip ${i === page ? 'is-on' : ''}`} onClick={() => go(i)} aria-label={`Halaman ${i + 1}`} aria-current={i === page}>{i + 1}</button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
