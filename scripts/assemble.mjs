// Menyusun folder public_html/ (frontend hasil build + API PHP di /api) siap diunggah ke hosting.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public_html');
rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'frontend/dist'), out, { recursive: true });
cpSync(join(root, 'backend'), join(out, 'api'), {
  recursive: true,
  filter: (src) => !/config\.local\.php$/.test(src) && !/uploads[\\/][^\\/]+\.(jpe?g|png|webp|gif)$/i.test(src),
});
mkdirSync(join(out, 'api/uploads'), { recursive: true });
writeFileSync(join(out, '.htaccess'), 'Options -Indexes\nDirectoryIndex index.html\n');
console.log('public_html siap:', readdirSync(out).join(', '));
