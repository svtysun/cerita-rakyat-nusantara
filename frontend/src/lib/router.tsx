import { createElement, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

// Router hash sederhana: tidak butuh pengaturan server (#/cerita/3).
const read = () => {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  return { path: path || '/', query: new URLSearchParams(query) };
};

export function useLocation() {
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const on = () => { setLoc(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return loc;
}

export const navigate = (to: string, replace = false) => {
  if (replace) window.location.replace('#' + to);
  else window.location.hash = to;
};

export interface Match { params: Record<string, string>; query: URLSearchParams }
export interface RouteDef { path: string; render: (m: Match) => ReactNode }

export function matchRoute(routes: RouteDef[], path: string, query: URLSearchParams): ReactNode | null {
  for (const r of routes) {
    const keys: string[] = [];
    const re = new RegExp('^' + r.path.replace(/:([a-z]+)/gi, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    const m = path.match(re);
    if (m) return r.render({ params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query });
  }
  return null;
}

export function Link({ to, children, ...rest }: { to: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement('a', { href: '#' + to, ...rest }, children);
}

export function useActive(to: string, exact = false) {
  const { path } = useLocation();
  return exact ? path === to : path === to || path.startsWith(to + '/');
}
