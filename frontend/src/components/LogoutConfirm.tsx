import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Confirm } from './ui';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { navigate } from '../lib/router';

/** Keluar dengan konfirmasi "Apakah yakin keluar?". Pakai `ask()` pada tombol Keluar dan render `dialog` di komponen yang sama. */
export function useLogout(admin = false) {
  const { logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const dialog = open ? createPortal(
    <Confirm
      title="Apakah yakin keluar?"
      message={admin ? 'Kamu akan keluar dari panel administrator. Masuk lagi dengan email dan password untuk melanjutkan.' : 'Kamu akan keluar dari akunmu. Kamu bisa masuk lagi kapan saja.'}
      confirmLabel="Ya, keluar"
      danger
      onClose={() => setOpen(false)}
      onConfirm={async () => {
        await logout();
        setOpen(false);
        toast(admin ? 'Kamu sudah keluar dari panel admin.' : 'Kamu sudah keluar. Sampai jumpa lagi!');
        // tunda sedikit agar mengalahkan pengalihan otomatis penjaga halaman (Guard)
        setTimeout(() => navigate(admin ? '/masuk' : '/', true), 60);
      }}
    />,
    document.body,
  ) : null;
  return { ask: () => setOpen(true), dialog };
}
