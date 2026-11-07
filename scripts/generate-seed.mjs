// Alat pengembang: membuat satu-satunya berkas basis data (database/cerita_rakyat.sql) dari scripts/schema.sql + data contoh,
// sekaligus ilustrasi sampul di frontend/public/illustrations/.
// Jalankan ulang bila struktur tabel atau isi cerita contoh diubah:  node scripts/generate-seed.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'frontend/public/illustrations'), { recursive: true });

const ADMIN_HASH = '$2y$10$wOwjgLmYnYJRimTYnN847uhplYqQaMViSEMs2pHwXNK67kTGYhto.'; // Admin123!
const REVIEWER_HASH = '$2y$10$wN0LTr.jgyAB2Sj0KF4B2ue0H/rut9RGGrFLk70uAGEn9UGZDMmLm'; // Reviewer123!
const USER_HASH = '$2y$10$U9XZMAOvedGvSsxea3oHN.PCmjyCv9in9vSSBrC/F9X0qOgb5k2/K'; // User1234

const stories = [
  {
    slug: 'malin-kundang', title: 'Malin Kundang', region: 'Padang', province: 'Sumatera', category: 'Legenda', status: 'published',
    palette: ['#123C4A', '#E8A33D', '#0A2330'],
    short: 'Anak nelayan yang lupa pada ibunya setelah menjadi saudagar kaya, dan akibat dari kesombongannya.',
    paras: [
      'Di sebuah pesisir Sumatera Barat, hiduplah seorang janda miskin bersama anak laki-lakinya, Malin Kundang. Mereka hidup sederhana dari hasil menangkap ikan.',
      'Ketika beranjak dewasa, Malin ingin mengubah nasib. Ia ikut berlayar bersama saudagar kaya. Ibunya melepas dengan air mata dan doa agar anaknya selalu ingat pulang.',
      'Bertahun-tahun berlalu. Malin menjadi saudagar kaya, menikah dengan putri bangsawan, dan memiliki kapal megah. Kapalnya suatu hari singgah di kampung halamannya.',
      'Sang ibu berlari ke dermaga dan memeluk Malin. Namun Malin malu pada istrinya dan pada anak buahnya. Ia mendorong ibunya dan berkata, "Aku tidak punya ibu miskin seperti dirimu!"',
      'Dengan hati hancur, sang ibu menengadah dan berdoa. Langit menggelap, badai datang, dan kapal Malin pecah dihantam ombak. Tubuh Malin membatu di tepi pantai.',
      'Konon, batu berbentuk orang yang bersujud itu masih terlihat di Pantai Air Manis, Padang, sebagai pengingat bahwa kasih ibu tak boleh dibalas dengan kesombongan.',
    ],
    moral: 'Hormati dan sayangi ibu. Kekayaan tidak berarti apa-apa bila melupakan orang yang membesarkan kita.',
  },
  {
    slug: 'sangkuriang', title: 'Sangkuriang dan Gunung Tangkuban Perahu', region: 'Bandung', province: 'Jawa', category: 'Legenda', status: 'published',
    palette: ['#3B1F4D', '#F0B54A', '#1F0F2E'],
    short: 'Kisah pemuda sakti yang jatuh cinta pada perempuan yang ternyata ibunya, dan perahu yang menjadi gunung.',
    paras: [
      'Dayang Sumbi adalah putri raja yang cantik dan pandai menenun. Ia memiliki anak bernama Sangkuriang, yang tumbuh menjadi pemburu yang gagah dan sakti.',
      'Suatu hari, Sangkuriang tanpa sengaja melukai Si Tumang, anjing setia yang tak ia ketahui adalah ayahnya. Dayang Sumbi marah dan mengusirnya dari rumah.',
      'Bertahun-tahun kemudian, Sangkuriang kembali dan bertemu seorang perempuan yang masih sangat muda. Ia jatuh cinta tanpa tahu bahwa perempuan itu ibunya sendiri.',
      'Dayang Sumbi mengenali bekas luka di kepala Sangkuriang. Untuk menggagalkan pernikahan, ia meminta syarat mustahil: sebuah telaga dan perahu besar harus selesai dalam satu malam.',
      'Sangkuriang dibantu para makhluk gaib hampir berhasil. Dayang Sumbi menebarkan kain tenunnya hingga fajar tampak merekah, dan para makhluk gaib pun lari.',
      'Marah, Sangkuriang menendang perahunya hingga tertelungkup. Perahu itu menjadi Gunung Tangkuban Perahu yang kita kenal hingga kini.',
    ],
    moral: 'Kemarahan dan nafsu yang tak terkendali hanya melahirkan penyesalan.',
  },
  {
    slug: 'timun-mas', title: 'Timun Mas', region: 'Jawa Tengah', province: 'Jawa', category: 'Dongeng', status: 'published',
    palette: ['#1D4D3A', '#F2B84B', '#0F2A20'],
    short: 'Gadis cerdik yang lolos dari kejaran raksasa dengan bekal empat bungkusan ajaib.',
    paras: [
      'Mbok Rondo hidup sebatang kara dan sangat ingin memiliki anak. Seorang raksasa memberinya biji mentimun, dengan syarat anak itu kelak diserahkan padanya.',
      'Dari biji itu tumbuh buah mentimun emas, dan dari dalamnya lahir seorang bayi perempuan. Ia diberi nama Timun Mas.',
      'Saat Timun Mas dewasa, sang raksasa datang menagih janji. Mbok Rondo membekali putrinya dengan empat bungkusan: biji mentimun, jarum, garam, dan terasi.',
      'Timun Mas berlari sekencang mungkin. Biji mentimun yang ia lempar berubah menjadi ladang, jarum menjadi hutan bambu, dan garam menjadi lautan luas.',
      'Raksasa tetap mengejar. Bungkusan terakhir, terasi, berubah menjadi danau lumpur mendidih yang menelan sang raksasa.',
      'Timun Mas pulang dengan selamat, dan hidup bahagia bersama ibunya.',
    ],
    moral: 'Kecerdikan, keberanian, dan doa ibu adalah bekal terbaik menghadapi bahaya.',
  },
  {
    slug: 'danau-toba', title: 'Legenda Danau Toba', region: 'Samosir', province: 'Sumatera', category: 'Legenda', status: 'published',
    palette: ['#0F4C5C', '#F4C95D', '#08303A'],
    short: 'Janji yang dilanggar mengubah sebuah lembah subur menjadi danau terluas di Asia Tenggara.',
    paras: [
      'Dahulu, seorang petani bernama Toba hidup sendirian di lembah yang subur. Suatu hari ia menangkap ikan emas yang ternyata adalah seorang putri yang terkena kutukan.',
      'Sang putri bersedia menikah dengan Toba, dengan satu syarat: Toba tidak boleh pernah mengungkit asal-usulnya. Mereka hidup bahagia dan dikaruniai seorang putra.',
      'Anak itu tumbuh nakal dan selalu lapar. Suatu hari ia menghabiskan bekal ayahnya. Dalam amarahnya, Toba berteriak, "Dasar anak keturunan ikan!"',
      'Janji itu terlanggar. Sang istri dan anaknya menghilang, dan dari tanah tempat mereka berpijak, air memancar deras tanpa henti.',
      'Lembah itu pun tenggelam. Genangan airnya menjadi Danau Toba, dengan Pulau Samosir di tengahnya sebagai sisa daratan.',
    ],
    moral: 'Menepati janji dan menjaga ucapan adalah tanda kedewasaan.',
  },
  {
    slug: 'cenderawasih', title: 'Asal Mula Burung Cenderawasih', region: 'Papua', province: 'Papua', category: 'Fabel', status: 'published',
    palette: ['#0B3C49', '#F28C28', '#061F26'],
    short: 'Burung surga dari tanah Papua, dan kisah tentang keindahan yang tumbuh dari ketulusan.',
    paras: [
      'Di hutan Papua yang lebat, hiduplah seekor burung kecil berbulu cokelat sederhana. Ia sering diejek burung lain karena penampilannya.',
      'Meski begitu, burung kecil itu rajin merawat hutan. Ia menyebar biji ke tanah kosong, membersihkan sarang burung yang sakit, dan menyanyikan lagu untuk hutan setiap pagi.',
      'Penguasa langit melihat ketulusannya. Pada suatu pagi, ia menurunkan cahaya fajar yang membasuh bulu sang burung.',
      'Bulunya berubah menjadi merah, kuning, dan jingga, dengan ekor panjang yang menjuntai bak selendang. Ia kini dikenal sebagai Cenderawasih, burung surga.',
      'Hingga kini masyarakat Papua menjaga burung ini sebagai lambang keindahan dan kehormatan.',
    ],
    moral: 'Kebaikan yang tulus pada akhirnya akan bersinar, sekalipun tak ada yang melihatnya.',
  },
  {
    slug: 'batu-menangis', title: 'Batu Menangis', region: 'Kalimantan Barat', province: 'Kalimantan', category: 'Legenda', status: 'approved',
    palette: ['#3F2A1D', '#E8B04C', '#241711'],
    short: 'Seorang gadis yang malu pada ibunya sendiri, hingga bumi menelannya menjadi batu yang terus menangis.',
    paras: [
      'Di sebuah desa terpencil di Kalimantan, tinggal seorang gadis cantik bersama ibunya yang miskin. Gadis itu pemalas dan selalu malu pada keadaan ibunya.',
      'Ketika berjalan ke pasar, sang ibu selalu diminta berjalan jauh di belakang. Bila ditanya, gadis itu mengaku bahwa sang ibu adalah pembantunya.',
      'Ibu yang terluka berdoa. Perlahan tubuh sang gadis mengeras menjadi batu, dan dari matanya mengalir air tanpa henti.',
    ],
    moral: 'Jangan malu pada orang tua apa pun keadaannya.',
  },
  {
    slug: 'asal-usul-danau-sentani', title: 'Asal Mula Danau Sentani', region: 'Jayapura', province: 'Papua', category: 'Mitos', status: 'pending', owner: 2,
    palette: ['#1A4B5E', '#F2C14E', '#0C2733'],
    short: 'Cerita dari masyarakat Sentani tentang terbentuknya danau yang mengelilingi pulau-pulau kecil di Jayapura.',
    paras: [
      'Masyarakat Sentani menuturkan bahwa danau mereka lahir dari air yang tak kunjung berhenti mengalir setelah sebuah peristiwa besar di masa lampau.',
      'Dari tutur yang diwariskan, pulau-pulau kecil di tengah danau menjadi tempat tinggal para leluhur yang menjaga keseimbangan alam.',
      'Hingga kini, Danau Sentani dijaga sebagai sumber kehidupan: tempat menangkap ikan, melukis kulit kayu, dan merayakan Festival Danau Sentani setiap tahun.',
    ],
    moral: 'Alam adalah warisan yang harus kita jaga bersama.',
  },
];

// ---------- Ilustrasi sampul ----------
function cover(s, H = 480) {
  const [a, gold, b] = s.palette;
  let seed = [...s.slug].reduce((n, c) => n + c.charCodeAt(0), 7);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let motifs = '';
  for (let i = 0; i < 7; i++) {
    const cx = 40 + rnd() * 320, cy = 60 + rnd() * (H - 100), r = 14 + rnd() * 46;
    motifs += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="none" stroke="${gold}" stroke-opacity="${(0.12 + rnd() * 0.22).toFixed(2)}" stroke-width="2"/>`;
  }
  const dy = H - 480;
  const hills = `<g transform="translate(0 ${dy})"><path d="M0 360 C 70 300 140 330 200 300 S 330 270 400 320 V 480 H0Z" fill="${b}"/><path d="M0 410 C 90 370 170 400 250 372 S 360 360 400 380 V 480 H0Z" fill="${a}" fill-opacity=".85"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ${H}" role="img" aria-label="Ilustrasi ${s.title}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="${H}" fill="url(#g)"/>${motifs}<circle cx="290" cy="${130 + dy / 3}" r="54" fill="${gold}"/><circle cx="290" cy="${130 + dy / 3}" r="70" fill="none" stroke="${gold}" stroke-opacity=".4" stroke-width="2"/>${hills}</svg>`;
}
for (const s of stories) {
  writeFileSync(join(root, `frontend/public/illustrations/${s.slug}.svg`), cover(s)); // ilustrasi di dalam flipbook (5:6)
  writeFileSync(join(root, `frontend/public/illustrations/${s.slug}-sampul.svg`), cover(s, 600)); // sampul cerita (2:3, mengisi kartu penuh)
}

// ---------- Flipbook ----------
const W = 400, H = 560;
let uid = 0;
const id = () => 'e' + (++uid).toString(36);
const text = (t, x, y, w, h, o = {}) => ({ id: id(), type: 'text', text: t, x, y, w, h, rotation: 0, opacity: 1, font: 'reading', size: 17, color: '#241519', bold: false, italic: false, align: 'left', lineHeight: 1.55, anim: { type: 'none', delay: 0, duration: 0.8 }, ...o });
const shape = (x, y, w, h, fill, o = {}) => ({ id: id(), type: 'shape', shape: 'rect', x, y, w, h, rotation: 0, opacity: 1, fill, radius: 0, anim: { type: 'none', delay: 0, duration: 0.8 }, ...o });
const image = (src, x, y, w, h, alt, o = {}) => ({ id: id(), type: 'image', src, alt, x, y, w, h, rotation: 0, opacity: 1, radius: 0, anim: { type: 'none', delay: 0, duration: 0.8 }, ...o });

function flipbook(s) {
  const [a, gold, b] = s.palette;
  const pages = [];
  pages.push({
    id: id(), bg: a, elements: [
      image(`illustrations/${s.slug}-sampul.svg`, 0, 0, W, H, `Sampul ${s.title}`),
      text(s.title, 30, 400, 340, 90, { font: 'serif', size: 30, color: '#FFFFFF', bold: true, lineHeight: 1.2, anim: { type: 'slideUp', delay: 0.2, duration: 0.9 } }),
      text(`${s.region}, ${s.province}`, 30, 500, 340, 26, { font: 'sans', size: 14, color: gold, anim: { type: 'fade', delay: 0.7, duration: 0.9 } }),
    ],
  });
  const chunks = [];
  for (let i = 0; i < s.paras.length; i += 2) chunks.push(s.paras.slice(i, i + 2));
  chunks.forEach((c, i) => {
    const els = [
      shape(30, 36, 44, 5, gold, { anim: { type: 'slideRight', delay: 0, duration: 0.6 } }),
      text(c.join('\n\n'), 30, 62, 340, 420, { size: 17, anim: { type: 'fade', delay: 0.15, duration: 0.9 } }),
      text(String(i + 2), 30, 514, 340, 22, { font: 'sans', size: 12, color: '#7A6A5E', align: i % 2 ? 'right' : 'left' }),
    ];
    pages.push({ id: id(), bg: i % 2 ? '#F3EFE6' : '#FBF8F1', elements: els });
  });
  pages.push({
    id: id(), bg: b, elements: [
      shape(30, 90, 340, 3, gold),
      text('Pesan dari cerita', 30, 116, 340, 30, { font: 'sans', size: 14, color: gold }),
      text(s.moral, 30, 160, 340, 200, { font: 'serif', size: 24, color: '#FFFFFF', italic: true, lineHeight: 1.4, anim: { type: 'slideUp', delay: 0.2, duration: 1 } }),
      shape(300, 420, 70, 70, gold, { shape: 'circle', opacity: 0.9, anim: { type: 'float', delay: 0, duration: 3 } }),
      text('Tamat', 30, 440, 240, 40, { font: 'serif', size: 28, color: '#FFFFFF', bold: true }),
    ],
  });
  if (pages.length % 2) pages.push({ id: id(), bg: a, elements: [text('Cerita Rakyat Nusantara', 30, 260, 340, 40, { font: 'serif', size: 20, color: gold, align: 'center' })] });
  return pages;
}

// ---------- SQL ----------
const q = (v) => (v === null || v === undefined ? 'NULL' : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'");
const ts = (daysAgo) => { const d = new Date(Date.now() - daysAgo * 864e5); return d.toISOString().slice(0, 19).replace('T', ' '); };
let sql = `-- Data contoh. Dihasilkan oleh database/generate-seed.mjs\n`;
sql += `INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES\n`;
sql += `(1, 'Admin Utama', 'admin@ceritarakyat.id', ${q(ADMIN_HASH)}, 'admin', ${q(ts(40))}),\n`;
sql += `(2, 'Pengguna Contoh', 'user@ceritarakyat.id', ${q(USER_HASH)}, 'user', ${q(ts(30))}),\n`;
sql += `(3, 'Reviewer Contoh', 'reviewer@ceritarakyat.id', ${q(REVIEWER_HASH)}, 'reviewer', ${q(ts(35))});\n\n`;

let fid = 0, pid = 0;
stories.forEach((s, i) => {
  const sid = i + 1;
  const full = s.paras.join('\n\n') + '\n\n' + s.moral;
  const status = s.status;
  sql += `INSERT INTO stories (id, user_id, title, region, province, category, short_description, full_story, image_url, author, status, created_at, updated_at) VALUES (${sid}, ${s.owner ?? 1}, ${q(s.title)}, ${q(s.region)}, ${q(s.province)}, ${q(s.category)}, ${q(s.short)}, ${q(full)}, ${q('illustrations/' + s.slug + '-sampul.svg')}, ${q(s.owner === 2 ? 'Pengguna Contoh' : 'Tim Redaksi')}, ${q(status)}, ${q(ts(20 - i))}, ${q(ts(10 - i))});\n`;
  if (status === 'published') {
    fid++;
    sql += `INSERT INTO flipbooks (id, story_id, status, settings, published_at, created_at, updated_at) VALUES (${fid}, ${sid}, 'published', ${q('{"speed":"normal"}')}, ${q(ts(9 - i))}, ${q(ts(12))}, ${q(ts(9 - i))});\n`;
    flipbook(s).forEach((p, n) => {
      pid++;
      const { elements, ...rest } = p;
      sql += `INSERT INTO flipbook_pages (id, flipbook_id, page_no, page_uid, bg, content) VALUES (${pid}, ${fid}, ${n + 1}, ${q(p.id)}, ${q(p.bg)}, ${q(JSON.stringify({ elements }))});\n`;
    });
  }
});
sql += `\nINSERT INTO favorites (user_id, story_id, created_at) VALUES (2, 1, ${q(ts(5))}), (2, 5, ${q(ts(3))});\n`;
sql += `INSERT INTO notifications (user_id, sender_user_id, type, message, is_read, created_at) VALUES\n`;
sql += `(1, 2, 'story_submitted', ${q('Cerita baru menunggu persetujuan: "Asal Mula Danau Sentani" dari Pengguna Contoh.')}, 0, ${q(ts(1))}),\n`;
sql += `(3, 2, 'story_submitted', ${q('Cerita baru menunggu persetujuan: "Asal Mula Danau Sentani" dari Pengguna Contoh.')}, 0, ${q(ts(1))}),\n(2, 1, 'welcome', ${q('Selamat datang di Cerita Rakyat Nusantara! Kirim ceritamu lewat menu "Tulis Cerita".')}, 0, ${q(ts(2))});\n`;
sql += `\n-- Contoh log aktivitas admin\nINSERT INTO admin_logs (admin_id, admin_name, action, target_type, target_id, target_label, detail, created_at) VALUES\n(1, 'Admin Utama', 'story.approve', 'story', 6, 'Batu Menangis', NULL, ${q(ts(7))}),\n(1, 'Admin Utama', 'flipbook.save', 'story', 1, 'Malin Kundang', '8 halaman', ${q(ts(11))}),\n(1, 'Admin Utama', 'story.publish', 'story', 1, 'Malin Kundang', NULL, ${q(ts(11))});\n`;
sql += '\n-- Contoh jumlah pembaca (untuk bagian Populer)\nUPDATE stories SET views = 1280 WHERE id = 1;\nUPDATE stories SET views = 940 WHERE id = 2;\nUPDATE stories SET views = 1710 WHERE id = 3;\nUPDATE stories SET views = 620 WHERE id = 4;\nUPDATE stories SET views = 385 WHERE id = 5;\n';
import { readFileSync } from 'node:fs';
const schema = readFileSync(join(root, 'scripts/schema.sql'), 'utf8').split('\n').slice(3).join('\n').trimEnd();
writeFileSync(join(root, 'database/cerita_rakyat.sql'), '-- Cerita Rakyat Nusantara: basis data lengkap (struktur + data contoh) dalam satu berkas.\n-- Impor:  mysql -u root -p < database/cerita_rakyat.sql   (atau lewat phpMyAdmin > Import)\n\n' + schema + '\n\n' + sql);
console.log('database/cerita_rakyat.sql dan ilustrasi dibuat:', stories.length, 'cerita,', pid, 'halaman flipbook');
