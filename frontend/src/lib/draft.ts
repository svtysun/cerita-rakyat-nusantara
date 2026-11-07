import type { El, ImageEl, Page, ShapeEl, Story, TextEl, Anim } from '../types';
import { PAGE_H, PAGE_W } from '../types';
import { autoCoverUrl } from './autoCover';

let counter = 0;
export const uid = () => Date.now().toString(36).slice(-4) + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);

const noAnim = (): Anim => ({ type: 'none', delay: 0, duration: 0.8 });

export const mkText = (text: string, x: number, y: number, w: number, h: number, o: Partial<TextEl> = {}): TextEl => ({
  id: uid(), type: 'text', text, x, y, w, h, rotation: 0, opacity: 1, font: 'reading', size: 17, color: '#241519',
  bold: false, italic: false, align: 'left', lineHeight: 1.55, anim: noAnim(), ...o,
});
export const mkShape = (x: number, y: number, w: number, h: number, fill: string, o: Partial<ShapeEl> = {}): ShapeEl => ({
  id: uid(), type: 'shape', shape: 'rect', x, y, w, h, rotation: 0, opacity: 1, fill, radius: 0, anim: noAnim(), ...o,
});
export const mkImage = (src: string, x: number, y: number, w: number, h: number, alt = '', o: Partial<ImageEl> = {}): ImageEl => ({
  id: uid(), type: 'image', src, alt, x, y, w, h, rotation: 0, opacity: 1, radius: 0, anim: noAnim(), ...o,
});

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const cloneEl = (e: El): El => ({ ...clone(e), id: uid() });

/** Membagi isi cerita menjadi halaman teks (± 520 karakter per halaman). */
export function paginate(text: string, budget = 520): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pages: string[] = [];
  let cur = '';
  const push = () => { if (cur.trim()) pages.push(cur.trim()); cur = ''; };
  for (const p of paras) {
    if (p.length > budget) {
      push();
      const sentences = p.match(/[^.!?]+[.!?"”]*\s*/g) ?? [p];
      for (const s of sentences) {
        if ((cur + s).length > budget) push();
        cur += s;
      }
      push();
      continue;
    }
    if ((cur + '\n\n' + p).length > budget) push();
    cur += (cur ? '\n\n' : '') + p;
  }
  push();
  return pages;
}

export interface Palette { base: string; gold: string; deep: string }
export const DEFAULT_PALETTE: Palette = { base: '#6E1423', gold: '#E0A94A', deep: '#3D0A14' };

export function pageTemplate(kind: 'cover' | 'text' | 'image' | 'quote' | 'blank', s: Pick<Story, 'title' | 'region' | 'province' | 'image_url'>, pal = DEFAULT_PALETTE): Page {
  const W = PAGE_W;
  // Cerita tanpa gambar unggahan tetap mendapat sampul ilustrasi otomatis.
  const cover = s.image_url || autoCoverUrl(s, 600);
  switch (kind) {
    case 'cover':
      return {
        id: uid(), bg: pal.base, elements: [
          // Sampul penuh satu halaman; judul dan lokasi diletakkan di atas perbukitan gelap di bagian bawah.
          ...(cover ? [mkImage(cover, 0, 0, W, PAGE_H, `Sampul ${s.title}`)] : []),
          mkText(s.title, 30, 400, 340, 90, { font: 'serif', size: 30, color: '#FFFFFF', bold: true, lineHeight: 1.2, anim: { type: 'slideUp', delay: 0.2, duration: 0.9 } }),
          mkText(`${s.region}, ${s.province}`, 30, 500, 340, 26, { font: 'sans', size: 14, color: pal.gold, anim: { type: 'fade', delay: 0.7, duration: 0.9 } }),
        ],
      };
    case 'text':
      return {
        id: uid(), bg: '#FBF8F1', elements: [
          mkShape(30, 36, 44, 5, pal.gold, { anim: { type: 'slideRight', delay: 0, duration: 0.6 } }),
          mkText('Tulis ceritamu di sini. Klik dua kali untuk mengubah teks.', 30, 62, 340, 420, { size: 17, anim: { type: 'fade', delay: 0.15, duration: 0.9 } }),
        ],
      };
    case 'image':
      return {
        id: uid(), bg: '#FBF8F1', elements: [
          ...(cover ? [mkImage(cover, 30, 40, 340, 360, `Ilustrasi ${s.title}`, { radius: 14, anim: { type: 'zoom', delay: 0, duration: 0.9 } })] : [mkShape(30, 40, 340, 360, pal.gold, { radius: 14, opacity: 0.35 })]),
          mkText('Keterangan gambar.', 30, 420, 340, 80, { size: 16, italic: true, align: 'center', anim: { type: 'fade', delay: 0.5, duration: 0.8 } }),
        ],
      };
    case 'quote':
      return {
        id: uid(), bg: pal.deep, elements: [
          mkShape(30, 90, 340, 3, pal.gold),
          mkText('Pesan dari cerita', 30, 116, 340, 30, { font: 'sans', size: 14, color: pal.gold }),
          mkText('Tulis pesan atau amanat cerita di sini.', 30, 160, 340, 200, { font: 'serif', size: 24, color: '#FFFFFF', italic: true, lineHeight: 1.4, anim: { type: 'slideUp', delay: 0.2, duration: 1 } }),
          mkShape(300, 420, 70, 70, pal.gold, { shape: 'circle', opacity: 0.9, anim: { type: 'float', delay: 0, duration: 3 } }),
        ],
      };
    default:
      return { id: uid(), bg: '#FBF8F1', elements: [] };
  }
}

/** Draf flipbook otomatis dari teks cerita: sampul, halaman isi, halaman penutup. */
export function generateDraft(s: Story, pal = DEFAULT_PALETTE): Page[] {
  const parts = (s.full_story ?? s.short_description).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const moral = parts.length > 3 ? parts[parts.length - 1] : '';
  const body = moral ? parts.slice(0, -1) : parts;
  const pages: Page[] = [pageTemplate('cover', s, pal)];
  paginate(body.join('\n\n')).forEach((t, i) => {
    pages.push({
      id: uid(), bg: i % 2 ? '#F3EFE6' : '#FBF8F1', elements: [
        mkShape(30, 36, 44, 5, pal.gold, { anim: { type: 'slideRight', delay: 0, duration: 0.6 } }),
        mkText(t, 30, 62, 340, 420, { size: 17, anim: { type: 'fade', delay: 0.15, duration: 0.9 } }),
        mkText(String(i + 2), 30, 514, 340, 22, { font: 'sans', size: 12, color: '#7A6A5E', align: i % 2 ? 'right' : 'left' }),
      ],
    });
  });
  const end = pageTemplate('quote', s, pal);
  if (moral) (end.elements[2] as TextEl).text = moral;
  end.elements.push(mkText('Tamat', 30, 440, 240, 40, { font: 'serif', size: 28, color: '#FFFFFF', bold: true }));
  pages.push(end);
  if (pages.length % 2) pages.splice(pages.length - 1, 0, { id: uid(), bg: '#FBF8F1', elements: [mkText('Catatan', 30, 60, 340, 30, { font: 'sans', size: 14, color: '#7A6A5E' })] });
  return pages;
}
