import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import type { StoryStatus } from '../types';
import { autoCoverUrl } from '../lib/autoCover';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    fn().then((d) => { if (id === seq.current) { setData(d); setError(null); } })
      .catch((e) => { if (id === seq.current) setError(e?.message ?? 'Terjadi kesalahan.'); })
      .finally(() => { if (id === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  // Segarkan diam-diam (tanpa spinner/galat) agar data baru muncul tanpa memuat ulang halaman.
  const refresh = useCallback(() => {
    const id = seq.current;
    fn().then((d) => { if (id === seq.current) { setData(d); setError(null); } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, loading, reload: run, refresh, setData };
}

/** Memanggil `fn` tiap `ms` milidetik selama tab terlihat, dan saat tab kembali dibuka. */
export function useAutoRefresh(fn: () => void, ms = 30000) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') ref.current(); };
    const t = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [ms]);
}

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return <div className="spinner" role="status"><span className="spin" /><span>{label}</span></div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty empty-err" role="alert">
      <Icon name="alert" size={28} />
      <h3>Data belum dapat dimuat</h3>
      <p>{message}</p>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}

export function Empty({ icon = 'book', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-ic"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

const STATUS: Record<StoryStatus, { label: string; icon: IconName; cls: string }> = {
  pending: { label: 'Menunggu persetujuan', icon: 'clock', cls: 'st-pending' },
  approved: { label: 'Disetujui, menunggu diterbitkan', icon: 'check', cls: 'st-approved' },
  published: { label: 'Terbit', icon: 'book', cls: 'st-published' },
  rejected: { label: 'Ditolak', icon: 'x', cls: 'st-rejected' },
};
export function StatusBadge({ status }: { status: StoryStatus }) {
  const s = STATUS[status];
  return <span className={`badge ${s.cls}`}><Icon name={s.icon} size={13} />{s.label}</span>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  // Dirender ke <body> supaya tidak mewarisi warna/gaya induknya (mis. teks putih di hero gelap).
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Tutup"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ title, message, confirmLabel, danger, onConfirm, onClose }: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Batal</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export const PROVINCE_COLOR: Record<string, string> = {
  Jawa: '#C98A0B', Sumatera: '#2F8466', Kalimantan: '#2D7AA8', Sulawesi: '#A4507F',
  'Bali dan Nusa Tenggara': '#CB6538', Maluku: '#3F7089', Papua: '#5D4D9C',
};
export const provinceColor = (p: string) => PROVINCE_COLOR[p] ?? '#7A5A3C';

export function Cover({ src, alt, province, title }: { src: string | null; alt: string; province?: string; title?: string }) {
  // Tanpa gambar unggahan: tampilkan sampul ilustrasi otomatis (bukan kotak polos).
  const url = useMemo(() => src || autoCoverUrl({ title: title ?? alt.replace(/^Sampul\s+/, ''), province }), [src, title, alt, province]);
  return (
    <span className="cover-fit">
      <img className="cover-bg" src={url} alt="" aria-hidden="true" loading="lazy" />
      <img className="cover-main" src={url} alt={alt} loading="lazy" />
    </span>
  );
}
