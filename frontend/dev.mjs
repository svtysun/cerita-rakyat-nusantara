// Server pengembangan: membangun ulang otomatis, menyajikan dist/ di :5173 dan meneruskan /api ke PHP (:8000).
import * as esbuild from 'esbuild';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { options, copyStatic } from './build.mjs';

const PORT = 5173, API = { host: '127.0.0.1', port: 8000 };
const dist = join(process.cwd(), 'dist');
const ctx = await esbuild.context({ ...options, minify: false, sourcemap: true });
await ctx.watch();
copyStatic();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.map': 'application/json' };

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const p = http.request({ ...API, path: req.url.replace(/^\/api/, '') || '/', method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', () => { res.writeHead(502); res.end('API PHP belum berjalan di :8000'); });
    return req.pipe(p);
  }
  let f = normalize(join(dist, decodeURIComponent(req.url.split('?')[0])));
  if (!f.startsWith(dist)) { res.writeHead(403); return res.end(); }
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(f)] ?? 'application/octet-stream' });
  createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}  (API: jalankan  php -S 127.0.0.1:8000 -t backend)`));
