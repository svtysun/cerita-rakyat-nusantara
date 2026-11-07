export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const BASE = 'api/';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(BASE + 'index.php?r=' + path, init);
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi, lalu coba lagi.');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* bukan JSON */ }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? (res.status >= 500 ? 'Terjadi kesalahan pada server.' : 'Permintaan gagal.'));
  }
  if (data === null) throw new ApiError(500, 'Server tidak memberi respons yang valid. Pastikan API PHP berjalan.');
  return data as T;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? '&' + p.join('&') : '';
};

export const api = {
  get: <T,>(path: string, params: Record<string, string | number | undefined> = {}) => request<T>('GET', path + qs(params)),
  post: <T,>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T,>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T,>(path: string) => request<T>('DELETE', path),
  upload: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>('POST', 'upload', fd);
  },
};

/** Alamat gambar relatif (illustrations/..., api/uploads/...) dipetakan relatif ke halaman. */
export const imgUrl = (u?: string | null) => (u ? u : '');

export const fmtDate = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
