import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Notif } from '../types';
import { Icon, type IconName } from './Icon';
import { Link, navigate } from '../lib/router';
import { useLogout } from './LogoutConfirm';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { timeAgo } from '../lib/format';

export const notifIcon = (t: string): IconName =>
  t === 'approved' || t === 'published' ? 'check' : t === 'rejected' ? 'x' : t === 'story_submitted' ? 'clock' : t === 'request' || t === 'request_result' ? 'file' : t === 'welcome' ? 'sparkles' : t === 'account' ? 'user' : 'bell';
export const notifTone = (t: string) => (t === 'approved' || t === 'published' ? 'ok' : t === 'rejected' ? 'bad' : t === 'story_submitted' || t === 'request' ? 'warn' : 'info');
const notifTarget = (t: string, admin: boolean) => (admin ? (t === 'request' ? '/admin/permintaan' : '/admin/cerita') : '/dashboard');

/** Menutup panel saat klik di luar atau menekan Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, close]);
  return ref;
}

export function NotifItem({ n, onClick }: { n: Notif; onClick?: () => void }) {
  return (
    <button type="button" className={`ni ${n.is_read ? '' : 'unread'} ni-${notifTone(n.type)}`} onClick={onClick}>
      <span className="ni-ic"><Icon name={notifIcon(n.type)} size={15} /></span>
      <span className="ni-tx"><span>{n.message}</span><small>{timeAgo(n.created_at)}</small></span>
      {!n.is_read && <i className="ni-dot" aria-label="Belum dibaca" />}
    </button>
  );
}

/** Lonceng notifikasi dengan panel dropdown. Dipakai di navbar pengguna dan bilah atas admin. */
export function NotifBell({ admin = false, dark = false }: { admin?: boolean; dark?: boolean }) {
  const { unread, refreshUnread } = useAuth();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notif[] | null>(null);
  const [err, setErr] = useState('');
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const all = admin ? '/admin/notifikasi' : '/notifikasi';

  const load = useCallback(() => {
    api.get<{ notifications: Notif[] }>('notifications').then((r) => { setList(r.notifications); setErr(''); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const readAll = async () => { await api.post('notifications/read').catch(() => {}); load(); refreshUnread(); };
  const go = async (n: Notif) => {
    if (!n.is_read) { await api.post(`notifications/${n.id}/read`).catch(() => {}); refreshUnread(); }
    setOpen(false); navigate(notifTarget(n.type, admin));
  };

  return (
    <div className="pop-wrap" ref={ref}>
      <button type="button" className={`bell-btn ${dark ? 'dark' : ''} ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open} aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}>
        <Icon name="bell" size={19} />{unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="pop notif-pop" role="dialog" aria-label="Notifikasi">
          <div className="pop-head"><b>Notifikasi</b>{unread > 0 && <button type="button" className="link-btn" onClick={readAll}>Tandai semua dibaca</button>}</div>
          <div className="pop-body">
            {err && <p className="pop-empty">{err}</p>}
            {!err && !list && <p className="pop-empty">Memuat…</p>}
            {list && list.length === 0 && <p className="pop-empty"><Icon name="bell" size={22} />Belum ada notifikasi.</p>}
            {list?.slice(0, 7).map((n) => <NotifItem key={n.id} n={n} onClick={() => go(n)} />)}
          </div>
          <Link to={all} className="pop-foot" onClick={close}>Lihat semua notifikasi<Icon name="right" size={14} /></Link>
        </div>
      )}
    </div>
  );
}

/** Menu akun: avatar + nama, berisi pintasan dan tombol keluar. */
export function AccountMenu({ items }: { items: { to: string; icon: IconName; label: string }[] }) {
  const { user } = useAuth();
  const lo = useLogout();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  if (!user) return null;
  const out = () => { close(); lo.ask(); };
  return (
    <div className="pop-wrap" ref={ref}>
      {lo.dialog}
      <button type="button" className={`acct-btn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open}>
        <span className="avatar avatar-sm">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="acct-name">{user.name.split(' ')[0]}</span><Icon name="down" size={14} />
      </button>
      {open && (
        <div className="pop acct-pop" role="menu">
          <div className="acct-id"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div></div>
          {items.map((i) => <Link key={i.to} to={i.to} className="pop-item" role="menuitem" onClick={close}><Icon name={i.icon} size={16} />{i.label}</Link>)}
          <button type="button" className="pop-item pop-out" role="menuitem" onClick={out}><Icon name="logout" size={16} />Keluar</button>
        </div>
      )}
    </div>
  );
}

export function NotifList({ list, onItem }: { list: Notif[]; onItem?: (n: Notif) => void }): ReactNode {
  return <div className="ni-list">{list.map((n) => <NotifItem key={n.id} n={n} onClick={() => onItem?.(n)} />)}</div>;
}
