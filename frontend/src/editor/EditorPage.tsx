import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { El, Flipbook, Page, Story } from '../types';
import { Link, navigate } from '../lib/router';
import { Icon } from '../components/Icon';
import { FlipBook } from '../components/FlipBook';
import { PageView } from '../components/PageView';
import { Confirm, ErrorBox, Spinner, StatusBadge, useAsync } from '../components/ui';
import { useToast } from '../lib/toast';
import { clone, cloneEl, generateDraft, mkImage, pageTemplate, uid } from '../lib/draft';
import { PAGE_H, PAGE_W } from '../types';
import { Canvas, type Play } from './Canvas';
import { LeftPanel, RightPanel } from './Panels';

interface Doc { pages: Page[]; speed: 'fast' | 'normal' | 'slow' }
type Loaded = { story: Story; flipbook: Flipbook | null };

export default function EditorPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useAsync(() => api.get<Loaded>('admin/flipbooks/' + id), [id]);
  if (loading && !data) return <div className="container page"><Spinner label="Membuka editor…" /></div>;
  if (error || !data) return <div className="container page"><ErrorBox message={error ?? 'Cerita tidak ditemukan.'} onRetry={reload} /></div>;
  if (data.story.status === 'pending' || data.story.status === 'rejected') return <NotApproved story={data.story} onDone={reload} />;
  return <Editor story={data.story} flipbook={data.flipbook} onReload={reload} />;
}

function NotApproved({ story, onDone }: { story: Story; onDone: () => void }) {
  const toast = useToast();
  return (
    <div className="container page narrow"><div className="empty">
      <span className="empty-ic"><Icon name="clock" size={26} /></span>
      <h3>Setujui cerita dulu sebelum mendesain buku</h3>
      <p>Cerita "{story.title}" masih berstatus <StatusBadge status={story.status} />. Hanya cerita yang disetujui yang bisa dibuatkan flipbook.</p>
      <div className="row-gap">
        <button className="btn btn-success" onClick={async () => { try { await api.post(`admin/stories/${story.id}/approve`); toast('Cerita disetujui.'); onDone(); } catch (e: any) { toast(e.message, 'err'); } }}><Icon name="check" size={16} />Setujui sekarang</button>
        <Link to="/admin" className="btn btn-outline">Kembali ke admin</Link>
      </div>
    </div></div>
  );
}

function Editor({ story, flipbook, onReload }: { story: Story; flipbook: Flipbook | null; onReload: () => void }) {
  const toast = useToast();
  const initial = useMemo<Doc>(() => ({ pages: flipbook?.pages.length ? flipbook.pages : generateDraft(story), speed: flipbook?.settings?.speed ?? 'normal' }), []); // eslint-disable-line
  const [doc, setDocRaw] = useState<Doc>(initial);
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);
  const [dirty, setDirty] = useState(!flipbook?.pages.length);
  const [pi, setPi] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [fitZoom, setFitZoom] = useState(1);
  const [play, setPlay] = useState<Play | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelPage, setConfirmDelPage] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [published, setPublished] = useState(story.status === 'published');
  const wsRef = useRef<HTMLDivElement>(null);
  const docRef = useRef(doc); docRef.current = doc;
  const gestureBase = useRef<Doc | null>(null);
  const coalesce = useRef<{ key: string; t: number } | null>(null);

  const page = doc.pages[Math.min(pi, doc.pages.length - 1)];
  const el = page.elements.find((e) => e.id === selId) ?? null;
  const z = zoom === 'fit' ? fitZoom : zoom;

  // ---------- riwayat (undo / redo) ----------
  const record = (prev: Doc) => { setPast((p) => [...p.slice(-79), prev]); setFuture([]); };
  const commit = (next: Doc, key?: string) => {
    const now = Date.now();
    const co = coalesce.current;
    if (!(key && co && co.key === key && now - co.t < 900)) record(docRef.current);
    coalesce.current = key ? { key, t: now } : null;
    setDocRaw(next); setDirty(true);
  };
  const live = (next: Doc) => { setDocRaw(next); setDirty(true); };
  const undo = () => { const p = past[past.length - 1]; if (!p) return; setFuture((f) => [docRef.current, ...f]); setPast(past.slice(0, -1)); setDocRaw(p); setDirty(true); coalesce.current = null; };
  const redo = () => { const f = future[0]; if (!f) return; setPast((p) => [...p, docRef.current]); setFuture(future.slice(1)); setDocRaw(f); setDirty(true); coalesce.current = null; };

  const mapPage = (idx: number, fn: (p: Page) => Page, d = docRef.current): Doc => ({ ...d, pages: d.pages.map((p, i) => (i === idx ? fn(p) : p)) });
  const patchEl = useCallback((elId: string, patch: Partial<El>, rec: boolean, key?: string) => {
    const d = docRef.current;
    const next = mapPage(pi, (p) => ({ ...p, elements: p.elements.map((e) => (e.id === elId ? ({ ...e, ...patch } as El) : e)) }), d);
    if (rec) commit(next, key); else live(next);
  }, [pi]); // eslint-disable-line
  const onGesture = (start: boolean) => {
    if (start) gestureBase.current = docRef.current;
    else if (gestureBase.current && gestureBase.current !== docRef.current) { record(gestureBase.current); coalesce.current = null; gestureBase.current = null; }
  };

  const addEl = (e: El) => { commit(mapPage(pi, (p) => ({ ...p, elements: [...p.elements, e] }))); setSelId(e.id); };
  const delEl = () => { if (!el) return; commit(mapPage(pi, (p) => ({ ...p, elements: p.elements.filter((x) => x.id !== el.id) }))); setSelId(null); };
  const dupEl = () => { if (!el) return; const c = { ...cloneEl(el), x: el.x + 16, y: el.y + 16 } as El; addEl(c); };
  const clip = useRef<El | null>(null);
  const copyEl = () => { if (el) { clip.current = clone(el); toast('Elemen disalin.'); } };
  const pasteEl = () => { if (!clip.current) return false; const c = { ...cloneEl(clip.current), x: clip.current.x + 16, y: clip.current.y + 16 } as El; clip.current = c; addEl(c); return true; };
  const layer = (d: 1 | -1 | 'top' | 'bottom') => {
    if (!el) return;
    const arr = [...page.elements]; const i = arr.findIndex((x) => x.id === el.id);
    const [it] = arr.splice(i, 1);
    const j = d === 'top' ? arr.length : d === 'bottom' ? 0 : Math.max(0, Math.min(arr.length, i + d));
    arr.splice(j, 0, it);
    commit(mapPage(pi, (p) => ({ ...p, elements: arr })));
  };
  const patchPage = (patch: Partial<Page>) => commit(mapPage(pi, (p) => ({ ...p, ...patch })), 'page:' + Object.keys(patch).join());

  // ---------- gambar ----------
  const addImage = (src: string, alt = '', fit = 280) => {
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      let w = Math.min(fit, PAGE_W - 40), h = Math.round(w / r);
      if (h > PAGE_H - 40) { h = PAGE_H - 40; w = Math.round(h * r); }
      addEl(mkImage(src, Math.round((PAGE_W - w) / 2), Math.round(Math.max(20, (PAGE_H - h) / 2)), w, h, alt));
    };
    img.onerror = () => toast('Gambar tidak dapat dimuat. Periksa alamatnya.', 'err');
    img.src = src;
  };
  const uploadFiles = async (files: File[]) => {
    const imgs = files.filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type));
    if (!imgs.length) return toast('Pilih berkas gambar JPG, PNG, WEBP, atau GIF.', 'err');
    setUploading(true);
    let ok = 0;
    for (const f of imgs) {
      if (f.size > 5 * 1024 * 1024) { toast(`${f.name}: ukuran maksimal 5 MB.`, 'err'); continue; }
      try { const r = await api.upload(f); addImage(r.url, f.name.replace(/\.[^.]+$/, '')); ok++; } catch (e: any) { toast(e.message, 'err'); }
    }
    setUploading(false); setAssetsVersion((v) => v + 1);
    if (ok) toast(ok > 1 ? `${ok} gambar diunggah dan ditambahkan.` : 'Gambar diunggah dan ditambahkan ke halaman.');
  };
  const uploadRef = useRef(uploadFiles); uploadRef.current = uploadFiles;
  const pasteRef = useRef<() => boolean>(() => false); pasteRef.current = pasteEl;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); uploadRef.current(files); }
      else if (pasteRef.current()) e.preventDefault();
    };
    window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste);
  }, []);
  const [drawer, setDrawer] = useState<'left' | 'right' | null>(null);
  const [dropping, setDropping] = useState(false);
  const [tips, setTips] = useState(() => { try { return localStorage.getItem('crn-editor-tips') !== '1'; } catch { return true; } });
  const closeTips = () => { setTips(false); try { localStorage.setItem('crn-editor-tips', '1'); } catch { /* */ } };

  // ---------- halaman ----------
  const addPage = (kind: Parameters<typeof pageTemplate>[0]) => {
    const np = pageTemplate(kind, story);
    const pages = [...doc.pages]; pages.splice(pi + 1, 0, np);
    commit({ ...doc, pages }); setPi(pi + 1); setSelId(null);
  };
  const dupPage = () => { const np = { ...clone(page), id: uid(), elements: page.elements.map(cloneEl) }; const pages = [...doc.pages]; pages.splice(pi + 1, 0, np); commit({ ...doc, pages }); setPi(pi + 1); };
  const delPage = () => { if (doc.pages.length <= 1) return toast('Buku minimal punya satu halaman.', 'err'); const pages = doc.pages.filter((_, i) => i !== pi); commit({ ...doc, pages }); setPi(Math.max(0, pi - 1)); setSelId(null); };
  const movePage = (d: -1 | 1) => { const j = pi + d; if (j < 0 || j >= doc.pages.length) return; const pages = [...doc.pages]; [pages[pi], pages[j]] = [pages[j], pages[pi]]; commit({ ...doc, pages }); setPi(j); };
  const regen = () => { commit({ ...doc, pages: generateDraft(story) }); setPi(0); setSelId(null); setConfirmRegen(false); };

  // ---------- simpan & terbit ----------
  const save = async (silent = false) => {
    setSaving(true);
    try {
      await api.put('admin/flipbooks/' + story.id, { pages: docRef.current.pages, settings: { speed: docRef.current.speed } });
      setDirty(false);
      if (!silent) toast('Flipbook tersimpan.');
      return true;
    } catch (e: any) { toast(e.message, 'err'); return false; } finally { setSaving(false); }
  };
  const publish = async () => {
    if (!(await save(true))) return;
    try { await api.post(`admin/stories/${story.id}/publish`); setPublished(true); toast('Buku diterbitkan. Penulis mendapat notifikasi.'); } catch (e: any) { toast(e.message, 'err'); }
  };
  const unpublish = async () => { try { await api.post(`admin/stories/${story.id}/unpublish`); setPublished(false); toast('Penerbitan dibatalkan. Buku kembali menjadi draf.'); } catch (e: any) { toast(e.message, 'err'); } };

  // ---------- zoom otomatis ----------
  useEffect(() => {
    const node = wsRef.current; if (!node) return;
    const upd = () => setFitZoom(Math.max(0.35, Math.min(1.6, Math.min((node.clientWidth - 48) / 400, (node.clientHeight - 48) / 560))));
    upd(); const ro = new ResizeObserver(upd); ro.observe(node); return () => ro.disconnect();
  }, []);

  // ---------- keyboard ----------
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e) => {
    const t = e.target as HTMLElement;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (typing || preview) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); dupEl(); }
    else if (mod && e.key.toLowerCase() === 'c' && el) { copyEl(); }
    else if (mod && e.key.toLowerCase() === 'x' && el) { e.preventDefault(); copyEl(); delEl(); }
    else if (mod && e.key === ']') { e.preventDefault(); layer(e.shiftKey ? 'top' : 1); }
    else if (mod && e.key === '[') { e.preventDefault(); layer(e.shiftKey ? 'bottom' : -1); }
    else if (e.key === 'Tab' && page.elements.length) {
      e.preventDefault();
      const n = page.elements.length, i = el ? page.elements.findIndex((x) => x.id === el.id) : -1;
      setSelId(page.elements[(i + (e.shiftKey ? -1 : 1) + n) % n].id);
    }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && el) { e.preventDefault(); delEl(); }
    else if (e.key === 'Escape') setSelId(null);
    else if (el && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1;
      patchEl(el.id, { x: el.x + (e.key === 'ArrowRight' ? s : e.key === 'ArrowLeft' ? -s : 0), y: el.y + (e.key === 'ArrowDown' ? s : e.key === 'ArrowUp' ? -s : 0) }, true, 'nudge:' + el.id);
    }
  };
  useEffect(() => { const on = (e: KeyboardEvent) => keyRef.current(e); window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on); }, []);
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', on); return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  useEffect(() => {
    if (!dirty || published || saving) return;
    const t = setTimeout(() => { save(true); }, 6000);
    return () => clearTimeout(t);
  }, [doc, dirty, published]); // eslint-disable-line

  const leave = () => { if (!dirty) navigate('/admin'); else setConfirmLeave(true); };

  return (
    <div className="editor">
      <header className="ed-top">
        <button className="btn btn-ghost-light btn-sm" onClick={leave} aria-label="Kembali ke admin"><Icon name="left" size={15} /><span className="lbl">Admin</span></button>
        <button className={`icon-btn light ed-drawer-btn ${drawer === 'left' ? 'on' : ''}`} onClick={() => setDrawer(drawer === 'left' ? null : 'left')} aria-label="Alat tambah elemen" aria-expanded={drawer === 'left'}><Icon name="plus" /></button>
        <div className="ed-title"><b>{story.title}</b><StatusBadge status={published ? 'published' : 'approved'} /></div>
        <div className="ed-top-actions">
          <button className="icon-btn light" onClick={undo} disabled={!past.length} title="Urungkan (Ctrl+Z)" aria-label="Urungkan"><Icon name="undo" /></button>
          <button className="icon-btn light" onClick={redo} disabled={!future.length} title="Ulangi (Ctrl+Y)" aria-label="Ulangi"><Icon name="redo" /></button>
          <span className="ed-sep" />
          <span className={`save-state ${dirty ? 'dirty' : ''}`} role="status">{saving ? 'Menyimpan…' : dirty ? 'Belum disimpan' : 'Tersimpan'}</span>
          <button className={`icon-btn light ed-drawer-btn ${drawer === 'right' ? 'on' : ''}`} onClick={() => setDrawer(drawer === 'right' ? null : 'right')} aria-label="Pengaturan elemen" aria-expanded={drawer === 'right'}><Icon name="layers" /></button>
          <button className="btn btn-ghost-light btn-sm" onClick={() => setPreview(true)} aria-label="Pratinjau"><Icon name="eye" size={15} /><span className="lbl">Pratinjau</span></button>
          <button className="btn btn-outline-light btn-sm" onClick={() => save()} disabled={saving || !dirty} aria-label="Simpan"><Icon name="save" size={15} /><span className="lbl">Simpan</span></button>
          {published
            ? <button className="btn btn-outline-light btn-sm" onClick={unpublish} aria-label="Batalkan terbit" title="Batalkan terbit"><Icon name="x" size={15} /><span className="lbl">Batalkan terbit</span></button>
            : <button className="btn btn-gold btn-sm" onClick={publish} disabled={saving}><Icon name="send" size={15} /><span className="lbl">Terbitkan</span></button>}
        </div>
      </header>
      {tips && (
        <div className="ed-tips" role="note">
          <Icon name="sparkles" size={16} />
          <span><b>Tips singkat:</b> klik elemen untuk mengubahnya, klik dua kali teks untuk mengetik, seret gambar dari komputer langsung ke halaman, lalu tekan <b>Terbitkan</b> bila sudah siap.</span>
          <button className="icon-btn light" onClick={closeTips} aria-label="Tutup tips"><Icon name="x" size={15} /></button>
        </div>
      )}
      <div className={`ed-body ${drawer ? 'drawer-' + drawer : ''}`}>
        {drawer && <div className="ed-scrim" onClick={() => setDrawer(null)} aria-hidden="true" />}
        <LeftPanel story={story} onAdd={addEl} onAddImage={addImage} onUploadFiles={uploadFiles} uploading={uploading} assetsVersion={assetsVersion} onAddPage={addPage} onRegen={() => setConfirmRegen(true)} activePage={page} onPatchPage={patchPage} />
        <div className="ed-center">
          <div className={`ed-ws ${dropping ? 'dropping' : ''}`} ref={wsRef} onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('.cv-wrap')) setSelId(null); }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } }} onDragLeave={() => setDropping(false)}
            onDrop={(e) => { e.preventDefault(); setDropping(false); uploadFiles(Array.from(e.dataTransfer.files)); }}>
            {dropping && <div className="drop-hint"><Icon name="upload" size={30} />Lepaskan gambar di sini</div>}
            <div className="ed-ws-in"><Canvas page={page} zoom={z} selId={selId} play={play} onSelect={setSelId} onPatch={(id, p, r) => patchEl(id, p, r)} onGesture={onGesture} onDup={dupEl} onDel={delEl} /></div>
          </div>
          <div className="ed-zoom">
            <button className="icon-btn" onClick={() => setZoom(Math.max(0.35, +(z - 0.1).toFixed(2)))} aria-label="Perkecil"><Icon name="minus" size={15} /></button>
            <button className="zoom-val" onClick={() => setZoom('fit')} title="Sesuaikan layar">{Math.round(z * 100)}%</button>
            <button className="icon-btn" onClick={() => setZoom(Math.min(2, +(z + 0.1).toFixed(2)))} aria-label="Perbesar"><Icon name="plus" size={15} /></button>
          </div>
          <div className="ed-strip">
            <div className="strip-tools">
              <span className="strip-label">Halaman {pi + 1} dari {doc.pages.length}</span>
              <button className="icon-btn" onClick={() => movePage(-1)} disabled={pi === 0} title="Geser halaman ke kiri" aria-label="Geser halaman ke kiri"><Icon name="left" size={16} /></button>
              <button className="icon-btn" onClick={() => movePage(1)} disabled={pi === doc.pages.length - 1} title="Geser halaman ke kanan" aria-label="Geser halaman ke kanan"><Icon name="right" size={16} /></button>
              <span className="strip-sep" />
              <button className="icon-btn" onClick={dupPage} title="Gandakan halaman" aria-label="Gandakan halaman"><Icon name="copy" size={16} /></button>
              <button className="icon-btn danger" onClick={() => setConfirmDelPage(true)} title="Hapus halaman" aria-label="Hapus halaman"><Icon name="trash" size={16} /></button>
            </div>
            <div className="strip-scroll">
              {doc.pages.map((p, i) => (
                <button key={p.id} className={`thumb ${i === pi ? 'on' : ''}`} onClick={() => { setPi(i); setSelId(null); }} aria-label={`Halaman ${i + 1}`} aria-current={i === pi}>
                  <div className="thumb-pg"><PageView page={p} editor /></div><span>{i === 0 ? 'Sampul' : i + 1}</span>
                </button>
              ))}
              <button className="thumb thumb-add" onClick={() => addPage('text')} aria-label="Tambah halaman"><div className="thumb-pg"><Icon name="plus" size={20} /></div><span>Tambah</span></button>
            </div>
          </div>
        </div>
        <RightPanel el={el} page={page} speed={doc.speed} onSpeed={(s) => commit({ ...doc, speed: s })} onPatch={(p, key) => el && patchEl(el.id, p, true, key)}
          onLayer={layer} onDup={dupEl} onDel={delEl} onPlay={() => el && setPlay({ key: Date.now(), id: el.id })} onPlayAll={() => setPlay({ key: Date.now() })}
          onPatchPage={patchPage} pageNo={pi + 1} pageCount={doc.pages.length} />
      </div>

      {preview && (
        <div className="preview-back" role="dialog" aria-modal="true" aria-label="Pratinjau buku">
          <div className="preview-bar"><b>Pratinjau: {story.title}</b><span className="muted-l">Perubahan yang belum disimpan ikut tampil di sini.</span><button className="btn btn-ghost-light btn-sm" onClick={() => setPreview(false)}><Icon name="x" size={15} />Tutup</button></div>
          <div className="preview-stage"><FlipBook pages={doc.pages} speed={doc.speed} /></div>
        </div>
      )}
      {confirmLeave && <Confirm title="Keluar tanpa menyimpan?" message="Ada perubahan yang belum disimpan. Kalau keluar sekarang, perubahan itu akan hilang." confirmLabel="Ya, keluar" danger onClose={() => setConfirmLeave(false)} onConfirm={() => { setConfirmLeave(false); navigate('/admin'); }} />}
      {confirmRegen && <Confirm title="Buat ulang draf?" message="Semua halaman saat ini akan diganti draf otomatis dari teks cerita. Kamu masih bisa mengurungkannya dengan Ctrl+Z." confirmLabel="Buat ulang" onClose={() => setConfirmRegen(false)} onConfirm={regen} />}
      {confirmDelPage && <Confirm title="Hapus halaman ini?" message={`Halaman ${pi + 1} beserta isinya akan dihapus. Kamu masih bisa mengurungkannya dengan Ctrl+Z.`} confirmLabel="Hapus halaman" danger onClose={() => setConfirmDelPage(false)} onConfirm={() => { delPage(); setConfirmDelPage(false); }} />}
    </div>
  );
}
