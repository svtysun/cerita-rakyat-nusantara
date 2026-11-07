import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { api } from '../lib/api';
import type { Meta, Story } from '../types';
import { Icon } from '../components/Icon';
import { navigate } from '../lib/router';
import { fitCover } from '../lib/coverImage';
import { Confirm, Spinner, useAsync } from '../components/ui';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';

const FALLBACK_PROV = ['Sumatera', 'Jawa', 'Kalimantan', 'Sulawesi', 'Bali dan Nusa Tenggara', 'Maluku', 'Papua'];
const FALLBACK_CAT = ['Legenda', 'Fabel', 'Dongeng', 'Mitos'];
const DRAFT = 'crn-draft-new';
const MIN_STORY = 100;

type Fields = { title: string; region: string; province: string; category: string; short_description: string; full_story: string; image_url: string };
const EMPTY: Fields = { title: '', region: '', province: '', category: '', short_description: '', full_story: '', image_url: '' };

/** Membuat textarea tumbuh mengikuti isinya, seperti halaman menulis. */
function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [ref, value]);
}

export function StoryForm({ id }: { id?: string }) {
  const toast = useToast();
  const meta = useAsync(() => api.get<Meta>('meta'), []);
  const existing = useAsync(async () => (id ? (await api.get<{ story: Story }>('stories/' + id)).story : null), [id]);
  if (id && existing.loading) return <div className="container page"><Spinner /></div>;
  return <Writer key={existing.data?.id ?? 'new'} story={existing.data} meta={meta.data} toast={toast} />;
}

function Writer({ story, meta, toast }: { story: Story | null; meta: Meta | null; toast: (m: string, k?: 'ok' | 'err') => void }) {
  const initial = useMemo<Fields>(() => ({
    title: story?.title ?? '', region: story?.region ?? '', province: story?.province ?? '', category: story?.category ?? '',
    short_description: story?.short_description ?? '', full_story: story?.full_story ?? '', image_url: story?.image_url ?? '',
  }), [story]);
  const [f, setF] = useState<Fields>(initial);
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState(false);
  const { user } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const [imgMode, setImgMode] = useState<'file' | 'url'>('file');
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(titleRef, f.title);
  useAutosize(bodyRef, f.full_story);

  // pulihkan draf cerita baru
  useEffect(() => {
    if (story) return;
    try { const d = JSON.parse(localStorage.getItem(DRAFT) ?? 'null'); if (d && (d.title || d.full_story)) { setF((x) => ({ ...x, ...d })); setRestored(true); } } catch { /* abaikan */ }
  }, []); // eslint-disable-line
  // simpan otomatis di perangkat
  const first = useRef(true);
  useEffect(() => {
    if (story) return;
    if (first.current) { first.current = false; return; }
    setSaved('saving');
    const t = setTimeout(() => {
      try { if (f.title || f.full_story || f.short_description) localStorage.setItem(DRAFT, JSON.stringify(f)); setSaved('saved'); } catch { setSaved('idle'); }
    }, 600);
    return () => clearTimeout(t);
  }, [f]); // eslint-disable-line

  const set = (k: keyof Fields, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrs((x) => ({ ...x, [k]: '' })); };
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const chars = f.full_story.trim().length;
  const words = f.full_story.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));

  const checks = [
    { ok: f.title.trim().length >= 3, label: 'Judul cerita' },
    { ok: chars >= MIN_STORY, label: `Isi cerita (min. ${MIN_STORY} karakter)` },
    { ok: f.region.trim().length >= 2 && !!f.province && !!f.category, label: 'Daerah, pulau, dan kategori' },
    { ok: f.short_description.trim().length >= 10, label: 'Deskripsi singkat' },
  ];
  const done = checks.filter((c) => c.ok).length;

  const validate = () => {
    const e: Record<string, string> = {};
    if (f.title.trim().length < 3) e.title = 'Judul minimal 3 karakter.';
    if (f.region.trim().length < 2) e.region = 'Daerah asal wajib diisi.';
    if (!f.province) e.province = 'Pilih pulau.';
    if (!f.category) e.category = 'Pilih kategori.';
    if (f.short_description.trim().length < 10) e.short_description = 'Deskripsi singkat minimal 10 karakter.';
    if (chars < MIN_STORY) e.full_story = `Cerita minimal ${MIN_STORY} karakter (sekarang ${chars}).`;
    setErrs(e);
    return e;
  };

  const pick = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Ukuran gambar maksimal 5 MB.', 'err');
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return toast('Format gambar harus JPG, PNG, WEBP, atau GIF.', 'err');
    setUp(true);
    try { const r = await api.upload(await fitCover(file)); set('image_url', r.url); toast('Sampul diunggah.'); } catch (e: any) { toast(e.message, 'err'); } finally { setUp(false); }
  };

  const tryPublish = () => {
    const e = validate();
    if (Object.keys(e).length) {
      const detailErr = ['region', 'province', 'category', 'short_description'].some((k) => e[k]);
      if (detailErr) setPanel(true);
      return toast(e.title || e.full_story ? 'Lengkapi judul dan isi ceritamu dulu.' : 'Lengkapi detail cerita dulu.', 'err');
    }
    setConfirm(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = { ...f, title: f.title.trim(), region: f.region.trim() };
      if (story) { await api.put('stories/' + story.id, body); toast('Cerita diperbarui dan menunggu persetujuan admin.'); }
      else { await api.post('stories', body); try { localStorage.removeItem(DRAFT); } catch { /* abaikan */ } toast('Cerita terkirim. Admin akan meninjaunya.'); }
      navigate('/dashboard');
    } catch (err: any) { setConfirm(false); toast(err.message, 'err'); } finally { setBusy(false); }
  };

  const leave = () => {
    if (story && dirty) { setConfirmLeave(true); return; }
    if (!story && (f.title || f.full_story)) toast('Drafmu tersimpan di perangkat ini.');
    navigate('/dashboard');
  };
  const reset = () => { try { localStorage.removeItem(DRAFT); } catch { /* */ } setF(EMPTY); setRestored(false); setSaved('idle'); };

  const provs = meta?.all_provinces ?? FALLBACK_PROV;
  const cats = meta?.all_categories ?? FALLBACK_CAT;
  const E = ({ k }: { k: string }) => (errs[k] ? <small className="err">{errs[k]}</small> : null);
  const status = story ? (dirty ? 'Perubahan belum dikirim' : 'Tidak ada perubahan') : saved === 'saving' ? 'Menyimpan…' : saved === 'saved' ? 'Draf tersimpan di perangkat' : 'Draf baru';

  return (
    <div className={`wr ${focus ? 'focus' : ''}`}>
      <header className="wr-bar">
        <button className="wr-back" onClick={leave} aria-label="Kembali ke dashboard"><Icon name="left" size={18} /><span>Kembali</span></button>
        <div className="wr-status" role="status">
          <b>{story ? 'Ubah cerita' : 'Cerita baru'}</b>
          <span className={saved === 'saving' ? 'is-saving' : ''}><Icon name={story ? 'pencil' : 'save'} size={12} />{status}</span>
        </div>
        <div className="wr-actions">
          <button className="icon-btn wr-focus-btn" onClick={() => setFocus(!focus)} aria-pressed={focus} title={focus ? 'Keluar mode fokus' : 'Mode fokus (sembunyikan panel)'} aria-label="Mode fokus"><Icon name="expand" size={17} /></button>
          <button className="btn btn-ghost btn-sm wr-detail-btn" onClick={() => setPanel(true)} aria-expanded={panel}><Icon name="file" size={15} /><span>Detail</span><em>{done}/{checks.length}</em></button>
          <button className="btn btn-primary btn-sm" onClick={tryPublish} disabled={busy}><Icon name="send" size={15} /><span>{story ? 'Kirim ulang' : 'Kirim'}</span></button>
        </div>
      </header>

      <div className="wr-body">
        <main className="wr-main">
          <h1 className="sr-only">{story ? 'Ubah cerita' : 'Tulis cerita baru'}</h1>
          {restored && <p className="wr-note"><Icon name="save" size={15} />Draf terakhirmu dipulihkan.<button type="button" className="link-btn" onClick={reset}>Mulai dari kosong</button></p>}
          <div className="wr-paper">
            <div className="wr-cover-bar">
              {f.image_url
                ? <div className="wr-cover-img"><span className="cover-fit"><img className="cover-bg" src={f.image_url} alt="" aria-hidden="true" /><img className="cover-main" src={f.image_url} alt="Sampul cerita" /></span><div className="wr-cover-actions"><button type="button" onClick={() => setPanel(true)}><Icon name="image" size={13} />Ganti</button><button type="button" onClick={() => set('image_url', '')}><Icon name="trash" size={13} />Hapus</button></div></div>
                : <button type="button" className="wr-cover-add" onClick={() => fileRef.current?.click()} disabled={up}><Icon name="image" size={18} />{up ? 'Mengunggah sampul…' : 'Tambah gambar sampul (opsional)'}</button>}
            </div>
            <textarea ref={titleRef} rows={1} className="wr-title" value={f.title} onChange={(e) => set('title', e.target.value.replace(/\n/g, ' '))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); bodyRef.current?.focus(); } }}
              placeholder="Judul cerita" maxLength={120} aria-label="Judul cerita" aria-invalid={!!errs.title} />
            {errs.title && <small className="err">{errs.title}</small>}
            {user && <p className="wr-by">oleh <b>{user.name}</b></p>}
            <div className="wr-meta">
              {f.region && f.province ? <span><Icon name="pin" size={13} />{f.region}, {f.province}</span> : <button type="button" className="link-btn" onClick={() => setPanel(true)}><Icon name="pin" size={13} />Tambah daerah asal</button>}
              {f.category && <span className="wr-chip">{f.category}</span>}
            </div>
            <textarea ref={bodyRef} className="wr-text" value={f.full_story} onChange={(e) => set('full_story', e.target.value)}
              placeholder={'Mulai menulis ceritamu di sini…\n\nPisahkan paragraf dengan satu baris kosong. Paragraf pendek membuat halaman buku lebih rapi.'}
              aria-label="Isi cerita" aria-invalid={!!errs.full_story} spellCheck />
            {errs.full_story && <small className="err">{errs.full_story}</small>}
          </div>
          <details className="tips wr-tips"><summary><Icon name="sparkles" size={15} />Tips menulis cerita yang mudah dibaca</summary>
            <ul><li>Mulai dengan tokoh dan tempatnya, lalu masalah yang terjadi.</li><li>Satu paragraf untuk satu kejadian, dipisah satu baris kosong.</li><li>Tutup dengan pesan atau amanat di paragraf terakhir.</li><li>Tampilan buku, tata letak, dan animasi dibuat admin setelah ceritamu disetujui.</li></ul></details>
        </main>

        {panel && <div className="wr-scrim" onClick={() => setPanel(false)} aria-hidden="true" />}
        <aside className={`wr-panel ${panel ? 'open' : ''}`} aria-label="Detail cerita">
          <div className="wr-panel-head"><h2>Detail cerita</h2><button className="icon-btn wr-close" onClick={() => setPanel(false)} aria-label="Tutup detail"><Icon name="x" /></button></div>

          <div className="wr-block">
            <span className="wr-label">Sampul <em>(opsional)</em></span>
            <div className="wr-cover-row">
              <button type="button" className={`wr-cover ${f.image_url ? 'has' : ''}`} onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }} disabled={up} aria-label="Pilih gambar sampul">
                {f.image_url ? <img src={f.image_url} alt="Sampul cerita" /> : <><Icon name="image" size={24} /><small>{up ? 'Mengunggah…' : 'Tambah sampul'}</small></>}
              </button>
              <div className="wr-cover-side">
                <div className="seg seg-sm"><button type="button" className={imgMode === 'file' ? 'on' : ''} onClick={() => setImgMode('file')}><Icon name="upload" size={13} />File</button><button type="button" className={imgMode === 'url' ? 'on' : ''} onClick={() => setImgMode('url')}><Icon name="link" size={13} />URL</button></div>
                {imgMode === 'url'
                  ? <input value={f.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" aria-label="URL gambar" />
                  : <button type="button" className="btn btn-outline btn-xs" onClick={() => fileRef.current?.click()} disabled={up}><Icon name="upload" size={13} />Pilih gambar</button>}
                {f.image_url && <button type="button" className="link-btn" onClick={() => set('image_url', '')}>Hapus sampul</button>}
                <small className="muted">JPG, PNG, WEBP, GIF. Maks. 5 MB. Sampul otomatis disesuaikan ke rasio 2:3 seperti sampul buku; seluruh gambar tetap terlihat.</small>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          <label className="field"><span>Daerah asal</span><input value={f.region} onChange={(e) => set('region', e.target.value)} placeholder="Contoh: Jawa Barat" maxLength={80} aria-invalid={!!errs.region} /><E k="region" /></label>
          <div className="row2">
            <label className="field"><span>Pulau</span><select value={f.province} onChange={(e) => set('province', e.target.value)} aria-invalid={!!errs.province}><option value="">Pilih</option>{provs.map((p) => <option key={p}>{p}</option>)}</select><E k="province" /></label>
            <label className="field"><span>Kategori</span><select value={f.category} onChange={(e) => set('category', e.target.value)} aria-invalid={!!errs.category}><option value="">Pilih</option>{cats.map((c) => <option key={c}>{c}</option>)}</select><E k="category" /></label>
          </div>
          <label className="field"><span>Deskripsi singkat</span><textarea rows={3} value={f.short_description} onChange={(e) => set('short_description', e.target.value)} placeholder="Ringkasan cerita dalam 1–2 kalimat" maxLength={240} aria-invalid={!!errs.short_description} />
            <div className="field-foot"><E k="short_description" /><small className="muted">{f.short_description.length}/240</small></div></label>

          <div className="wr-check">
            <div className="wr-check-head"><b>Kelengkapan</b><span>{done} dari {checks.length}</span></div>
            <div className="wr-bar-prog" aria-hidden="true"><span style={{ width: `${(done / checks.length) * 100}%` }} /></div>
            <ul>{checks.map((c) => <li key={c.label} className={c.ok ? 'ok' : ''}><span><Icon name={c.ok ? 'check' : 'clock'} size={12} /></span>{c.label}</li>)}</ul>
          </div>
          <p className="wr-review"><Icon name="clock" size={15} />Ceritamu ditinjau admin dulu sebelum diterbitkan sebagai buku.</p>
          <button className="btn btn-primary btn-block wr-panel-send" onClick={() => { setPanel(false); tryPublish(); }} disabled={busy}><Icon name="send" size={16} />{story ? 'Simpan dan kirim ulang' : 'Kirim cerita'}</button>
        </aside>
      </div>

      <footer className="wr-foot" aria-live="polite">
        <span><b>{words}</b> kata</span><span><b>{chars}</b> karakter</span><span>±{minutes} menit baca</span>
        {chars < MIN_STORY && <span className="wr-min">Minimal {MIN_STORY} karakter · kurang {MIN_STORY - chars}</span>}
      </footer>

      {confirmLeave && <Confirm title="Keluar tanpa mengirim?" message="Perubahanmu belum dikirim. Kalau keluar sekarang, perubahan itu akan hilang." confirmLabel="Ya, keluar" danger onClose={() => setConfirmLeave(false)} onConfirm={() => { setConfirmLeave(false); navigate('/dashboard'); }} />}
      {confirm && <Confirm title={story ? 'Kirim ulang cerita?' : 'Kirim cerita ke admin?'} message={`“${f.title.trim()}” (${words} kata) akan ditinjau admin. Setelah disetujui, admin mendesainnya menjadi buku flipbook dan menerbitkannya.`} confirmLabel={story ? 'Ya, kirim ulang' : 'Ya, kirim'} onClose={() => setConfirm(false)} onConfirm={submit} />}
    </div>
  );
}
