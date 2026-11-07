// Sampul ilustrasi otomatis untuk cerita yang belum punya gambar: matahari, lingkaran motif, dan perbukitan,
// bergaya sama dengan sampul bawaan. Warna & susunannya tetap (deterministik) untuk judul yang sama.
const PALETTES: [string, string, string][] = [
  ['#123C4A', '#E8A33D', '#0A2330'], ['#3B1F4D', '#F0B54A', '#1F0F2E'], ['#1D4D3A', '#F2B84B', '#0F2A20'],
  ['#0F4C5C', '#F4C95D', '#08303A'], ['#0B3C49', '#F28C28', '#061F26'], ['#3F2A1D', '#E8B04C', '#241711'],
  ['#1A4B5E', '#F2C14E', '#0C2733'], ['#4A1A2C', '#F0A64A', '#2A0D18'],
];

const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

export function autoCoverSvg(key: string, H = 600): string {
  const [a, gold, b] = PALETTES[hash(key) % PALETTES.length];
  let seed = hash(key) % 233280 || 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let motifs = '';
  for (let i = 0; i < 7; i++) {
    const cx = 40 + rnd() * 320, cy = 60 + rnd() * (H - 100), r = 14 + rnd() * 46;
    motifs += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="none" stroke="${gold}" stroke-opacity="${(0.12 + rnd() * 0.22).toFixed(2)}" stroke-width="2"/>`;
  }
  const sx = 240 + Math.round(rnd() * 100), dy = H - 480;
  const sy = 130 + dy / 3;
  const hills = `<g transform="translate(0 ${dy})"><path d="M0 360 C 70 300 140 330 200 300 S 330 270 400 320 V 480 H0Z" fill="${b}"/><path d="M0 410 C 90 370 170 400 250 372 S 360 360 400 380 V 480 H0Z" fill="${a}" fill-opacity=".85"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="${H}" fill="url(#g)"/>${motifs}<circle cx="${sx}" cy="${sy}" r="54" fill="${gold}"/><circle cx="${sx}" cy="${sy}" r="70" fill="none" stroke="${gold}" stroke-opacity=".4" stroke-width="2"/>${hills}</svg>`;
}

/** Alamat gambar (data URI) sampul otomatis; `H` 600 untuk kartu, 330 untuk bagian atas halaman sampul buku. */
export function autoCoverUrl(story: { title?: string; province?: string }, H = 600): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(autoCoverSvg(`${story.title ?? ''}|${story.province ?? ''}`, H));
}
