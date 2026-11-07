import { Suspense, lazy } from 'react';
import { Footer, Guard, Navbar } from './components/Layout';
import { Link, matchRoute, navigate, useLocation, type RouteDef } from './lib/router';
import { Spinner } from './components/ui';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { StoryDetail } from './pages/StoryDetail';
import { Reader } from './pages/Reader';
import { Auth } from './pages/Auth';
import { ForgotPassword, ResetPassword } from './pages/Recover';
import { StoryForm } from './pages/StoryForm';
import { Dashboard } from './pages/Dashboard';
import { MyStories } from './pages/MyStories';
import { ProfilePanel } from './components/ProfilePanel';
import { Favorites, Notifications } from './pages/Favorites';
import { AdminHome, LogsTab, RequestsTab, SettingsTab, StoriesTab, UsersTab } from './pages/Admin';
import { AdminBar, AdminLayout } from './components/AdminLayout';
import { useAuth } from './lib/auth';
import { isStaff } from './types';

const Editor = lazy(() => import('./editor/EditorPage'));

const routes: RouteDef[] = [
  { path: '/', render: () => <Home /> },
  { path: '/cerita', render: () => <Catalog /> },
  { path: '/cerita/:id', render: (m) => <StoryDetail key={m.params.id} id={m.params.id} /> },
  { path: '/cerita/:id/edit', render: (m) => <Guard><StoryForm id={m.params.id} /></Guard> },
  { path: '/baca/:id', render: (m) => <Reader key={m.params.id} id={m.params.id} /> },
  { path: '/masuk', render: () => <Auth /> },
  { path: '/daftar', render: () => <Auth initialMode="daftar" /> },
  { path: '/lupa', render: () => <ForgotPassword /> },
  { path: '/reset', render: () => <ResetPassword /> },
  { path: '/tambah', render: () => <Guard><StoryForm /></Guard> },
  { path: '/dashboard', render: (m) => <Guard><DashboardRoute old={m.query.get('bagian') === 'cerita'} /></Guard> },
  { path: '/cerita-saya', render: () => <Guard><MyStories /></Guard> },
  { path: '/profil', render: () => <Guard><div className="container page"><div className="page-head"><h1>Profil saya</h1><p className="muted">Atur nama, email, dan password akunmu.</p></div><ProfilePanel /></div></Guard> },
  { path: '/favorit', render: () => <Guard><Favorites /></Guard> },
  { path: '/notifikasi', render: () => <Guard><Notifications /></Guard> },
  { path: '/admin', render: () => <Guard staff><AdminLayout title="Ringkasan" subtitle="Pantau cerita yang perlu ditinjau dan didesain."><AdminHome /></AdminLayout></Guard> },
  { path: '/admin/cerita', render: () => <Guard staff><AdminLayout title="Kelola cerita" subtitle="Setujui, tolak, rancang flipbook, dan terbitkan."><StoriesTab /></AdminLayout></Guard> },
  { path: '/admin/permintaan', render: () => <Guard staff><AdminLayout title="Permintaan penulis" subtitle="Permintaan edit atau hapus untuk cerita yang sudah disetujui."><RequestsTab /></AdminLayout></Guard> },
  { path: '/admin/notifikasi', render: () => <Guard staff><AdminLayout title="Notifikasi" subtitle="Cerita masuk dan permintaan penulis."><Notifications admin /></AdminLayout></Guard> },
  { path: '/admin/pengguna', render: () => <Guard adminOnly><AdminLayout title="Kelola akun" subtitle="Atur akun reviewer/publisher dan lihat data pengguna. Hanya ada satu admin."><UsersTab /></AdminLayout></Guard> },
  { path: '/admin/profil', render: () => <Guard staff><AdminLayout title="Profil saya" subtitle="Nama, email, dan password akunmu."><ProfilePanel /></AdminLayout></Guard> },
  { path: '/admin/log', render: () => <Guard adminOnly><AdminLayout title="Log aktivitas" subtitle="Jejak tindakan admin dan reviewer: siapa, apa, dan kapan."><LogsTab /></AdminLayout></Guard> },
  { path: '/admin/pengaturan', render: () => <Guard adminOnly><AdminLayout title="Pengaturan" subtitle="Keamanan akun, backup data, dan email."><SettingsTab /></AdminLayout></Guard> },
  { path: '/admin/editor/:id', render: (m) => <Guard staff><Suspense fallback={<div className="container page"><Spinner label="Membuka editor…" /></div>}><Editor key={m.params.id} id={m.params.id} /></Suspense></Guard> },
];

// Tautan lama /dashboard?bagian=cerita dialihkan ke halaman Cerita saya.
function DashboardRoute({ old }: { old?: boolean }) {
  if (old) { setTimeout(() => navigate('/cerita-saya', true), 0); return null; }
  return <Dashboard />;
}

// Halaman situs publik yang tidak dipakai admin: admin langsung dialihkan ke panelnya.
const PUBLIC_ONLY = ['/', '/cerita', '/masuk', '/daftar', '/lupa', '/reset', '/tambah', '/favorit', '/notifikasi', '/dashboard', '/cerita-saya', '/profil'];

export function App() {
  const { path, query } = useLocation();
  const { user, loading } = useAuth();
  const isAdmin = isStaff(user); // admin atau reviewer memakai panel
  const redirect = isAdmin && PUBLIC_ONLY.includes(path);
  if (loading || redirect) {
    if (redirect) setTimeout(() => navigate(path === '/profil' ? '/admin/profil' : '/admin', true), 0);
    return <div className="boot"><Spinner /></div>;
  }
  const view = matchRoute(routes, path, query);
  const adminArea = path.startsWith('/admin');
  const writing = path === '/tambah' || /^\/cerita\/\d+\/edit$/.test(path);
  const bare = path.startsWith('/baca/') || adminArea || writing;
  return (
    <>
      {isAdmin && !bare && <AdminBar />}
      {!isAdmin && !bare && <Navbar />}
      <main id="main">
        {view ?? (
          <div className="container page"><div className="empty"><h3>Halaman tidak ditemukan</h3><p>Alamat yang kamu buka tidak ada.</p><Link to={isAdmin ? '/admin' : '/'} className="btn btn-primary">{isAdmin ? 'Kembali ke panel' : 'Kembali ke beranda'}</Link></div></div>
        )}
      </main>
      {!isAdmin && !bare && <Footer />}
    </>
  );
}
