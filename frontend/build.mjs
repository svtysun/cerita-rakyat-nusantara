// Membangun frontend menjadi folder dist/ (statis, siap diunggah ke hosting PHP).
// Pemakaian: npm run build   (variabel NODE_PATH opsional untuk lokasi node_modules lain)
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist');
const watch = process.argv.includes('--watch');

export const options = {
  entryPoints: { app: join(root, 'src/main.tsx') },
  bundle: true, minify: !watch, sourcemap: watch, format: 'esm', target: 'es2020', splitting: true, chunkNames: 'chunks/[name]-[hash]',
  outdir: join(out, 'assets'), jsx: 'automatic', loader: { '.svg': 'dataurl' },
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(':') : [],
  logLevel: 'info',
};

export function copyStatic() {
  mkdirSync(out, { recursive: true });
  cpSync(join(root, 'public'), out, { recursive: true });
  let html = readFileSync(join(root, 'index.html'), 'utf8');
  html = html.replace('<script type="module" src="/src/main.tsx"></script>', '<script type="module" src="assets/app.js"></script>')
    .replace('</head>', '    <link rel="stylesheet" href="assets/app.css" />\n  </head>');
  writeFileSync(join(out, 'index.html'), html);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rmSync(out, { recursive: true, force: true });
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    copyStatic();
  } else {
    await esbuild.build(options);
    copyStatic();
    console.log('Selesai: frontend/dist');
  }
}
