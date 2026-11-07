const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
/** 1280 -> "1,3 rb"; 2400000 -> "2,4 jt" */
export const fmtViews = (n?: number) => compact.format(n ?? 0);

/** Waktu relatif singkat dalam bahasa Indonesia. */
export function timeAgo(s?: string | null): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) return s;
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'baru saja';
  if (sec < 3600) return `${Math.floor(sec / 60)} menit lalu`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} jam lalu`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
