import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Spinner, useAsync } from '../components/ui';
import { Link, navigate, useLocation } from '../lib/router';
import { useToast } from '../lib/toast';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-side" aria-hidden="true">
        <span className="brand-mark"><Icon name="book" size={22} /></span>
        <h2>Cerita Rakyat Nusantara</h2>
        <p>Baca, simpan, dan kirim cerita rakyat dari seluruh Indonesia.</p>
      </aside>
      {children}
    </div>
  );
}

/** Minta tautan reset password lewat email. */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Masukkan alamat email yang valid.');
    setBusy(true);
    try { await api.post('auth/forgot', { email: email.trim() }); setSent(true); }
    catch (ex: any) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Shell>
      {sent ? (
        <div className="auth-card">
          <span className="auth-ic"><Icon name="send" size={26} /></span>
          <h1>Cek emailmu</h1>
          <p className="muted">Jika <b>{email.trim()}</b> terdaftar, kami sudah mengirim tautan untuk mengatur ulang password. Tautan berlaku 60 menit dan hanya bisa dipakai sekali.</p>
          <p className="hint"><Icon name="alert" size={14} />Belum masuk? Lihat juga folder spam. Email kadang butuh beberapa menit.</p>
          <Link to="/masuk" className="btn btn-primary btn-block"><Icon name="login" size={16} />Kembali ke halaman masuk</Link>
          <p className="auth-alt"><button type="button" onClick={() => setSent(false)}>Pakai email lain</button></p>
        </div>
      ) : (
        <form className="auth-card" onSubmit={submit} noValidate>
          <span className="auth-ic"><Icon name="shield" size={26} /></span>
          <h1>Lupa password?</h1>
          <p className="muted">Masukkan email akunmu. Kami akan mengirim tautan untuk membuat password baru.</p>
          <label className="field"><span>Email</span><div className="input-ic"><Icon name="send" size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nama@email.com" autoFocus /></div></label>
          {err && <p className="form-err" role="alert"><Icon name="alert" size={15} />{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}><Icon name="send" size={16} />{busy ? 'Mengirim…' : 'Kirim tautan reset'}</button>
          <p className="auth-alt">Ingat passwordmu? <Link to="/masuk">Masuk</Link></p>
        </form>
      )}
    </Shell>
  );
}

/** Halaman tujuan tautan di email: membuat password baru. */
export function ResetPassword() {
  const { query } = useLocation();
  const token = query.get('token') ?? '';
  const toast = useToast();
  const check = useAsync(() => api.get<{ valid: boolean }>('auth/reset-check', { token }), [token]);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('Password minimal 8 karakter.');
    if (pw !== pw2) return setErr('Konfirmasi password tidak sama.');
    setBusy(true);
    try { await api.post('auth/reset', { token, password: pw }); toast('Password berhasil diganti. Silakan masuk.'); navigate('/masuk', true); }
    catch (ex: any) { setErr(ex.message); } finally { setBusy(false); }
  };
  if (check.loading && !check.data) return <Shell><div className="auth-card"><Spinner /></div></Shell>;
  if (!check.data?.valid) {
    return (
      <Shell>
        <div className="auth-card">
          <span className="auth-ic"><Icon name="alert" size={26} /></span>
          <h1>Tautan tidak berlaku</h1>
          <p className="muted">Tautan reset ini sudah kedaluwarsa, sudah dipakai, atau tidak benar. Minta tautan baru untuk melanjutkan.</p>
          <Link to="/lupa" className="btn btn-primary btn-block"><Icon name="send" size={16} />Minta tautan baru</Link>
        </div>
      </Shell>
    );
  }
  const type = show ? 'text' : 'password';
  return (
    <Shell>
      <form className="auth-card" onSubmit={submit} noValidate>
        <span className="auth-ic"><Icon name="shield" size={26} /></span>
        <h1>Buat password baru</h1>
        <p className="muted">Pilih password baru untuk akunmu (minimal 8 karakter).</p>
        <label className="field"><span>Password baru</span><div className="input-ic"><Icon name="shield" size={16} /><input type={type} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus />
          <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}><Icon name={show ? 'eyeoff' : 'eye'} size={16} /></button></div></label>
        <label className="field"><span>Ulangi password baru</span><div className="input-ic"><Icon name="shield" size={16} /><input type={type} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div></label>
        {err && <p className="form-err" role="alert"><Icon name="alert" size={15} />{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}><Icon name="check" size={16} />{busy ? 'Menyimpan…' : 'Simpan password baru'}</button>
      </form>
    </Shell>
  );
}
