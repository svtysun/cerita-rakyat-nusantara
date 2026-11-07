import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { type AdminStats } from '../types';
import { Icon, type IconName } from './Icon';
import { Link, useActive } from '../lib/router';
import { useAuth } from '../lib/auth';
import { useAsync } from './ui';
import { AdminCtx } from '../pages/Admin';
import { NotifBell } from './Notifications';
import { useLogout } from './LogoutConfirm';

function Item({ to, icon, label, badge, exact, onClick }: { to: string; icon: IconName; label: string; badge?: number; exact?: boolean; onClick: () => void }) {
  const active = useActive(to, exact);
  return (
    <Link to={to} className={`side-link ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} size={18} /><span>{label}</span>{!!badge && <em className="dot-badge">{badge}</em>}
    </Link>
  );
}

/** Kerangka halaman admin: sidebar sendiri, terpisah dari situs publik. */
export function AdminLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { user, unread } = useAuth();
  const out = useLogout(true);
  const [open, setOpen] = useState(false);
  const stats = useAsync(() => api.get<AdminStats>('admin/stats'), []);
  const close = () => setOpen(false);
  const s = stats.data;
  const isAdmin = user?.role === 'admin';
  const onProfile = useActive('/admin/profil');
  return (
    <AdminCtx.Provider value={{ stats: s, reload: stats.reload }}>
      <div className="adm">
        <aside className={`adm-side ${open ? 'open' : ''}`}>
          <div className="adm-brand">
            <span className="brand-mark"><Icon name="book" size={20} /></span>
            <div><b>Cerita Nusantara</b><small>{isAdmin ? 'Panel administrator' : 'Panel reviewer'}</small></div>
            <button className="icon-btn light adm-close" onClick={close} aria-label="Tutup menu"><Icon name="x" /></button>
          </div>
          <nav className="side-nav" aria-label="Menu panel">
            <Item to="/admin" exact icon="dashboard" label="Ringkasan" onClick={close} />
            <Item to="/admin/cerita" icon="book" label="Kelola cerita" badge={s?.pending} onClick={close} />
            <Item to="/admin/permintaan" icon="file" label="Permintaan" badge={s?.requests} onClick={close} />
            {isAdmin && <Item to="/admin/pengguna" icon="users" label="Kelola akun" onClick={close} />}
            {isAdmin && <Item to="/admin/log" icon="shield" label="Log aktivitas" onClick={close} />}
            <Item to="/admin/notifikasi" icon="bell" label="Notifikasi" badge={unread} onClick={close} />
            <Item to="/admin/profil" icon="user" label="Profil saya" onClick={close} />
            {isAdmin && <Item to="/admin/pengaturan" icon="settings" label="Pengaturan" onClick={close} />}
          </nav>
          <div className="side-user">
            <Link to="/admin/profil" className="side-user-link" onClick={close} title="Buka profil saya">
              <span className="avatar">{user?.name.slice(0, 1).toUpperCase()}</span>
              <div><b>{user?.name}</b><small>{user?.email}</small></div>
            </Link>
            <button type="button" className="side-logout" onClick={() => { close(); out.ask(); }}><Icon name="logout" size={17} />Keluar</button>
          </div>
        </aside>
        {out.dialog}
        {open && <div className="adm-scrim" onClick={close} />}
        <div className="adm-main">
          <header className="adm-top">
            <button className="icon-btn adm-menu" onClick={() => setOpen(true)} aria-label="Buka menu"><Icon name="menu" /></button>
            <div className="adm-title"><h1>{title}</h1><p className="muted">{subtitle}</p></div>
            <div className="adm-top-tools"><NotifBell admin /></div>
          </header>
          <div className="adm-content">
            {s?.default_password && !onProfile && (
              <div className="sec-banner" role="alert">
                <Icon name="shield" size={18} />
                <div><b>Password bawaan masih dipakai.</b><span> Siapa pun yang membaca dokumentasi bisa masuk sebagai admin.</span></div>
                <Link to="/admin/profil" className="btn btn-gold btn-sm">Ganti sekarang</Link>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}

/** Bilah tipis untuk admin saat melihat cerita atau buku (pratinjau). */
export function AdminBar() {
  return (
    <div className="admin-bar">
      <Link to="/admin" className="btn btn-gold btn-sm"><Icon name="left" size={15} />Kembali ke panel</Link>
      <span>Mode panel: kamu sedang melihat pratinjau cerita.</span>
    </div>
  );
}
