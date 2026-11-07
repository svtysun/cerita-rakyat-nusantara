import { useEffect, useState } from 'react';
import { api, fmtDate } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ROLE_LABEL, type User } from '../types';
import { Icon } from './Icon';
import { ChangePasswordForm } from './ChangePassword';

/** Halaman profil untuk admin dan pengguna: nama, email, dan password. */
export function ProfilePanel() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (user) { setName(user.name); setEmail(user.email); } }, [user?.name, user?.email]);
  if (!user) return null;

  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();
  const nameChanged = name.trim() !== user.name;
  const dirty = nameChanged || emailChanged;
  const ready = dirty && name.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim()) && (!emailChanged || current.length > 0) && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setErr('');
    try {
      const r = await api.put<{ user: User }>('auth/profile', { name: name.trim(), email: email.trim(), current });
      setUser(r.user);
      setCurrent('');
      toast(emailChanged ? 'Profil diperbarui. Gunakan email baru untuk masuk berikutnya.' : 'Profil diperbarui.');
    } catch (ex: any) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <div className="profile-wrap">
      <section className="panel profile-card">
        <span className="avatar profile-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <h2>{user.name}</h2>
          <p className="muted">{user.email}</p>
          <p className="profile-meta">
            <span className={`role-badge role-${user.role}`}><Icon name={user.role === 'user' ? 'user' : 'shield'} size={12} />{ROLE_LABEL[user.role]}</span>
            {user.created_at && <span className="muted">Bergabung {fmtDate(user.created_at)}</span>}
          </p>
        </div>
      </section>

      <div className="profile-cols">
        <section className="panel">
          <div className="section-head"><div><h3><Icon name="user" size={18} />Data akun</h3><p className="muted">Nama tampil sebagai penulis di ceritamu. Email dipakai untuk masuk dan menerima kabar.</p></div></div>
          <form className="pw-form" onSubmit={submit} noValidate>
            <label className="field"><span>Nama</span><input value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} maxLength={80} autoComplete="name" /></label>
            <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} autoComplete="email" /></label>
            {emailChanged && (
              <label className="field profile-confirm"><span>Password saat ini <em className="muted">(wajib untuk mengganti email)</em></span>
                <input type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setErr(''); }} autoComplete="current-password" autoFocus /></label>
            )}
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn btn-primary" type="submit" disabled={!ready}><Icon name="check" size={15} />{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
          </form>
        </section>

        <section className="panel">
          <div className="section-head"><div><h3><Icon name="shield" size={18} />Ubah password</h3><p className="muted">Gunakan minimal 8 karakter dan jangan pakai ulang password dari situs lain.</p></div></div>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
