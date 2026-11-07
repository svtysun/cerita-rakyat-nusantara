import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from '../types';

interface AuthCtx {
  user: User | null; loading: boolean; unread: number;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUnread: () => void;
  setUser: (u: User | null) => void;
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    api.get<{ unread: number }>('notifications').then((r) => setUnread(r.unread)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ user: User | null }>('auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (user) refreshUnread(); else setUnread(0); }, [user, refreshUnread]);
  // cek notifikasi baru tiap 60 detik selama tab terlihat
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') refreshUnread(); }, 60000);
    return () => clearInterval(t);
  }, [user, refreshUnread]);

  const value: AuthCtx = {
    user, loading, unread, refreshUnread, setUser,
    login: async (email, password) => { const r = await api.post<{ user: User }>('auth/login', { email, password }); setUser(r.user); return r.user; },
    register: async (name, email, password) => { const r = await api.post<{ user: User }>('auth/register', { name, email, password }); setUser(r.user); return r.user; },
    logout: async () => { await api.post('auth/logout').catch(() => {}); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
