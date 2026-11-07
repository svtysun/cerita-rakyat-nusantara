import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { Icon } from '../components/Icon';
import { Link, navigate, useLocation } from '../lib/router';
import { useToast } from '../lib/toast';
import { isStaff } from '../types';

export function Auth({ initialMode }: { initialMode?: 'masuk' | 'daftar' } = {}) {
  const { login, register, user } = useAuth();
  const toast = useToast();
  const { query } = useLocation();
  const next = query.get('next') || '';
  const [mode, setMode] = useState<'masuk' | 'daftar'>(initialMode === 'daftar' || query.get('mode') === 'daftar' ? 'daftar' : 'masuk');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && !isStaff(user)) { setTimeout(() => navigate(next || '/dashboard', true), 0); return null; }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (mode === 'daftar') {
      if (name.trim().length < 2) return setErr('Nama lengkap minimal 2 karakter.');
      if (pw.length < 6) return setErr('Password minimal 6 karakter.');
      if (pw !== pw2) return setErr('Konfirmasi password tidak sama.');
    }
    setBusy(true);
    try {
      const u = mode === 'masuk' ? await login(email, pw) : await register(name, email, pw);
      toast(mode === 'masuk' ? `Selamat datang kembali, ${u.name}.` : 'Akun berhasil dibuat.');
      navigate(next || (isStaff(u) ? '/admin' : '/dashboard'), true);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <aside className="auth-side" aria-hidden="true">
        <span className="brand-mark"><Icon name="book" size={22} /></span>
        <h2>Cerita Rakyat Nusantara</h2>
        <p>Baca, simpan, dan kirim cerita rakyat dari seluruh Indonesia.</p>
        <ul>
          <li><Icon name="heart" size={16} />Simpan cerita favoritmu</li>
          <li><Icon name="pencil" size={16} />Kirim cerita dari daerahmu</li>
          <li><Icon name="bell" size={16} />Dapat kabar saat ceritamu terbit</li>
        </ul>
      </aside>
      <form className="auth-card" onSubmit={submit} noValidate>
        <span className="auth-ic"><Icon name="book" size={26} /></span>
        <h1>{mode === 'masuk' ? 'Selamat datang kembali' : 'Buat akun baru'}</h1>
        <p className="muted">{mode === 'masuk' ? 'Masuk untuk mengakses dashboard dan favoritmu.' : 'Daftar sebagai pengguna cerita rakyat.'}</p>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'masuk'} className={mode === 'masuk' ? 'on' : ''} onClick={() => { setMode('masuk'); setErr(''); }}><Icon name="login" size={15} />Masuk</button>
          <button type="button" role="tab" aria-selected={mode === 'daftar'} className={mode === 'daftar' ? 'on' : ''} onClick={() => { setMode('daftar'); setErr(''); }}><Icon name="user" size={15} />Daftar</button>
        </div>
        {mode === 'daftar' && (
          <label className="field"><span>Nama lengkap</span><div className="input-ic"><Icon name="user" size={16} /><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div></label>
        )}
        <label className="field"><span>Email</span><div className="input-ic"><Icon name="send" size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nama@email.com" /></div></label>
        <label className="field"><span>{mode === 'daftar' ? 'Password (min. 6 karakter)' : 'Password'}</span>
          <div className="input-ic"><Icon name="shield" size={16} /><input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'} />
            <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}><Icon name={show ? 'eyeoff' : 'eye'} size={16} /></button></div></label>
        {mode === 'masuk' && <p className="auth-forgot"><Link to="/lupa">Lupa password?</Link></p>}
        {mode === 'daftar' && <label className="field"><span>Konfirmasi password</span><div className="input-ic"><Icon name="shield" size={16} /><input type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div></label>}
        {mode === 'daftar' && <p className="hint"><Icon name="user" size={14} />Pendaftaran hanya untuk pengguna biasa. Akun reviewer dibuat oleh admin.</p>}
        {err && <p className="form-err" role="alert"><Icon name="alert" size={15} />{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}><Icon name={mode === 'masuk' ? 'login' : 'user'} size={16} />{busy ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Buat akun'}</button>
        <p className="auth-alt">{mode === 'masuk' ? <>Belum punya akun? <button type="button" onClick={() => setMode('daftar')}>Daftar sekarang</button></> : <>Sudah punya akun? <button type="button" onClick={() => setMode('masuk')}>Masuk di sini</button></>}</p>
      </form>
    </div>
  );
}
