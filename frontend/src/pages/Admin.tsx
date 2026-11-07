import { createContext, useContext, useEffect, useState } from 'react';
import { api, fmtDate } from '../lib/api';
import { ROLE_LABEL, type AdminLog, type AdminLogsRes, type AdminStats, type AdminUser, type Story, type StoryRequest, type StoryStatus } from '../types';
import { Link, navigate, useLocation } from '../lib/router';
import { Icon, type IconName } from '../components/Icon';
import { Confirm, Cover, Empty, ErrorBox, Modal, Spinner, StatusBadge, useAsync } from '../components/ui';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { fmtViews, timeAgo } from '../lib/format';

export const AdminCtx = createContext<{ stats: AdminStats | null; reload: () => void }>({ stats: null, reload: () => {} });
export const useAdminCtx = () => useContext(AdminCtx);

function Stat({ icon, n, label, tone, to }: { icon: IconName; n: number; label: string; tone: string; to?: string }) {
  const inner = <><span className="stat-ic"><Icon name={icon} size={20} /></span><div><b>{n}</b><small>{label}</small></div></>;
  return to ? <Link to={to} className={`stat stat-${tone} stat-link`}>{inner}</Link> : <div className={`stat stat-${tone}`}>{inner}</div>;
}

type TodoKind = 'pending' | 'publish' | 'design';
const TODO_LABEL: Record<TodoKind, { text: string; cls: string }> = {
  pending: { text: 'Menunggu persetujuan', cls: 'st-pending' },
  publish: { text: 'Siap diterbitkan', cls: 'st-published' },
  design: { text: 'Perlu didesain', cls: 'st-approved' },
};
const TODO_MAX = 6;

export function AdminHome() {
  const { stats: s, reload } = useAdminCtx();
  const toast = useToast();
  const list = useAsync(() => api.get<{ stories: Story[] }>('admin/stories'), []);
  const stories = list.data?.stories ?? [];
  const todo: { kind: TodoKind; story: Story }[] = [
    ...stories.filter((x) => x.status === 'pending').map((story) => ({ kind: 'pending' as const, story })),
    ...stories.filter((x) => x.status === 'approved' && x.has_flipbook).map((story) => ({ kind: 'publish' as const, story })),
    ...stories.filter((x) => x.status === 'approved' && !x.has_flipbook).map((story) => ({ kind: 'design' as const, story })),
  ];
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok); list.reload(); reload(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const nReq = s?.requests ?? 0;
  const empty = !!list.data && todo.length === 0 && nReq === 0;
  return (
    <>
      <div className="stats stats-6">
        <Stat icon="book" n={s?.total ?? 0} label="Total cerita" tone="brand" to="/admin/cerita" />
        <Stat icon="clock" n={s?.pending ?? 0} label="Menunggu" tone="amber" to="/admin/cerita?status=pending" />
        <Stat icon="layers" n={s?.approved ?? 0} label="Perlu desain" tone="blue" to="/admin/cerita?status=approved" />
        <Stat icon="check" n={s?.published ?? 0} label="Terbit" tone="green" to="/admin/cerita?status=published" />
        <Stat icon="x" n={s?.rejected ?? 0} label="Ditolak" tone="red" to="/admin/cerita?status=rejected" />
        <Stat icon="users" n={(s?.users ?? 0) + (s?.reviewers ?? 0)} label="Akun" tone="rose" to={isAdmin ? '/admin/pengguna' : undefined} />
      </div>

      <section className="panel todo-panel" aria-labelledby="todo-h">
        <div className="section-head"><h3 id="todo-h"><Icon name="flame" size={18} />Perlu dikerjakan{todo.length + nReq > 0 && <span className="todo-count">{todo.length + (nReq > 0 ? 1 : 0)}</span>}</h3>
          <Link to="/admin/cerita" className="btn btn-outline btn-xs">Semua cerita</Link></div>
        {list.loading && !list.data && <Spinner />}
        {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
        {empty && <p className="todo-clear"><span><Icon name="check" size={16} /></span>Semua sudah beres. Tidak ada cerita atau permintaan yang menunggu.</p>}
        <ul className="todo-list">
          {nReq > 0 && (
            <li className="todo-req"><div><b>{nReq} permintaan dari penulis</b><small>Edit atau hapus cerita yang sudah disetujui</small></div>
              <div className="card-actions"><Link to="/admin/permintaan" className="btn btn-primary btn-xs"><Icon name="file" size={14} />Tinjau permintaan</Link></div></li>
          )}
          {todo.slice(0, TODO_MAX).map(({ kind, story: st }) => (
            <li key={`${kind}-${st.id}`}>
              <div><b>{st.title}</b><small><span className={`badge ${TODO_LABEL[kind].cls}`}>{TODO_LABEL[kind].text}</span> {st.region} · oleh {st.owner_name}</small></div>
              <div className="card-actions">
                {kind === 'pending' && <>
                  <Link to={`/cerita/${st.id}`} className="btn btn-outline btn-xs"><Icon name="eye" size={14} />Baca</Link>
                  <button className="btn btn-success btn-xs" onClick={() => act(() => api.post(`admin/stories/${st.id}/approve`), 'Cerita disetujui.')}><Icon name="check" size={14} />Setujui</button>
                </>}
                {kind === 'publish' && <>
                  <Link to={`/admin/editor/${st.id}`} className="btn btn-outline btn-xs"><Icon name="layers" size={14} />Editor</Link>
                  <button className="btn btn-gold btn-xs" onClick={() => act(() => api.post(`admin/stories/${st.id}/publish`), 'Cerita diterbitkan.')}><Icon name="send" size={14} />Terbitkan</button>
                </>}
                {kind === 'design' && <Link to={`/admin/editor/${st.id}`} className="btn btn-primary btn-xs"><Icon name="layers" size={14} />Buka editor</Link>}
              </div>
            </li>
          ))}
        </ul>
        {todo.length > TODO_MAX && <p className="todo-more muted">dan {todo.length - TODO_MAX} lainnya. <Link to="/admin/cerita?status=pending">Lihat di Kelola cerita</Link></p>}
      </section>

      <div className="admin-grid">
        <PopularPanel />
        {isAdmin && <RecentPanel />}
      </div>
    </>
  );
}

function RecentPanel() {
  const { data, loading, error } = useAsync(() => api.get<AdminLogsRes>('admin/logs', { limit: 5 }), []);
  return (
    <section className="panel">
      <div className="section-head"><h3><Icon name="clock" size={18} />Aktivitas terbaru</h3><Link to="/admin/log" className="btn btn-outline btn-xs">Lihat log</Link></div>
      {loading && !data && <Spinner />}
      {error && <p className="err">{error}</p>}
      {data && data.logs.length === 0 && <Empty icon="clock" title="Belum ada aktivitas">Tindakan admin dan reviewer akan tercatat di sini.</Empty>}
      {data && data.logs.length > 0 && <ul className="log-list log-compact">{data.logs.map((l) => <LogRow key={l.id} l={l} />)}</ul>}
    </section>
  );
}

function PopularPanel() {
  const { data, loading } = useAsync(() => api.get<{ stories: Story[] }>('stories', { sort: 'popular', limit: 5 }), []);
  const top = Math.max(1, ...(data?.stories.map((x) => x.views ?? 0) ?? [1]));
  return (
    <section className="panel">
      <div className="section-head"><h3><Icon name="flame" size={18} />Paling banyak dibaca</h3></div>
      {loading && !data && <Spinner />}
      {data && data.stories.length === 0 && <Empty icon="book" title="Belum ada buku terbit">Peringkat muncul setelah ada buku yang dibaca.</Empty>}
      <ol className="pop-rank">
        {data?.stories.map((st, i) => (
          <li key={st.id}><span className="pr-n">{i + 1}</span><div><Link to={`/cerita/${st.id}`}><b>{st.title}</b></Link><small>{st.category} · {st.region}</small><span className="pr-bar"><span style={{ width: `${((st.views ?? 0) / top) * 100}%` }} /></span></div><em>{fmtViews(st.views)}<small>dibaca</small></em></li>
        ))}
      </ol>
    </section>
  );
}

const FILTERS: { v: '' | StoryStatus; l: string }[] = [
  { v: '', l: 'Semua' }, { v: 'pending', l: 'Menunggu' }, { v: 'approved', l: 'Disetujui' }, { v: 'published', l: 'Terbit' }, { v: 'rejected', l: 'Ditolak' },
];

function useDebounced<T>(value: T, ms = 300): T {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return d;
}

function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="input-ic adm-search">
      <Icon name="search" size={16} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
      {value && <button type="button" className="icon-btn" onClick={() => onChange('')} aria-label="Hapus pencarian"><Icon name="x" size={14} /></button>}
    </div>
  );
}

const ADM_PROVINCES = ['Sumatera', 'Jawa', 'Kalimantan', 'Sulawesi', 'Bali dan Nusa Tenggara', 'Maluku', 'Papua'];
const ADM_CATEGORIES = ['Legenda', 'Fabel', 'Dongeng', 'Mitos'];

export function StoriesTab() {
  const { reload: onChange } = useAdminCtx();
  const toast = useToast();
  const { query } = useLocation();
  const filter = (query.get('status') ?? '') as '' | StoryStatus;
  const setFilter = (v: '' | StoryStatus) => navigate('/admin/cerita' + (v ? '?status=' + v : ''));
  const [q, setQ] = useState('');
  const [prov, setProv] = useState('');
  const [cat, setCat] = useState('');
  const dq = useDebounced(q.trim());
  const hasFilter = !!(dq || prov || cat);
  const list = useAsync(() => api.get<{ stories: Story[] }>('admin/stories', { status: filter, q: dq, province: prov, category: cat }), [filter, dq, prov, cat]);
  const [rej, setRej] = useState<Story | null>(null);
  const [reason, setReason] = useState('');
  const [del, setDel] = useState<Story | null>(null);
  const done = () => { list.reload(); onChange(); };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); done(); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <div className="panel">
      <div className="adm-tools">
        <SearchBox value={q} onChange={setQ} placeholder="Cari judul, daerah, atau nama penulis…" label="Cari cerita" />
        <select value={prov} onChange={(e) => setProv(e.target.value)} aria-label="Filter pulau"><option value="">Semua pulau</option>{ADM_PROVINCES.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter kategori"><option value="">Semua kategori</option>{ADM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="chips-row">{FILTERS.map((f) => <button key={f.v} className={`chip-btn ${filter === f.v ? 'on' : ''}`} onClick={() => setFilter(f.v)}>{f.l}</button>)}</div>
      <div className="adm-count" role="status">
        {list.data && <span>{list.data.stories.length} cerita{hasFilter ? ' cocok' : ''}</span>}
        {hasFilter && <button type="button" className="link-btn" onClick={() => { setQ(''); setProv(''); setCat(''); }}>Atur ulang pencarian</button>}
      </div>
      {list.loading && !list.data && <Spinner />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && list.data.stories.length === 0 && <Empty title={hasFilter ? 'Tidak ada cerita yang cocok' : 'Tidak ada cerita pada filter ini'}>{hasFilter ? 'Coba kata kunci lain atau atur ulang filter.' : undefined}</Empty>}
      <div className="admin-list">
        {list.data?.stories.map((s) => (
          <div key={s.id} className="admin-row">
            <div className="ar-thumb"><Cover src={s.image_url} alt="" province={s.province} title={s.title} /></div>
            <div className="ar-main">
              <div className="ar-title"><b>{s.title}</b><StatusBadge status={s.status} /></div>
              <p className="muted">{s.region}, {s.province} · oleh {s.owner_name} · {fmtDate(s.created_at)}</p>
              <div className="card-actions">
                <Link to={`/cerita/${s.id}`} className="btn btn-outline btn-xs"><Icon name="eye" size={14} />Lihat</Link>
                {s.status === 'pending' && <>
                  <button className="btn btn-success btn-xs" onClick={() => act(() => api.post(`admin/stories/${s.id}/approve`), 'Cerita disetujui.')}><Icon name="check" size={14} />Setujui</button>
                  <button className="btn btn-outline-warn btn-xs" onClick={() => { setRej(s); setReason(''); }}><Icon name="x" size={14} />Tolak</button>
                </>}
                {s.status === 'rejected' && <button className="btn btn-success btn-xs" onClick={() => act(() => api.post(`admin/stories/${s.id}/approve`), 'Cerita disetujui.')}><Icon name="check" size={14} />Setujui</button>}
                {(s.status === 'approved' || s.status === 'published') && <Link to={`/admin/editor/${s.id}`} className="btn btn-primary btn-xs"><Icon name="layers" size={14} />Editor flipbook</Link>}
                {s.status === 'approved' && s.has_flipbook && <button className="btn btn-gold btn-xs" onClick={() => act(() => api.post(`admin/stories/${s.id}/publish`), 'Cerita diterbitkan.')}><Icon name="send" size={14} />Terbitkan</button>}
                {s.status === 'published' && <>
                  <Link to={`/baca/${s.id}`} className="btn btn-outline btn-xs"><Icon name="book" size={14} />Baca buku</Link>
                  <button className="btn btn-outline-warn btn-xs" onClick={() => act(() => api.post(`admin/stories/${s.id}/unpublish`), 'Penerbitan dibatalkan.')}>Batalkan terbit</button>
                </>}
                <button className="btn btn-outline-danger btn-xs" onClick={() => setDel(s)}><Icon name="trash" size={14} />Hapus</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {rej && (
        <Modal title="Tolak cerita" onClose={() => setRej(null)}>
          <p className="muted">Beri alasan agar penulis tahu apa yang perlu diperbaiki.</p>
          <label className="field"><span>Alasan penolakan</span><textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setRej(null)}>Batal</button>
            <button className="btn btn-danger" disabled={reason.trim().length < 5} onClick={() => act(() => api.post(`admin/stories/${rej.id}/reject`, { reason }), 'Cerita ditolak.').then(() => setRej(null))}>Tolak cerita</button></div>
        </Modal>
      )}
      {del && <Confirm title="Hapus cerita?" message={`Cerita "${del.title}" beserta flipbook dan favoritnya akan dihapus permanen.`} confirmLabel="Hapus" danger onClose={() => setDel(null)}
        onConfirm={async () => { await act(() => api.del('admin/stories/' + del.id), 'Cerita dihapus.'); setDel(null); }} />}
    </div>
  );
}

export function RequestsTab() {
  const { reload: onChange } = useAdminCtx();
  const toast = useToast();
  const list = useAsync(() => api.get<{ requests: StoryRequest[] }>('admin/requests'), []);
  const resolve = async (r: StoryRequest, decision: 'approve' | 'reject') => {
    try { await api.post(`admin/requests/${r.id}/resolve`, { decision }); toast(decision === 'approve' ? 'Permintaan disetujui.' : 'Permintaan ditolak.'); list.reload(); onChange(); }
    catch (e: any) { toast(e.message, 'err'); }
  };
  return (
    <div className="panel">
      {list.loading && !list.data && <Spinner />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && list.data.requests.length === 0 && <Empty icon="file" title="Tidak ada permintaan">Permintaan edit atau hapus dari penulis akan muncul di sini.</Empty>}
      <div className="admin-list">
        {list.data?.requests.map((r) => (
          <div key={r.id} className="admin-row">
            <div className="ar-main">
              <div className="ar-title"><b>{r.title}</b><span className={`badge ${r.request_type === 'delete' ? 'st-rejected' : 'st-approved'}`}>{r.request_type === 'delete' ? 'Permintaan hapus' : 'Permintaan edit'}</span></div>
              <p className="muted">Dari {r.user_name} · {fmtDate(r.created_at)}</p>
              <p className="req-reason">"{r.reason}"</p>
              <div className="card-actions">
                <button className="btn btn-success btn-xs" onClick={() => resolve(r, 'approve')}><Icon name="check" size={14} />{r.request_type === 'delete' ? 'Setujui dan hapus' : 'Setujui'}</button>
                <button className="btn btn-outline-warn btn-xs" onClick={() => resolve(r, 'reject')}><Icon name="x" size={14} />Tolak</button>
                <Link to={`/cerita/${r.story_id}`} className="btn btn-outline btn-xs"><Icon name="eye" size={14} />Lihat cerita</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: AdminUser['role'] }) {
  return <span className={`role-badge role-${role}`}><Icon name={role === 'user' ? 'users' : 'shield'} size={12} />{ROLE_LABEL[role]}</span>;
}

type UserTab = 'reviewer' | 'pengguna';

export function UsersTab() {
  const { reload: onChange } = useAdminCtx();
  const toast = useToast();
  const { user: me } = useAuth();
  const list = useAsync(() => api.get<{ users: AdminUser[] }>('admin/users'), []);
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [del, setDel] = useState<AdminUser | null>(null);
  const [roleFor, setRoleFor] = useState<{ u: AdminUser; role: 'reviewer' | 'user' } | null>(null);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [temp, setTemp] = useState<{ password: string; name: string; email: string } | null>(null);
  const [tab, setTab] = useState<UserTab>('reviewer');
  const [q, setQ] = useState('');
  const all = list.data?.users ?? [];
  const term = q.trim().toLowerCase();
  const match = (u: AdminUser) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  const reviewers = all.filter((u) => u.role === 'reviewer' && match(u));
  const nReviewer = all.filter((u) => u.role === 'reviewer').length;
  const users = all.filter((u) => u.role === 'user' && match(u));
  const nUser = all.filter((u) => u.role === 'user').length;
  const create = async () => {
    try { await api.post('admin/reviewers', f); toast('Akun reviewer dibuat.'); setAdd(false); setF({ name: '', email: '', password: '' }); list.reload(); onChange(); }
    catch (e: any) { toast(e.message, 'err'); }
  };
  const Row = ({ u }: { u: AdminUser }) => (
    <li className={`user-row user-${u.role}`}>
      <span className="avatar">{u.name.slice(0, 1).toUpperCase()}</span>
      <div>
        <div className="user-name"><b>{u.name}</b><RoleBadge role={u.role} />{u.id === me?.id && <span className="badge st-approved">Kamu</span>}</div>
        <small>{u.email} · {u.stories} cerita · bergabung {fmtDate(u.created_at)}</small>
      </div>
      <div className="user-actions">
        {u.role !== 'user' && <Link to={`/admin/log?admin=${u.id}`} className="btn btn-outline btn-xs"><Icon name="clock" size={13} />Aktivitas</Link>}
        {u.id !== me?.id && <button className="btn btn-outline btn-xs" onClick={() => setResetFor(u)} title="Buat password sementara untuk akun ini"><Icon name="shield" size={13} />Reset password</button>}
        {u.role !== 'admin' && u.id !== me?.id && <button className="icon-btn danger" aria-label={`Hapus akun ${u.name}`} onClick={() => setDel(u)}><Icon name="trash" size={16} /></button>}
      </div>
    </li>
  );
  return (
    <div className="panel">
      <div className="adm-tools adm-tools-users">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama atau email…" label="Cari akun" />
        {tab === 'reviewer' && <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}><Icon name="plus" size={15} />Tambah reviewer baru</button>}
      </div>
      <p className="mail-tip"><Icon name="shield" size={14} /> Hanya ada <b>satu admin</b> (kamu). <b>Reviewer/publisher</b> hanya mengelola cerita: menyetujui, menolak, mendesain, dan menerbitkan.</p>
      <div className="chips-row" role="tablist" aria-label="Jenis akun">
        {([{ v: 'reviewer', l: 'Reviewer', n: nReviewer }, { v: 'pengguna', l: 'Pengguna', n: nUser }] as { v: UserTab; l: string; n: number }[]).map((t) => <button key={t.v} role="tab" aria-selected={tab === t.v} className={`chip-btn ${tab === t.v ? 'on' : ''}`} onClick={() => setTab(t.v)}>{t.l}<em className="chip-n">{t.n}</em></button>)}
      </div>
      {list.loading && !list.data && <Spinner />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && tab === 'reviewer' && (
        <section className="user-group">
          <div className="section-head"><div><h3><Icon name="check" size={18} />Reviewer / publisher</h3><p className="muted">{reviewers.length}{term ? ` dari ${nReviewer}` : ''} akun · bisa menyetujui, mendesain, dan menerbitkan cerita</p></div></div>
          {reviewers.length === 0 ? <p className="muted">{term ? 'Tidak ada reviewer yang cocok.' : 'Belum ada reviewer. Tambahkan akun baru atau jadikan pengguna sebagai reviewer.'}</p> : <ul className="user-list">{reviewers.map((u) => <Row key={u.id} u={u} />)}</ul>}
        </section>
      )}
      {list.data && tab === 'pengguna' && (
        <section className="user-group">
          <div className="section-head"><div><h3><Icon name="users" size={18} />Pengguna</h3><p className="muted">{users.length}{term ? ` dari ${nUser}` : ''} akun · penulis dan pembaca biasa. Admin bisa melihat datanya dan mereset password.</p></div></div>
          {users.length === 0 ? <p className="muted">{term ? 'Tidak ada pengguna yang cocok.' : 'Belum ada pengguna biasa.'}</p> : <ul className="user-list">{users.map((u) => <Row key={u.id} u={u} />)}</ul>}
        </section>
      )}
      {add && (
        <Modal title="Tambah reviewer baru" onClose={() => setAdd(false)}>
          <label className="field"><span>Nama</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="field"><span>Email</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="field"><span>Password (min. 8 karakter)</span><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></label>
          <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setAdd(false)}>Batal</button><button className="btn btn-primary" onClick={create}>Buat akun reviewer</button></div>
        </Modal>
      )}
      {roleFor && <Confirm title={roleFor.role === 'reviewer' ? 'Jadikan reviewer?' : 'Jadikan pengguna biasa?'}
        message={roleFor.role === 'reviewer'
          ? `${roleFor.u.name} akan bisa menyetujui, menolak, mendesain, dan menerbitkan cerita. Ia tidak bisa mengelola akun, log, atau pengaturan.`
          : `${roleFor.u.name} kehilangan akses ke panel pengelolaan cerita dan kembali menjadi pengguna biasa. Ceritanya tetap ada.`}
        confirmLabel={roleFor.role === 'reviewer' ? 'Jadikan reviewer' : 'Jadikan pengguna'} onClose={() => setRoleFor(null)}
        onConfirm={async () => { const r = roleFor; try { await api.post(`admin/users/${r.u.id}/role`, { role: r.role }); toast('Peran akun diperbarui.'); setRoleFor(null); list.reload(); onChange(); } catch (e: any) { toast(e.message, 'err'); setRoleFor(null); } }} />}
      {resetFor && <Confirm title="Reset password akun ini?" message={`Password lama ${resetFor.name} (${resetFor.email}) langsung tidak berlaku, dan sistem membuat password sementara yang tampil satu kali untukmu. Berikan ke pemiliknya lewat jalur yang aman, lalu minta ia menggantinya di menu Profil.`} confirmLabel="Buat password sementara" onClose={() => setResetFor(null)}
        onConfirm={async () => { const u = resetFor; try { const r = await api.post<{ password: string; name: string; email: string }>(`admin/users/${u.id}/reset-password`); setResetFor(null); setTemp(r); } catch (e: any) { toast(e.message, 'err'); setResetFor(null); } }} />}
      {temp && (
        <Modal title="Password sementara" onClose={() => setTemp(null)}>
          <p className="muted">Untuk <b>{temp.name}</b> ({temp.email}). Password ini hanya tampil sekarang dan tidak bisa dilihat lagi.</p>
          <div className="share-copy temp-pw"><input readOnly value={temp.password} onFocus={(e) => e.currentTarget.select()} aria-label="Password sementara" />
            <button type="button" className="btn btn-primary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(temp.password); toast('Password disalin.'); } catch { toast('Salin manual dengan Ctrl+C.', 'err'); } }}><Icon name="link" size={14} />Salin</button></div>
          <p className="mail-tip">Setelah masuk dengan password ini, pemilik akun sebaiknya segera menggantinya lewat <b>Profil saya</b>.</p>
          <div className="modal-actions"><button className="btn btn-primary" onClick={() => setTemp(null)}>Selesai</button></div>
        </Modal>
      )}
      {del && <Confirm title="Hapus akun?" message={`Akun ${del.name} (${ROLE_LABEL[del.role].toLowerCase()}) dan seluruh ceritanya akan dihapus permanen.`} confirmLabel="Hapus akun" danger onClose={() => setDel(null)}
        onConfirm={async () => { try { await api.del('admin/users/' + del.id); toast('Akun dihapus.'); setDel(null); list.reload(); onChange(); } catch (e: any) { toast(e.message, 'err'); } }} />}
    </div>
  );
}

/* ---------- Log aktivitas admin ---------- */

const LOG_ACTIONS: Record<string, { verb: string; icon: IconName; tone: 'ok' | 'bad' | 'warn' | 'info' }> = {
  'story.approve': { verb: 'menyetujui cerita', icon: 'check', tone: 'ok' },
  'story.reject': { verb: 'menolak cerita', icon: 'x', tone: 'bad' },
  'story.publish': { verb: 'menerbitkan cerita', icon: 'send', tone: 'ok' },
  'story.unpublish': { verb: 'membatalkan terbit cerita', icon: 'clock', tone: 'warn' },
  'story.delete': { verb: 'menghapus cerita', icon: 'trash', tone: 'bad' },
  'story.edit': { verb: 'mengubah cerita', icon: 'pencil', tone: 'info' },
  'flipbook.save': { verb: 'menyimpan flipbook', icon: 'layers', tone: 'info' },
  'request.approve': { verb: 'menyetujui permintaan', icon: 'check', tone: 'ok' },
  'request.reject': { verb: 'menolak permintaan', icon: 'x', tone: 'bad' },
  'account.create_reviewer': { verb: 'membuat akun reviewer', icon: 'shield', tone: 'warn' },
  'account.delete_reviewer': { verb: 'menghapus akun reviewer', icon: 'trash', tone: 'bad' },
  'account.set_role': { verb: 'mengubah peran akun', icon: 'shield', tone: 'warn' },
  'account.create_admin': { verb: 'membuat akun admin', icon: 'shield', tone: 'warn' },
  'account.delete_admin': { verb: 'menghapus akun admin', icon: 'trash', tone: 'bad' },
  'account.delete_user': { verb: 'menghapus akun pengguna', icon: 'trash', tone: 'bad' },
  'asset.delete': { verb: 'menghapus', icon: 'image', tone: 'warn' },
  'auth.login': { verb: 'masuk ke panel', icon: 'user', tone: 'info' },
  'mail.test': { verb: 'mengirim email uji', icon: 'mail', tone: 'info' },
  'account.change_password': { verb: 'mengganti password', icon: 'shield', tone: 'info' },
  'account.change_profile': { verb: 'mengubah profilnya', icon: 'user', tone: 'info' },
  'account.reset_password': { verb: 'mengatur ulang passwordnya lewat email', icon: 'shield', tone: 'info' },
  'account.admin_reset_password': { verb: 'mengatur ulang password', icon: 'shield', tone: 'warn' },
  'system.backup': { verb: 'mengunduh', icon: 'download', tone: 'info' },
  'system.mail_settings': { verb: 'mengubah', icon: 'mail', tone: 'warn' },
};
const LOG_GROUPS: { v: string; l: string }[] = [
  { v: '', l: 'Semua' }, { v: 'story', l: 'Cerita' }, { v: 'flipbook', l: 'Flipbook' }, { v: 'request', l: 'Permintaan' },
  { v: 'account', l: 'Akun' }, { v: 'asset', l: 'Gambar' }, { v: 'auth', l: 'Masuk' }, { v: 'system', l: 'Sistem' },
];
const LOG_RANGES: { v: string; l: string }[] = [{ v: '', l: 'Semua waktu' }, { v: 'today', l: 'Hari ini' }, { v: '7d', l: '7 hari terakhir' }, { v: '30d', l: '30 hari terakhir' }];

const fmtDateTime = (s: string) => `${fmtDate(s)}, ${s.slice(11, 16)}`;

function LogRow({ l }: { l: AdminLog }) {
  const a = LOG_ACTIONS[l.action] ?? { verb: l.action, icon: 'file' as IconName, tone: 'info' as const };
  const target = l.target_id && l.action !== 'story.delete' && l.target_type === 'story' ? <Link to={`/cerita/${l.target_id}`}>{l.target_label}</Link> : <>{l.target_label}</>;
  const quote = !['auth.login', 'mail.test', 'account.change_password', 'account.change_profile', 'account.reset_password'].includes(l.action) && l.target_label;
  return (
    <li className={`log-row log-${a.tone}`}>
      <span className="log-ic"><Icon name={a.icon} size={16} /></span>
      <div className="log-main">
        <p><b>{l.admin_name}</b> {a.verb}{quote ? <> <span className="log-target">{l.target_type === 'story' ? '“' : ''}{target}{l.target_type === 'story' ? '”' : ''}</span></> : null}</p>
        {l.detail && l.action !== 'auth.login' && l.action !== 'account.change_password' && <small className="log-detail">{l.detail}</small>}
      </div>
      <time className="log-time" dateTime={l.created_at.replace(' ', 'T')} title={fmtDateTime(l.created_at)}>{timeAgo(l.created_at)}<small>{fmtDateTime(l.created_at)}</small></time>
    </li>
  );
}

export function LogsTab() {
  const { query } = useLocation();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [range, setRange] = useState('');
  const [adminId, setAdminId] = useState(query.get('admin') ?? '');
  const [extra, setExtra] = useState<AdminLog[]>([]);
  const [more, setMore] = useState(false);
  const dq = useDebounced(q.trim());
  const PAGE = 30;
  const first = useAsync(() => { setExtra([]); return api.get<AdminLogsRes>('admin/logs', { q: dq, group, range, admin: adminId, limit: PAGE, offset: 0 }); }, [dq, group, range, adminId]);
  const rows = [...(first.data?.logs ?? []), ...extra];
  const total = first.data?.total ?? 0;
  const hasFilter = !!(dq || group || range || adminId);
  const loadMore = async () => {
    setMore(true);
    try { const r = await api.get<AdminLogsRes>('admin/logs', { q: dq, group, range, admin: adminId, limit: PAGE, offset: rows.length }); setExtra((x) => [...x, ...r.logs]); }
    catch { /* tombol tetap bisa ditekan lagi */ } finally { setMore(false); }
  };
  return (
    <div className="panel">
      <p className="muted log-intro">Catatan setiap tindakan admin dan reviewer: siapa yang melakukan apa, kapan, dan pada cerita atau akun yang mana. Catatan tidak dapat diubah dari panel ini.{first.data?.retention_days ? <> Catatan lebih dari <b>{first.data.retention_days} hari</b> dihapus otomatis agar tidak menumpuk.</> : ' Catatan disimpan tanpa batas waktu.'}</p>
      <div className="adm-tools adm-tools-logs">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama petugas, judul cerita, atau keterangan…" label="Cari log" />
        <select value={adminId} onChange={(e) => setAdminId(e.target.value)} aria-label="Filter petugas"><option value="">Semua admin dan reviewer</option>{first.data?.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Filter waktu">{LOG_RANGES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
      </div>
      <div className="chips-row">{LOG_GROUPS.map((g) => <button key={g.v} className={`chip-btn ${group === g.v ? 'on' : ''}`} onClick={() => setGroup(g.v)}>{g.l}</button>)}</div>
      <div className="adm-count" role="status">
        {first.data && <span>{total} aktivitas{hasFilter ? ' cocok' : ''}</span>}
        {hasFilter && <button type="button" className="link-btn" onClick={() => { setQ(''); setGroup(''); setRange(''); setAdminId(''); }}>Atur ulang filter</button>}
      </div>
      {first.loading && !first.data && <Spinner />}
      {first.error && <ErrorBox message={first.error} onRetry={first.reload} />}
      {first.data && rows.length === 0 && <Empty icon="clock" title={hasFilter ? 'Tidak ada aktivitas yang cocok' : 'Belum ada aktivitas'}>{hasFilter ? 'Coba ubah filter atau kata kunci.' : 'Tindakan admin dan reviewer akan tercatat di sini.'}</Empty>}
      {rows.length > 0 && <ul className="log-list">{rows.map((l) => <LogRow key={l.id} l={l} />)}</ul>}
      {rows.length > 0 && rows.length < total && <div className="log-more"><button className="btn btn-outline" onClick={loadMore} disabled={more}>{more ? 'Memuat…' : `Muat lebih banyak (${total - rows.length} lagi)`}</button></div>}
    </div>
  );
}


/* ---------- Pengaturan ---------- */

interface MailInfo {
  enabled: boolean; source: 'database' | 'file' | 'none'; host: string; port: number; secure: string; user: string; has_pass: boolean;
  from_email: string; from_name: string; verify_peer: boolean; app_url: string;
}

const MAIL_PRESETS: { label: string; host: string; port: number; secure: 'tls' | 'ssl' }[] = [
  { label: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: 'tls' },
  { label: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, secure: 'tls' },
  { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, secure: 'ssl' },
];

function MailSection() {
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get<MailInfo>('admin/mail'), []);
  const [f, setF] = useState({ host: '', port: '587', secure: 'tls', user: '', pass: '', from_email: '', from_name: '', verify_peer: true });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'' | 'save' | 'test' | 'reset'>('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!data) return;
    setF({ host: data.host, port: String(data.port || 587), secure: data.secure || 'none', user: data.user, pass: '', from_email: data.from_email, from_name: data.from_name, verify_peer: data.verify_peer });
    setDirty(false);
  }, [data]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); setResult(null); };
  const setSecure = (secure: string) => {
    setF((x) => ({ ...x, secure, port: secure === 'ssl' && x.port === '587' ? '465' : secure === 'tls' && x.port === '465' ? '587' : x.port }));
    setDirty(true); setResult(null);
  };
  const preset = (p: (typeof MAIL_PRESETS)[number]) => { setF((x) => ({ ...x, host: p.host, port: String(p.port), secure: p.secure })); setDirty(true); setResult(null); };
  const payload = () => ({ host: f.host.trim(), port: Number(f.port) || 587, secure: f.secure, user: f.user.trim(), pass: f.pass, from_email: f.from_email.trim(), from_name: f.from_name.trim(), verify_peer: f.verify_peer });
  const save = async (): Promise<boolean> => {
    setBusy('save'); setResult(null);
    try { await api.put('admin/mail', payload()); toast('Pengaturan email disimpan.'); reload(); return true; }
    catch (e: any) { setResult({ ok: false, text: e.message }); return false; } finally { setBusy(''); }
  };
  const test = async () => {
    if (dirty && !(await save())) return;
    setBusy('test'); setResult(null);
    try { const r = await api.post<{ to: string }>('admin/mail/test'); setResult({ ok: true, text: `Email uji terkirim ke ${r.to}. Cek kotak masuk (dan folder spam).` }); }
    catch (e: any) { setResult({ ok: false, text: e.message }); } finally { setBusy(''); }
  };
  const reset = async () => {
    setBusy('reset'); setResult(null);
    try { await api.post('admin/mail/reset'); toast('Kembali memakai pengaturan dari berkas.'); reload(); } catch (e: any) { setResult({ ok: false, text: e.message }); } finally { setBusy(''); }
  };
  const on = !!f.host.trim();
  return (
    <section className="panel">
      <div className="section-head"><div><h3><Icon name="mail" size={18} />Email notifikasi (SMTP)</h3><p className="muted">Notifikasi selalu tampil di aplikasi; email adalah tambahan (cerita masuk, disetujui, ditolak, terbit, akun baru).</p></div>
        {data && <span className={`badge ${data.enabled ? 'st-published' : 'st-pending'}`}>{data.enabled ? 'Aktif' : 'Belum diatur'}</span>}</div>
      {loading && !data && <Spinner />}
      {error && <p className="err">{error}</p>}
      {data && (
        <form className="mail-form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          <div className="mail-presets"><span className="muted">Isi cepat:</span>{MAIL_PRESETS.map((p) => <button type="button" key={p.label} className="chip-btn" onClick={() => preset(p)}>{p.label}</button>)}</div>
          <div className="mail-grid">
            <label className="field"><span>Server SMTP</span><input value={f.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.gmail.com" autoComplete="off" /></label>
            <label className="field"><span>Port</span><input type="number" inputMode="numeric" value={f.port} onChange={(e) => set('port', e.target.value)} /></label>
            <label className="field"><span>Keamanan</span>
              <select value={f.secure} onChange={(e) => setSecure(e.target.value)}><option value="tls">TLS / STARTTLS (port 587)</option><option value="ssl">SSL (port 465)</option><option value="none">Tanpa enkripsi (tidak disarankan)</option></select></label>
            <label className="field"><span>Username</span><input value={f.user} onChange={(e) => set('user', e.target.value)} placeholder="akunmu@gmail.com" autoComplete="off" /></label>
            <label className="field"><span>Sandi {data.has_pass && <em className="muted">(tersimpan; kosongkan bila tidak diubah)</em>}</span><input type="password" value={f.pass} onChange={(e) => set('pass', e.target.value)} placeholder={data.has_pass ? '••••••••' : 'Sandi aplikasi'} autoComplete="new-password" /></label>
            <label className="field"><span>Email pengirim</span><input type="email" value={f.from_email} onChange={(e) => set('from_email', e.target.value)} placeholder="sama dengan username" /></label>
            <label className="field mail-wide"><span>Nama pengirim</span><input value={f.from_name} onChange={(e) => set('from_name', e.target.value)} placeholder="Cerita Rakyat Nusantara" /></label>
          </div>
          <label className="pw-show"><input type="checkbox" checked={f.verify_peer} onChange={(e) => set('verify_peer', e.target.checked)} /> Verifikasi sertifikat server (disarankan; matikan hanya bila koneksi aman gagal)</label>
          <p className="mail-tip"><b>Pakai Gmail?</b> Aktifkan verifikasi 2 langkah di akun Google, lalu buat <b>Sandi aplikasi</b> dan tempel di kolom Sandi. Sandi login biasa akan ditolak.</p>
          {result && <p className={result.ok ? 'mail-ok' : 'mail-bad'} role={result.ok ? 'status' : 'alert'}>{result.text}</p>}
          <div className="card-actions">
            <button className="btn btn-primary btn-sm" type="submit" disabled={!!busy || !dirty}><Icon name="check" size={14} />{busy === 'save' ? 'Menyimpan…' : 'Simpan'}</button>
            <button className="btn btn-outline btn-sm" type="button" onClick={test} disabled={!!busy || !on}><Icon name="send" size={14} />{busy === 'test' ? 'Mengirim…' : `Kirim email uji ke ${user?.email ?? 'saya'}`}</button>
            {data.source === 'database' && <button className="btn btn-ghost btn-sm" type="button" onClick={reset} disabled={!!busy}>Pakai pengaturan dari berkas</button>}
          </div>
          <p className="muted mail-src">{data.source === 'database' ? 'Pengaturan ini disimpan di database dan menggantikan berkas konfigurasi.' : data.source === 'file' ? 'Saat ini memakai pengaturan dari berkas api/config.local.php. Menyimpan formulir ini akan menggantikannya.' : 'Belum ada pengaturan email.'}</p>
        </form>
      )}
    </section>
  );
}

export function SettingsTab() {
  const { stats } = useAdminCtx();
  return (
    <div className="settings-col">
      <section className="panel">
        <div className="section-head"><div><h3><Icon name="shield" size={18} />Akun saya</h3><p className="muted">Nama, email, dan password akun admin kamu diatur di halaman profil.</p></div></div>
        {stats?.default_password && <p className="sec-warn" role="alert"><Icon name="shield" size={16} />Akun ini masih memakai password bawaan yang tertulis di dokumentasi. Ganti sekarang agar tidak ada orang lain yang bisa masuk sebagai admin.</p>}
        <Link to="/admin/profil" className="btn btn-primary btn-sm"><Icon name="user" size={15} />Buka profil saya</Link>
      </section>
      <MailSection />
    </div>
  );
}
