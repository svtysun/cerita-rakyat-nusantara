import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Link, navigate, useActive, useLocation } from '../lib/router';
import { useAuth } from '../lib/auth';
import { isStaff } from '../types';
import { Spinner } from './ui';
import { AccountMenu, NotifBell } from './Notifications';
import { useLogout } from './LogoutConfirm';

function NavLink({ to, icon, children, exact, onClick }: { to: string; icon?: Parameters<typeof Icon>[0]['name']; children: ReactNode; exact?: boolean; onClick?: () => void }) {
  const active = useActive(to, exact);
  return <Link to={to} className={`nav-link ${active ? 'active' : ''}`} onClick={onClick}>{icon && <Icon name={icon} size={16} />}{children}</Link>;
}

const ACCT: { to: string; icon: Parameters<typeof Icon>[0]['name']; label: string }[] = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard saya' },
  { to: '/cerita-saya', icon: 'book', label: 'Cerita saya' },
  { to: '/profil', icon: 'user', label: 'Profil saya' },
  { to: '/tambah', icon: 'pencil', label: 'Tulis cerita' },
  { to: '/favorit', icon: 'heart', label: 'Cerita favorit' },
  { to: '/notifikasi', icon: 'bell', label: 'Semua notifikasi' },
];

export function Navbar() {
  const { user, unread } = useAuth();
  const out = useLogout();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="nav">
      {out.dialog}
      <div className="container nav-in">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand-mark"><Icon name="book" size={20} /></span>
          <span className="brand-txt"><b>Cerita Nusantara</b><small>Rakyat Indonesia</small></span>
        </Link>
        <button className="icon-btn nav-toggle" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'menu'} /></button>
        <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Navigasi utama">
          <NavLink to="/" exact onClick={close}>Beranda</NavLink>
          <NavLink to="/cerita" onClick={close}>Cerita Rakyat</NavLink>
          {user && <>
            <NavLink to="/tambah" icon="pencil" onClick={close}>Tulis Cerita</NavLink>
            <span className="nav-sep" aria-hidden="true" />
            {/* layar lebar: lonceng + menu akun */}
            <div className="nav-wide"><NotifBell /><AccountMenu items={ACCT} /></div>
            {/* layar sempit: daftar menu biasa */}
            <div className="nav-flat">
              <NavLink to="/dashboard" icon="dashboard" onClick={close}>Dashboard</NavLink>
              <NavLink to="/cerita-saya" icon="book" onClick={close}>Cerita saya</NavLink>
              <NavLink to="/favorit" icon="heart" onClick={close}>Favorit</NavLink>
              <NavLink to="/profil" icon="user" onClick={close}>Profil</NavLink>
              <NavLink to="/notifikasi" icon="bell" onClick={close}>Notifikasi{unread > 0 && <span className="dot-badge">{unread}</span>}</NavLink>
              <button className="btn btn-outline btn-sm" onClick={() => { close(); out.ask(); }}><Icon name="logout" size={15} />Keluar</button>
            </div>
          </>}
          {!user && <Link to="/masuk" className="btn btn-primary btn-sm" onClick={close}>Masuk</Link>}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-in">
        <div>
          <div className="brand brand-light"><span className="brand-mark"><Icon name="book" size={18} /></span><span className="brand-txt"><b>Cerita Nusantara</b></span></div>
          <p>Media digital untuk membaca, menemukan, dan melestarikan cerita rakyat Indonesia.</p>
        </div>
        <div className="footer-links">
          <Link to="/cerita">Jelajahi cerita</Link>
          <Link to="/tambah">Kirim ceritamu</Link>
          <Link to="/masuk">Masuk atau daftar</Link>
        </div>
        <p className="footer-note">Proyek Pengujian dan Evaluasi Sistem, Kelompok 4. Universitas Yapis Papua, 2026.</p>
      </div>
    </footer>
  );
}

/** Pembungkus halaman yang wajib login. staff = admin atau reviewer; adminOnly = hanya admin. */
export function Guard({ children, staff, adminOnly }: { children: ReactNode; staff?: boolean; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  const { path } = useLocation();
  if (loading) return <div className="container page"><Spinner /></div>;
  if (!user) { setTimeout(() => navigate('/masuk?next=' + encodeURIComponent(path), true), 0); return null; }
  const denied = adminOnly ? user.role !== 'admin' : staff ? !isStaff(user) : false;
  if (denied) {
    const reviewer = user.role === 'reviewer';
    return (
      <div className="container page"><div className="empty"><span className="empty-ic"><Icon name="shield" size={26} /></span>
        <h3>{adminOnly ? 'Halaman ini khusus administrator' : 'Halaman ini khusus admin dan reviewer'}</h3>
        <p>{reviewer ? 'Akun reviewer tidak punya akses ke pengelolaan akun, log, atau pengaturan.' : 'Akunmu tidak punya akses ke halaman ini.'}</p>
        <Link to={reviewer ? '/admin' : '/'} className="btn btn-primary">{reviewer ? 'Kembali ke panel' : 'Kembali ke beranda'}</Link></div></div>
    );
  }
  return <>{children}</>;
}
