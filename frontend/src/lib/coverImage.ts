/**
 * Menyesuaikan gambar sampul ke rasio 2:3 (seperti sampul buku) tanpa memotong:
 * - gambar yang sudah hampir 2:3 diisi penuh;
 * - selain itu gambar ditaruh utuh di tengah dan sisanya diisi versi kabur dari gambar yang sama.
 * Hasilnya JPEG 800x1200 sehingga ukuran berkas juga kecil. Bila gagal, berkas asli dikembalikan.
 */
const W = 800, H = 1200;

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('gambar rusak')); i.src = url; });
}

export async function fitCover(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return file;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    if (Math.abs((iw / ih) / (W / H) - 1) <= 0.05) {
      ctx.drawImage(img, 0, 0, W, H);
    } else {
      // latar kabur: gambar kecil (cover) diperbesar; bekerja di semua browser tanpa ctx.filter
      const t = document.createElement('canvas'); t.width = 24; t.height = 36;
      const tc = t.getContext('2d')!;
      const k0 = Math.max(24 / iw, 36 / ih);
      tc.drawImage(img, (24 - iw * k0) / 2, (36 - ih * k0) / 2, iw * k0, ih * k0);
      ctx.drawImage(t, 0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(0, 0, W, H);
      const k = Math.min(W / iw, H / ih);
      ctx.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
    }
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.88));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'sampul';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}
