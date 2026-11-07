import { useEffect, useRef, useState } from 'react';
import type { Anim, AnimType, Asset, El, Page, Story } from '../types';
import { PAGE_H, PAGE_W } from '../types';
import { Icon, type IconName } from '../components/Icon';
import { api } from '../lib/api';
import { Confirm, useAsync } from '../components/ui';
import { useToast } from '../lib/toast';
import { mkShape, mkText } from '../lib/draft';
import { IMG_FILTERS } from '../components/PageView';

const STICKERS = ['kawung', 'bingkai', 'sulur', 'awan', 'matahari', 'bintang', 'gunung', 'daun', 'ombak'];
const ILLUS = ['malin-kundang', 'sangkuriang', 'timun-mas', 'danau-toba', 'cenderawasih', 'batu-menangis', 'asal-usul-danau-sentani'];
const FILTERS: { v: string; l: string }[] = [{ v: 'none', l: 'Asli' }, { v: 'grayscale', l: 'Hitam putih' }, { v: 'sepia', l: 'Sepia' }, { v: 'warm', l: 'Hangat' }, { v: 'vintage', l: 'Jadul' }, { v: 'bright', l: 'Cerah' }, { v: 'soft', l: 'Lembut' }];
const SWATCH = ['#FBF8F1', '#F3EFE6', '#FFFFFF', '#E9CB8F', '#C58B3A', '#6E1423', '#3D0A14', '#123C4A', '#1D4D3A', '#241519'];

type Tab = 'teks' | 'elemen' | 'gambar' | 'halaman';

const STICKER_LABEL: Record<string, string> = { kawung: 'Kawung', bingkai: 'Bingkai', sulur: 'Sulur', awan: 'Awan', matahari: 'Matahari', bintang: 'Bintang', gunung: 'Gunung', daun: 'Daun', ombak: 'Ombak' };
const illusLabel = (s: string) => s.replace(/-/g, ' ');
const match = (text: string, q: string) => !q.trim() || text.toLowerCase().includes(q.trim().toLowerCase());

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="ed-search">
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" className="ed-search-x" onClick={() => onChange('')} aria-label="Hapus pencarian"><Icon name="x" size={14} /></button>}
    </div>
  );
}

function Sec({ title, count, action, children }: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ed-sec">
      <header><h4>{title}{count !== undefined && <em>{count}</em>}</h4>{action}</header>
      {children}
    </section>
  );
}

/** Tab Gambar: mirip "Unggahan" di Canva (tombol unggah, kotak pencarian, grid 2 kolom, menu titik tiga, pilih banyak lalu hapus). */
function ImagesTab({ story, onAddImage, onUploadFiles, uploading, assetsVersion }: {
  story: Story; onAddImage: (src: string, alt?: string, fit?: number) => void; onUploadFiles: (files: File[]) => void; uploading: boolean; assetsVersion: number;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [over, setOver] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [menu, setMenu] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [ask, setAsk] = useState<{ ids: number[] } | { unused: true } | null>(null);
  const assets = useAsync(() => api.get<{ assets: Asset[] }>('admin/assets'), [assetsVersion]);
  const all = assets.data?.assets ?? [];
  const shown = all.filter((a) => match(a.original_name, q));
  const unused = all.filter((a) => !a.used);
  const illus = ILLUS.filter((s) => match(illusLabel(s), q));
  const selecting = sel.size > 0;

  useEffect(() => {
    if (menu === null) return;
    const close = (e: Event) => { if (!(e.target as HTMLElement).closest('.up-menu, .up-more')) setMenu(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    const shut = () => setMenu(null);
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    window.addEventListener('resize', shut); document.addEventListener('scroll', shut, true);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); window.removeEventListener('resize', shut); document.removeEventListener('scroll', shut, true); };
  }, [menu]);

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const gone = (ids: number[]) => assets.setData((d) => (d ? { assets: d.assets.filter((a) => !ids.includes(a.id)) } : d));

  const doDelete = async () => {
    if (!ask) return;
    try {
      if ('unused' in ask) {
        const r = await api.post<{ deleted: number }>('admin/assets/bulk-delete', { unused: true });
        toast(r.deleted ? `${r.deleted} gambar tak terpakai dihapus.` : 'Tidak ada gambar yang tidak terpakai.');
        assets.reload();
      } else if (ask.ids.length === 1) {
        await api.del(`admin/assets/${ask.ids[0]}`); gone(ask.ids); toast('Gambar dihapus dari unggahan.');
      } else {
        const r = await api.post<{ deleted: number }>('admin/assets/bulk-delete', { ids: ask.ids }); gone(ask.ids); toast(`${r.deleted} gambar dihapus dari unggahan.`);
      }
      setSel(new Set());
    } catch (e: any) {
      if (e?.status === 404) { assets.reload(); setSel(new Set()); } else toast(e.message, 'err');
    }
    setAsk(null);
  };
  const askUsed = ask && 'ids' in ask ? all.filter((a) => ask.ids.includes(a.id) && a.used).length : 0;
  const askText = !ask ? '' : 'unused' in ask
    ? `${unused.length} gambar yang belum dipakai di buku mana pun akan dihapus permanen dari unggahan dan server.`
    : ask.ids.length === 1
      ? (askUsed ? 'Gambar ini dipakai di buku, jadi buku tetap menampilkannya. Hanya hilang dari daftar unggahan.' : 'Gambar akan dihapus permanen dari unggahan dan server. Tindakan ini tidak dapat diurungkan.')
      : `${ask.ids.length} gambar akan dihapus dari unggahan.${askUsed ? ` ${askUsed} di antaranya dipakai di buku, dan tetap tampil di buku itu.` : ''} Tindakan ini tidak dapat diurungkan.`;

  return (
    <div className="ed-stack">
      <button type="button" className={`up-btn ${over ? 'over' : ''}`} disabled={uploading}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onUploadFiles(Array.from(e.dataTransfer.files)); }}>
        <Icon name="upload" size={18} />{uploading ? 'Mengunggah…' : 'Unggah file'}
      </button>
      <p className="up-hint">atau seret ke sini, atau tempel dengan Ctrl+V<br />JPG, PNG, WEBP, GIF · maks. 5 MB</p>
      <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { onUploadFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />

      <SearchBox value={q} onChange={setQ} placeholder="Cari gambar" />
      <div className="url-wrap">
        <button type="button" className="url-toggle" aria-expanded={urlOpen} onClick={() => setUrlOpen(!urlOpen)}><Icon name="link" size={15} />Tambah dari tautan<Icon name={urlOpen ? 'up' : 'down'} size={14} /></button>
        {urlOpen && (
          <form className="url-add" onSubmit={(e) => { e.preventDefault(); if (url.trim()) { onAddImage(url.trim()); setUrl(''); } }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="URL gambar" autoFocus />
            <button className="btn btn-primary btn-xs" disabled={!url.trim()}>Tambah</button>
          </form>
        )}
      </div>

      <Sec title="Unggahan" count={all.length || undefined}
        action={selecting ? <button type="button" className="sec-link" onClick={() => setSel(new Set(shown.map((a) => a.id)))}>Pilih semua</button> : unused.length > 0 ? <button type="button" className="sec-link danger" onClick={() => setAsk({ unused: true })} title="Hapus gambar yang tidak dipakai di buku mana pun">Bersihkan {unused.length} tak terpakai</button> : undefined}>
        {assets.loading && !assets.data && <div className="up-skel" aria-hidden="true"><i /><i /><i /><i /></div>}
        {assets.error && <p className="ed-help">Gagal memuat unggahan. <button type="button" className="link-btn" onClick={assets.reload}>Coba lagi</button></p>}
        {assets.data && all.length === 0 && (
          <div className="up-empty"><Icon name="image" size={22} /><b>Belum ada unggahan</b><span>Gambar yang kamu unggah muncul di sini dan bisa dipakai lagi.</span></div>
        )}
        {assets.data && all.length > 0 && shown.length === 0 && <p className="ed-help">Tidak ada gambar dengan nama “{q}”.</p>}
        <div className={`up-grid ${selecting ? 'selecting' : ''}`}>
          {shown.map((a) => (
            <div key={a.id} className={`up-tile ${sel.has(a.id) ? 'sel' : ''} ${menu === a.id ? 'menu-open' : ''}`}>
              <button type="button" className="up-img" onClick={() => (selecting ? toggle(a.id) : onAddImage(a.url, a.original_name))} title={selecting ? 'Pilih gambar' : `Tambahkan ke halaman: ${a.original_name}`}>
                <img src={a.url} alt={a.original_name} loading="lazy" draggable={false} />
              </button>
              <button type="button" className="up-check" role="checkbox" aria-checked={sel.has(a.id)} aria-label={`Pilih ${a.original_name}`} onClick={() => toggle(a.id)}><Icon name="check" size={13} /></button>
              <button type="button" className="up-more" aria-haspopup="menu" aria-expanded={menu === a.id} aria-label={`Menu ${a.original_name}`} onClick={(e) => {
                if (menu === a.id) return setMenu(null);
                const r = e.currentTarget.getBoundingClientRect();
                setMenuPos({ top: Math.min(r.bottom + 6, window.innerHeight - 160), left: Math.max(12, Math.min(r.right - 196, window.innerWidth - 208)) });
                setMenu(a.id);
              }}><Icon name="more" size={16} /></button>
              {a.used && <span className="up-used" title="Dipakai di buku">Dipakai</span>}
              {menu === a.id && (
                <div className="up-menu" role="menu" style={{ top: menuPos.top, left: menuPos.left }}>
                  <button role="menuitem" onClick={() => { setMenu(null); onAddImage(a.url, a.original_name); }}><Icon name="plus" size={15} />Tambah ke halaman</button>
                  <button role="menuitem" onClick={() => { setMenu(null); setSel(new Set([a.id])); }}><Icon name="check" size={15} />Pilih</button>
                  <button role="menuitem" className="danger" onClick={() => { setMenu(null); setAsk({ ids: [a.id] }); }}><Icon name="trash" size={15} />Hapus</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Sec>

      {story.image_url && match('dari pengajuan penulis', q) && (
        <Sec title="Dari pengajuan penulis">
          <div className="up-grid"><div className="up-tile"><button type="button" className="up-img" onClick={() => onAddImage(story.image_url!, `Ilustrasi ${story.title}`)} title="Tambahkan ke halaman"><img src={story.image_url} alt="Gambar dari penulis" draggable={false} /></button></div></div>
        </Sec>
      )}
      {illus.length > 0 && (
        <Sec title="Ilustrasi bawaan" count={illus.length}>
          <div className="thumb-grid">{illus.map((s) => <button key={s} className="tile" onClick={() => onAddImage(`illustrations/${s}.svg`, illusLabel(s))} title={illusLabel(s)}><img src={`illustrations/${s}.svg`} alt={illusLabel(s)} loading="lazy" draggable={false} /></button>)}</div>
        </Sec>
      )}

      {selecting && (
        <div className="sel-bar" role="toolbar" aria-label="Aksi untuk gambar terpilih">
          <b>{sel.size} dipilih</b>
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSel(new Set())}>Batal</button>
          <button type="button" className="btn btn-danger btn-xs" onClick={() => setAsk({ ids: [...sel] })}><Icon name="trash" size={14} />Hapus</button>
        </div>
      )}
      {ask && <Confirm danger title={'unused' in ask ? 'Bersihkan unggahan yang tak terpakai?' : ask.ids.length === 1 ? 'Hapus gambar ini?' : `Hapus ${ask.ids.length} gambar?`} message={askText} confirmLabel="Hapus" onClose={() => setAsk(null)} onConfirm={doDelete} />}
    </div>
  );
}

export function LeftPanel({ story, onAdd, onAddImage, onUploadFiles, uploading, assetsVersion, onAddPage, onRegen, activePage, onPatchPage }: {
  story: Story; onAdd: (el: El) => void; onAddImage: (src: string, alt?: string, fit?: number) => void;
  onUploadFiles: (files: File[]) => void; uploading: boolean; assetsVersion: number;
  onAddPage: (kind: 'cover' | 'text' | 'image' | 'quote' | 'blank') => void; onRegen: () => void;
  activePage: Page; onPatchPage: (patch: Partial<Page>) => void;
}) {
  const [tab, setTab] = useState<Tab>('gambar');
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState('');
  const pick = (t: Tab) => { if (t === tab) setOpen(!open); else { setTab(t); setOpen(true); setQ(''); } };

  const tabs: { id: Tab; icon: IconName; label: string }[] = [
    { id: 'teks', icon: 'type', label: 'Teks' }, { id: 'elemen', icon: 'sparkles', label: 'Elemen' },
    { id: 'gambar', icon: 'image', label: 'Gambar' }, { id: 'halaman', icon: 'file', label: 'Halaman' },
  ];
  const stickers = STICKERS.filter((s) => match(STICKER_LABEL[s], q));
  return (
    <aside className={`ed-left ${open ? '' : 'collapsed'}`}>
      <div className="ed-tabs" role="tablist" aria-orientation="vertical">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={open && tab === t.id} className={open && tab === t.id ? 'on' : ''} onClick={() => pick(t.id)}><Icon name={t.icon} size={22} /><span>{t.label}</span></button>)}
      </div>
      <div className="ed-left-body" role="tabpanel" hidden={!open}>
        {tab === 'teks' && (
          <div className="ed-stack">
            <button className="up-btn" onClick={() => onAdd(mkText('Ketuk dua kali untuk mengubah teks', 60, 220, 280, 40, { size: 20 }))}><Icon name="type" size={18} />Tambah kotak teks</button>
            <Sec title="Gaya teks bawaan">
              <div className="ed-stack tight">
                <button className="add-text t-h" onClick={() => onAdd(mkText('Judul bagian', 30, 80, 340, 50, { font: 'serif', size: 30, bold: true, lineHeight: 1.2 }))}>Tambah judul</button>
                <button className="add-text t-s" onClick={() => onAdd(mkText('Subjudul', 30, 140, 340, 30, { font: 'sans', size: 17, bold: true, color: '#6E1423' }))}>Tambah subjudul</button>
                <button className="add-text t-p" onClick={() => onAdd(mkText('Tulis paragraf di sini. Klik dua kali untuk mengubah teks.', 30, 200, 340, 120, { size: 16 }))}>Tambah paragraf</button>
                <button className="add-text t-q" onClick={() => onAdd(mkText('"Kutipan atau pesan penting."', 40, 240, 320, 90, { font: 'serif', size: 22, italic: true, align: 'center', lineHeight: 1.35, color: '#6E1423' }))}>Tambah kutipan</button>
              </div>
            </Sec>
            <p className="ed-help">Klik dua kali pada teks di halaman untuk mengetik langsung.</p>
          </div>
        )}
        {tab === 'elemen' && (
          <div className="ed-stack">
            <SearchBox value={q} onChange={setQ} placeholder="Cari elemen" />
            {match('bentuk persegi lingkaran garis', q) && (
              <Sec title="Bentuk">
                <div className="shape-grid">
                  <button className="tile" onClick={() => onAdd(mkShape(100, 200, 200, 140, '#C58B3A'))} aria-label="Persegi panjang" title="Persegi panjang"><span className="sh sh-rect" /></button>
                  <button className="tile" onClick={() => onAdd(mkShape(100, 200, 160, 160, '#6E1423', { radius: 24 }))} aria-label="Persegi membulat" title="Persegi membulat"><span className="sh sh-round" /></button>
                  <button className="tile" onClick={() => onAdd(mkShape(110, 200, 160, 160, '#E0A94A', { shape: 'circle' }))} aria-label="Lingkaran" title="Lingkaran"><span className="sh sh-circle" /></button>
                  <button className="tile" onClick={() => onAdd(mkShape(60, 260, 280, 4, '#C58B3A'))} aria-label="Garis" title="Garis"><span className="sh sh-line" /></button>
                </div>
              </Sec>
            )}
            {stickers.length > 0 && (
              <Sec title="Hiasan nusantara" count={stickers.length}>
                <div className="thumb-grid">
                  {stickers.map((s) => <button key={s} className="tile" onClick={() => onAddImage(`stickers/${s}.svg`, s, 160)} aria-label={`Hiasan ${STICKER_LABEL[s]}`} title={STICKER_LABEL[s]}><img src={`stickers/${s}.svg`} alt="" draggable={false} /></button>)}
                </div>
              </Sec>
            )}
            {q && !stickers.length && !match('bentuk persegi lingkaran garis', q) && <p className="ed-help">Tidak ada elemen untuk “{q}”.</p>}
          </div>
        )}
        {tab === 'gambar' && <ImagesTab story={story} onAddImage={onAddImage} onUploadFiles={onUploadFiles} uploading={uploading} assetsVersion={assetsVersion} />}
        {tab === 'halaman' && (
          <div className="ed-stack">
            <Sec title="Latar halaman ini">
              <div className="swatches">{SWATCH.map((c) => <button key={c} className={activePage.bg.toLowerCase() === c.toLowerCase() ? 'on' : ''} style={{ background: c }} onClick={() => onPatchPage({ bg: c })} aria-label={`Warna ${c}`} />)}
                <label className="swatch-custom" title="Warna lain"><input type="color" value={activePage.bg} onChange={(e) => onPatchPage({ bg: e.target.value })} /></label></div>
              {activePage.bgImage && <button className="link-btn" onClick={() => onPatchPage({ bgImage: undefined })}>Hapus gambar latar</button>}
            </Sec>
            <Sec title="Tambah halaman baru">
              <div className="tpl-grid">
                {([['cover', 'Sampul'], ['text', 'Teks'], ['image', 'Gambar'], ['quote', 'Pesan'], ['blank', 'Kosong']] as const).map(([k, l]) => <button key={k} className="tpl" onClick={() => onAddPage(k)}><span className={`tpl-ic tpl-${k}`} />{l}</button>)}
              </div>
            </Sec>
            <Sec title="Draf otomatis">
              <button className="btn btn-outline btn-block btn-sm" onClick={onRegen}><Icon name="wand" size={15} />Buat ulang dari teks cerita</button>
              <p className="ed-help">Mengganti seluruh halaman dengan draf baru dari teks cerita.</p>
            </Sec>
          </div>
        )}
      </div>
      <button type="button" className="ed-collapse" onClick={() => setOpen(!open)} aria-label={open ? 'Sembunyikan panel' : 'Tampilkan panel'} title={open ? 'Sembunyikan panel' : 'Tampilkan panel'}><Icon name={open ? 'left' : 'right'} size={14} /></button>
    </aside>
  );
}

const ANIMS: { v: AnimType; l: string }[] = [
  { v: 'none', l: 'Tanpa animasi' }, { v: 'fade', l: 'Memudar' }, { v: 'slideUp', l: 'Naik dari bawah' }, { v: 'slideDown', l: 'Turun dari atas' },
  { v: 'slideLeft', l: 'Masuk dari kanan' }, { v: 'slideRight', l: 'Masuk dari kiri' }, { v: 'zoom', l: 'Membesar' }, { v: 'bounce', l: 'Memantul' },
  { v: 'float', l: 'Melayang (berulang)' }, { v: 'pulse', l: 'Berdenyut (berulang)' }, { v: 'sway', l: 'Bergoyang (berulang)' },
];

function Num({ label, value, min, max, step = 1, onChange, unit }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="pf"><span>{label}</span>
      <div className="pf-num"><input type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v))); }} />{unit && <em>{unit}</em>}</div>
    </label>
  );
}

export function RightPanel({ el, page, speed, onSpeed, onPatch, onLayer, onDup, onDel, onPlay, onPlayAll, onPatchPage, pageNo, pageCount }: {
  el: El | null; page: Page; speed: 'fast' | 'normal' | 'slow'; onSpeed: (s: 'fast' | 'normal' | 'slow') => void;
  onPatch: (patch: Partial<El>, key?: string) => void; onLayer: (d: 1 | -1 | 'top' | 'bottom') => void; onDup: () => void; onDel: () => void;
  onPlay: () => void; onPlayAll: () => void; onPatchPage: (patch: Partial<Page>) => void; pageNo: number; pageCount: number;
}) {
  if (!el) {
    return (
      <aside className="ed-right">
        <h3>Halaman {pageNo}</h3>
        <p className="ed-help">Pilih elemen di halaman untuk mengubah teks, gambar, warna, dan animasinya.</p>
        <label className="pf"><span>Warna latar</span><div className="pf-color"><input type="color" value={page.bg} onChange={(e) => onPatchPage({ bg: e.target.value })} /><code>{page.bg}</code></div></label>
        <label className="pf"><span>Kecepatan balik halaman</span>
          <select value={speed} onChange={(e) => onSpeed(e.target.value as 'fast' | 'normal' | 'slow')}><option value="fast">Cepat</option><option value="normal">Normal</option><option value="slow">Pelan</option></select></label>
        <button className="btn btn-outline btn-block btn-sm" onClick={onPlayAll}><Icon name="play" size={15} />Putar animasi halaman ini</button>
        <p className="ed-help">{pageCount} halaman. Jumlah ganjil akan diberi halaman kosong di belakang saat dibaca.</p>
        <div className="ed-keys"><b>Pintasan</b><span>Ctrl+Z / Ctrl+Y: urungkan / ulangi</span><span>Ctrl+D: gandakan · Delete: hapus</span><span>Panah: geser 1 px (Shift: 10 px)</span><span>Ctrl+S: simpan</span></div>
      </aside>
    );
  }
  const k = (name: string) => `${el.id}:${name}`;
  const setAnim = (p: Partial<Anim>, key: string) => onPatch({ anim: { ...el.anim, ...p } } as Partial<El>, key);
  return (
    <aside className="ed-right">
      <div className="ed-right-head">
        <h3>{el.type === 'text' ? 'Teks' : el.type === 'image' ? 'Gambar' : 'Bentuk'}</h3>
        <div className="ed-ic-row">
          <button className="icon-btn" onClick={onDup} title="Gandakan (Ctrl+D)" aria-label="Gandakan"><Icon name="copy" size={16} /></button>
          <button className="icon-btn danger" onClick={onDel} title="Hapus (Delete)" aria-label="Hapus elemen"><Icon name="trash" size={16} /></button>
        </div>
      </div>

      {el.type === 'text' && (
        <section>
          <label className="pf"><span>Isi teks</span><textarea rows={5} value={el.text} onChange={(e) => onPatch({ text: e.target.value } as Partial<El>, k('text'))} /></label>
          <div className="pf-row">
            <label className="pf"><span>Jenis huruf</span><select value={el.font} onChange={(e) => onPatch({ font: e.target.value } as Partial<El>)}><option value="reading">Buku (serif)</option><option value="serif">Judul (Fraunces)</option><option value="sans">Modern (sans)</option></select></label>
            <Num label="Ukuran" value={el.size} min={8} max={200} onChange={(v) => onPatch({ size: v } as Partial<El>, k('size'))} />
          </div>
          <div className="pf-row">
            <label className="pf"><span>Warna</span><div className="pf-color"><input type="color" value={el.color} onChange={(e) => onPatch({ color: e.target.value } as Partial<El>, k('color'))} /></div></label>
            <Num label="Jarak baris" value={el.lineHeight} min={0.8} max={3} step={0.05} onChange={(v) => onPatch({ lineHeight: v } as Partial<El>, k('lh'))} />
          </div>
          <div className="seg-tools">
            <button className={el.bold ? 'on' : ''} onClick={() => onPatch({ bold: !el.bold } as Partial<El>)} aria-label="Tebal" aria-pressed={el.bold}><Icon name="bold" size={16} /></button>
            <button className={el.italic ? 'on' : ''} onClick={() => onPatch({ italic: !el.italic } as Partial<El>)} aria-label="Miring" aria-pressed={el.italic}><Icon name="italic" size={16} /></button>
            <span className="sep" />
            {(['left', 'center', 'right'] as const).map((a) => <button key={a} className={el.align === a ? 'on' : ''} onClick={() => onPatch({ align: a } as Partial<El>)} aria-label={`Rata ${a}`}><Icon name={a === 'left' ? 'alignl' : a === 'center' ? 'alignc' : 'alignr'} size={16} /></button>)}
          </div>
        </section>
      )}
      {el.type === 'image' && (
        <section>
          <label className="pf"><span>Teks alternatif (aksesibilitas)</span><input value={el.alt} onChange={(e) => onPatch({ alt: e.target.value } as Partial<El>, k('alt'))} placeholder="Jelaskan isi gambar" /></label>
          <label className="pf"><span>Penyesuaian gambar</span>
            <select value={el.fit ?? 'cover'} onChange={(e) => onPatch({ fit: e.target.value } as Partial<El>)}><option value="cover">Isi bingkai (potong tepi)</option><option value="contain">Muat seluruhnya</option><option value="fill">Regangkan</option></select></label>
          <div className="pf"><span>Balik</span>
            <div className="seg-tools"><button className={el.flipX ? 'on' : ''} onClick={() => onPatch({ flipX: !el.flipX } as Partial<El>)} aria-pressed={!!el.flipX}>Horizontal</button><button className={el.flipY ? 'on' : ''} onClick={() => onPatch({ flipY: !el.flipY } as Partial<El>)} aria-pressed={!!el.flipY}>Vertikal</button></div></div>
          <div className="pf"><span>Filter</span>
            <div className="filter-grid">{FILTERS.map((f) => (
              <button key={f.v} className={(el.filter ?? 'none') === f.v ? 'on' : ''} onClick={() => onPatch({ filter: f.v } as Partial<El>)}>
                <img src={el.src} alt="" style={{ filter: IMG_FILTERS[f.v] }} /><span>{f.l}</span></button>))}</div></div>
          <Num label="Sudut membulat" value={el.radius} min={0} max={500} onChange={(v) => onPatch({ radius: v } as Partial<El>, k('r'))} unit="px" />
          <button className="btn btn-outline btn-sm btn-block" onClick={() => onPatchPage({ bgImage: el.src })}>Jadikan latar halaman</button>
        </section>
      )}
      {el.type === 'shape' && (
        <section>
          <label className="pf"><span>Warna isi</span><div className="pf-color"><input type="color" value={el.fill} onChange={(e) => onPatch({ fill: e.target.value } as Partial<El>, k('fill'))} /><code>{el.fill}</code></div></label>
          {el.shape === 'rect' && <Num label="Sudut membulat" value={el.radius} min={0} max={500} onChange={(v) => onPatch({ radius: v } as Partial<El>, k('r'))} unit="px" />}
        </section>
      )}

      <section>
        <h4>Posisi dan ukuran</h4>
        <div className="align-row" role="group" aria-label="Ratakan ke halaman">
          <button title="Rata kiri halaman" onClick={() => onPatch({ x: 0 })}><Icon name="alignl" size={15} /></button>
          <button title="Tengah horizontal" onClick={() => onPatch({ x: Math.round((PAGE_W - el.w) / 2) })}><Icon name="alignc" size={15} /></button>
          <button title="Rata kanan halaman" onClick={() => onPatch({ x: PAGE_W - el.w })}><Icon name="alignr" size={15} /></button>
          <span className="sep" />
          <button title="Rata atas" onClick={() => onPatch({ y: 0 })}><Icon name="up" size={15} /></button>
          <button title="Tengah vertikal" onClick={() => onPatch({ y: Math.round((PAGE_H - el.h) / 2) })}><Icon name="minus" size={15} /></button>
          <button title="Rata bawah" onClick={() => onPatch({ y: PAGE_H - el.h })}><Icon name="down" size={15} /></button>
        </div>
        <div className="pf-row"><Num label="X" value={el.x} min={-2000} max={3000} onChange={(v) => onPatch({ x: v }, k('x'))} /><Num label="Y" value={el.y} min={-2000} max={3000} onChange={(v) => onPatch({ y: v }, k('y'))} /></div>
        <div className="pf-row"><Num label="Lebar" value={el.w} min={8} max={3000} onChange={(v) => onPatch({ w: v }, k('w'))} /><Num label="Tinggi" value={el.h} min={8} max={3000} onChange={(v) => onPatch({ h: v }, k('h'))} /></div>
        <div className="pf-row"><Num label="Putar" value={el.rotation} min={-360} max={360} onChange={(v) => onPatch({ rotation: v }, k('rot'))} unit="°" />
          <label className="pf"><span>Transparansi</span><input type="range" min={0.05} max={1} step={0.05} value={el.opacity} onChange={(e) => onPatch({ opacity: Number(e.target.value) }, k('op'))} aria-label="Opasitas" /></label></div>
        <label className="check-row"><input type="checkbox" checked={!!el.shadow} onChange={(e) => onPatch({ shadow: e.target.checked })} />Bayangan</label>
        <div className="layer-row">
          <button className="btn btn-outline btn-xs" onClick={() => onLayer('top')}>Ke depan</button><button className="btn btn-outline btn-xs" onClick={() => onLayer(1)}>Maju</button>
          <button className="btn btn-outline btn-xs" onClick={() => onLayer(-1)}>Mundur</button><button className="btn btn-outline btn-xs" onClick={() => onLayer('bottom')}>Ke belakang</button>
        </div>
      </section>

      <section>
        <h4>Animasi</h4>
        <label className="pf"><span>Efek saat halaman terbuka</span>
          <select value={el.anim.type} onChange={(e) => setAnim({ type: e.target.value as AnimType }, k('at'))}>{ANIMS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></label>
        {el.anim.type !== 'none' && (
          <>
            <div className="pf-row">
              <Num label="Durasi" value={el.anim.duration} min={0.1} max={10} step={0.1} unit="dtk" onChange={(v) => setAnim({ duration: v }, k('ad'))} />
              <Num label="Tunda" value={el.anim.delay} min={0} max={10} step={0.1} unit="dtk" onChange={(v) => setAnim({ delay: v }, k('adl'))} />
            </div>
            <button className="btn btn-gold btn-sm btn-block" onClick={onPlay}><Icon name="play" size={15} />Putar animasi</button>
          </>
        )}
      </section>
    </aside>
  );
}
