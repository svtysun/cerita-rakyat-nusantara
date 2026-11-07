import { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { Icon } from './Icon';

/** Formulir ganti password (dipakai admin di Pengaturan dan pengguna di Dashboard). */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const tooShort = f.next.length > 0 && f.next.length < 8;
  const mismatch = f.again.length > 0 && f.again !== f.next;
  const ready = f.current && f.next.length >= 8 && f.again === f.next && !busy;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setErr('');
    try {
      await api.post('auth/password', { current: f.current, password: f.next });
      toast('Password berhasil diganti.');
      setF({ current: '', next: '', again: '' });
      onDone?.();
    } catch (ex: any) { setErr(ex.message); } finally { setBusy(false); }
  };
  const type = show ? 'text' : 'password';
  return (
    <form className="pw-form" onSubmit={submit} noValidate>
      <label className="field"><span>Password saat ini</span><input type={type} value={f.current} onChange={set('current')} autoComplete="current-password" /></label>
      <label className="field"><span>Password baru (min. 8 karakter)</span><input type={type} value={f.next} onChange={set('next')} autoComplete="new-password" aria-invalid={tooShort} />{tooShort && <small className="err">Minimal 8 karakter.</small>}</label>
      <label className="field"><span>Ulangi password baru</span><input type={type} value={f.again} onChange={set('again')} autoComplete="new-password" aria-invalid={mismatch} />{mismatch && <small className="err">Tidak sama dengan password baru.</small>}</label>
      <label className="pw-show"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Tampilkan password</label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn btn-primary" type="submit" disabled={!ready}><Icon name="check" size={15} />{busy ? 'Menyimpan…' : 'Simpan password baru'}</button>
    </form>
  );
}
