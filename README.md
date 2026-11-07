# Cerita Rakyat Nusantara

Website cerita rakyat dengan buku flipbook interaktif, sesuai dokumen SRS Kelompok 4.
Stack: React + TypeScript (frontend), PHP (API), MySQL (basis data).

## Alur sistem

1. Pengguna mengirim cerita (teks dan gambar). Statusnya **Menunggu persetujuan** dan hanya tulisannya yang terlihat.
2. Admin atau reviewer menyetujui (ACC) atau menolak dengan alasan. Cerita yang disetujui berstatus **Disetujui, menunggu diterbitkan**.
3. Admin atau reviewer merancang buku di **editor flipbook** (teks, gambar, bentuk, hiasan, animasi), lalu **menerbitkan**.
4. Cerita terbit tampil untuk publik sebagai flipbook yang bisa dibalik seperti buku sungguhan.

Hanya admin dan reviewer/publisher yang dapat mengakses editor dan menerbitkan.

## Peran akun

| Peran | Jumlah | Hak akses |
|---|---|---|
| **Admin** | Hanya **satu** (tidak bisa ditambah, diubah, atau dihapus lewat aplikasi) | Semua hak reviewer, ditambah **kelola akun** (buat reviewer, jadikan pengguna sebagai reviewer atau sebaliknya, reset password, hapus akun), log aktivitas, backup data, dan pengaturan email |
| **Reviewer / publisher** | Bebas, dibuat oleh admin | **Kelola cerita**: menyetujui/menolak, editor flipbook, menerbitkan/membatalkan terbit, menghapus cerita, pustaka gambar, dan permintaan edit/hapus dari penulis. Tidak bisa mengelola akun, melihat log, backup, atau pengaturan |
| **Pengguna** | Bebas, mendaftar sendiri | Membaca, memberi favorit, mengirim dan mengubah ceritanya sendiri |

Pendaftaran publik selalu menghasilkan akun **Pengguna**. Hak akses diperiksa di server (`require_admin()` dan `require_staff()` di `backend/lib.php`), bukan hanya disembunyikan di menu.

Batasan satu admin juga dikunci di database (schema v8): kolom turunan `users.single_admin` bernilai 1 hanya untuk admin dan memiliki indeks UNIQUE, sehingga admin kedua ditolak MySQL/MariaDB (5.7+/10.2+) meski ditambahkan lewat phpMyAdmin atau SQL langsung. Reviewer tidak dibatasi jumlahnya.

Database lama otomatis dimigrasi saat permintaan pertama (schema v7): kolom `users.role` mendapat nilai `reviewer`. Bila data lama punya lebih dari satu admin, admin dengan id terkecil tetap menjadi admin dan yang lain diturunkan menjadi reviewer, jadi mereka tetap bisa mengelola cerita.

## Cara menjalankan (paling cepat)

Folder `public_html/` sudah berisi frontend hasil build dan API PHP, siap pakai.

1. Impor satu berkas basis data (struktur + data contoh) ke MySQL/MariaDB:
   ```
   mysql -u root -p < database/cerita_rakyat.sql
   ```
   Atau lewat phpMyAdmin: menu Import, pilih `database/cerita_rakyat.sql`.
   Hanya ada **satu berkas basis data**. Database lama tidak perlu diubah manual: aplikasi menambah kolom/tabel yang kurang dan memperbaiki data lama otomatis sekali saat pertama dijalankan.
2. Atur koneksi di `public_html/api/config.local.php` (buat berkas ini):
   ```php
   <?php return ['db' => ['host' => '127.0.0.1', 'name' => 'cerita_rakyat', 'user' => 'root', 'pass' => '']];
   ```
3. Jalankan:
   - **XAMPP/Laragon**: salin isi `public_html/` ke `htdocs/cerita-rakyat/`, buka `http://localhost/cerita-rakyat/`.
   - **Server bawaan PHP**: `php -S localhost:8000 -t public_html` lalu buka `http://localhost:8000`.
   - **Hosting**: unggah isi `public_html/` ke folder web. Pastikan `api/uploads/` dapat ditulis.

Butuh PHP 8.1+ dengan ekstensi `pdo_mysql`, `fileinfo`, `mbstring`.

### Akun contoh (dari cerita_rakyat.sql, ganti sebelum dipakai publik)

| Peran | Email | Password |
|---|---|---|
| Admin | admin@ceritarakyat.id | Admin123! |
| Reviewer | reviewer@ceritarakyat.id | Reviewer123! |
| Pengguna | user@ceritarakyat.id | User1234 |

## Membangun ulang dari sumber

Butuh Node.js 18+.
```
npm run install:frontend    # memasang react, esbuild, typescript
npm run build               # build frontend lalu menyusun public_html/
npm run serve               # php -S localhost:8000 -t public_html
npm --prefix frontend run typecheck   # opsional: cek tipe TypeScript
```
Mode pengembangan: `php -S 127.0.0.1:8000 -t backend` di satu terminal, lalu `npm --prefix frontend run dev` (http://localhost:5173, API diteruskan otomatis).

## Struktur

```
public_html/   hasil build siap deploy (frontend + api/)
frontend/      sumber React/TypeScript (src/pages, src/editor, src/components)
backend/       sumber API PHP (index.php = router, handlers.php, lib.php)
database/      cerita_rakyat.sql (satu-satunya berkas basis data: struktur + data contoh)
scripts/       assemble.mjs, generate-seed.mjs + schema.sql (alat pengembang untuk membuat ulang cerita_rakyat.sql)
scripts/       assemble.mjs (menyusun public_html)
```

## Pemetaan ke SRS

| SRS | Implementasi |
|---|---|
| FR-01 s.d. FR-05 | Beranda, katalog dengan pencarian dan filter pulau/kategori, halaman detail |
| FR-06, FR-07 | Registrasi/login/logout (sesi PHP, password di-hash bcrypt), favorit |
| FR-08, FR-09 | Form kirim cerita dengan unggah gambar, status awal "menunggu" |
| FR-10, FR-11 | Admin menyetujui/menolak; permintaan edit/hapus cerita yang sudah disetujui |
| FR-12 | Notifikasi untuk pengguna dan admin |
| FR-13 s.d. FR-15 | Otorisasi tiga peran (admin, reviewer, pengguna) di setiap endpoint admin, validasi form, umpan balik (toast, pesan galat) |
| Pengembangan flipbook | Pembaca flip 3D (klik, geser, keyboard; 2 halaman di desktop, 1 di HP), editor ala Canva khusus admin, animasi elemen, simpan draf, pratinjau, terbit/batal terbit |

## Fitur baru (versi 2)

- **Buku terpopuler**: tiap cerita menghitung pembaca (1 kali per sesi). Beranda dan katalog punya urutan "Terpopuler"; admin punya peringkat di Ringkasan.
- **Notifikasi** untuk pengguna dan admin (lonceng, halaman `Notifikasi`, tandai dibaca), plus toast saat masuk dan keluar.
- **Email SMTP** untuk cerita masuk, disetujui, ditolak, terbit, permintaan, akun baru, dan akun dihapus. Buat `backend/config.local.php` (di server: `api/config.local.php`):

```php
<?php return [
  'mail' => [
    'host' => 'smtp.gmail.com', 'port' => 587, 'secure' => 'tls',
    'user' => 'akunmu@gmail.com', 'pass' => 'sandi-aplikasi',
    'from_email' => 'akunmu@gmail.com', 'app_url' => 'https://situsmu.id/',
  ],
];
```

  Kosongkan `host` untuk menonaktifkan email (notifikasi di dalam aplikasi tetap jalan). Pengaturan email hanya lewat berkas konfigurasi (tidak ada lagi panel SMTP di dashboard); endpoint `admin/mail` dan `admin/mail/test` tetap tersedia untuk uji. Untuk Gmail pakai "Sandi aplikasi".
- **Favorit dipisah per jenis** (Legenda, Fabel, dan seterusnya).
- **Halaman menulis ala Wattpad** dengan tombol Kembali, draf otomatis tersimpan di perangkat, dan bagian "Draf belum dikirim" di Dashboard untuk melihat atau melanjutkan.
- **Tanpa unduh PDF**: cerita hanya bisa dibaca di dalam situs (seperti Wattpad), tidak ada tombol unduh.
- **Editor buku**: snap ke elemen lain, salin/tempel (Ctrl+C/V/X), Tab untuk berpindah elemen, Ctrl+[ dan ] untuk urutan lapisan, simpan otomatis (untuk buku yang belum terbit).

### Perubahan database

Ada **satu kolom baru**: `stories.views`. Instalasi baru memakainya otomatis. Untuk database lama, kolom ditambahkan otomatis saat permintaan pertama. Data lama tidak berubah.

## Keamanan singkat

- Query memakai prepared statement; password memakai `password_hash`.
- Endpoint admin memeriksa role di server. Data flipbook dari editor disanitasi (tipe elemen, warna, ukuran, URL).
- Unggahan dibatasi JPG/PNG/WEBP/GIF maks. 5 MB, diperiksa isinya, dinamai acak, dan folder `uploads/` tidak mengeksekusi skrip.
- Gunakan HTTPS di server produksi. Password akun contoh wajib diganti: panel admin menampilkan peringatan merah selama password bawaan masih dipakai.

## Catatan

- Font Fraunces dan Plus Jakarta Sans dimuat dari Google Fonts (butuh internet; tanpa itu dipakai font sistem).
- Gambar sampul contoh adalah ilustrasi buatan sendiri di `frontend/public/illustrations/`.

## Mengelola unggahan gambar di editor (v5)

Tab **Gambar** di editor mengikuti pola "Unggahan" di Canva:

- Tombol **Unggah file**, kotak pencarian, dan kisi 2 kolom. Arahkan kursor ke gambar untuk memunculkan centang dan menu titik tiga (Tambah ke halaman, Pilih, Hapus).
- **Hapus satu gambar**: menu titik tiga, lalu Hapus. **Hapus banyak**: centang beberapa gambar, lalu Hapus di bilah bawah.
- **Bersihkan tak terpakai**: menghapus semua gambar yang belum dipakai di buku mana pun.
- Gambar yang masih dipakai di sebuah buku (diberi label "Dipakai") hanya dilepas dari daftar unggahan. Berkasnya tetap ada di server supaya buku tidak kehilangan gambar.

Endpoint baru (khusus admin): `DELETE api/index.php?r=admin/assets/{id}` dan `POST api/index.php?r=admin/assets/bulk-delete` dengan isi `{"ids":[1,2]}` atau `{"unused":true}`.

## Perubahan v7

- **Fitur unduh PDF dihapus** agar cerita hanya dibaca di situs.
- **Pembaca buku untuk cerita panjang**: tombol "Halaman" membuka pemilih halaman (ketik nomor, Awal/Tengah/Akhir, atau pilih dari daftar nomor). Penggeser halaman kini langsung berpindah tanpa animasi, lompatan jauh tidak lagi membalik halaman satu per satu, dan tombol Home/End pindah ke awal/akhir buku.

## Perubahan v7.4

- **Menu akun punya "Cerita saya"** (juga di menu HP): membuka Dashboard dan langsung menggulung ke daftar cerita yang dikirim (`/dashboard?bagian=cerita`).

## Perubahan v7.3

- **Dashboard lebih ringkas**: daftar "Cerita favorit saya" yang besar diganti satu baris kecil menuju halaman Favorit (menu Favorit di bilah atas).
- **"Cerita saya" di HP**: kartu tidak lagi setengah lebar; lencana status dan label progres tidak terpotong.

## Perubahan v7.2

- **Beranda dan katalog menyegarkan diri otomatis** tiap 30 detik (dan saat tab dibuka kembali): cerita baru terbit dan angka "dibaca" muncul tanpa memuat ulang halaman. Ini polling berkala, bukan koneksi langsung (WebSocket), jadi cocok untuk hosting PHP biasa.
- Alamat `/daftar` kini membuka form pendaftaran.

## Perubahan v7.1

- **Beranda menampilkan semua sampul**: bagian "Paling banyak dibaca" dan "Cerita pilihan" tidak lagi dibatasi 5-6 kartu. Semua cerita terbit tampil dalam satu baris yang mengisi lebar layar dan bisa digeser ke samping bila banyak.

## Perubahan v6

- **Fitur unduh cerita (PDF) dihapus** agar cerita hanya dibaca di situs. Pustaka `jspdf` ikut dibuang.
- **Sampul tampil utuh bergaya Wattpad.** Kartu cerita memakai rasio 2:3 (2 kolom di HP), gambar tidak dipotong (`object-fit: contain` dengan latar blur dari gambar yang sama). Halaman detail menampilkan sampul penuh di samping judul dan tombol "Mulai membaca". Pratinjau sampul di form tulis dan daftar admin juga tidak terpotong.
- **Perbaikan bug**: pencarian katalog memakai `ESCAPE '\\'` yang menyebabkan galat sintaks di MySQL (diganti `ESCAPE '!'`); ekspor PDF gagal untuk sampul SVG di Firefox (ukuran gambar terbaca 0); galat tipe TypeScript di `FlipBook.tsx` (`npm --prefix frontend run typecheck` kini bersih).
- **Notifikasi tidak lagi dikirim ke diri sendiri.** Admin yang menerbitkan/menyetujui cerita miliknya sendiri tidak menerima notifikasi "Ceritamu … sudah terbit" (dan emailnya). Untuk database lama, notifikasi semacam itu dibersihkan otomatis sekali saat aplikasi pertama dijalankan.

### Pencarian, akun, dan log aktivitas admin (v6)

- **Kelola cerita**: kotak cari (judul, daerah, nama penulis) plus filter pulau, kategori, dan status.
- **Pengguna dan admin**: dipisah menjadi tab *Semua akun / Admin / Pengguna* dengan jumlahnya, lencana peran di tiap akun, dan pencarian nama atau email. Tiap admin punya tombol *Aktivitas* yang membuka log miliknya.
- **Log aktivitas** (menu baru, `admin/log`): mencatat siapa yang menyetujui, menolak, menerbitkan, membatalkan terbit, mengubah, atau menghapus cerita; menyimpan flipbook; memproses permintaan penulis; membuat atau menghapus akun; menghapus gambar unggahan; masuk ke panel; dan kirim email uji. Bisa dicari, difilter per jenis, per admin, dan per waktu. Simpan otomatis di editor digabung per buku (rentang 15 menit) agar log tidak penuh. Nama admin disalin ke log sehingga jejak tetap terbaca walau akunnya dihapus.
- Tabel `admin_logs` dibuat otomatis saat pertama dijalankan. Endpoint baru: `GET api/index.php?r=admin/logs` (q, group, admin, range, limit, offset).
- **Log dihapus otomatis.** Catatan lebih dari 90 hari dibersihkan sendiri (tanpa cron: dicek saat log dicatat dan saat halaman log dibuka). Ubah lamanya lewat `api/config.local.php`, misalnya `<?php return ['log_retention_days' => 30];`, atau isi `0` untuk menyimpan selamanya.
- **Ringkasan admin dirapikan**: satu daftar "Perlu dikerjakan" (persetujuan, siap terbit, perlu desain, permintaan penulis) dengan tombol aksi langsung, plus Paling banyak dibaca dan Aktivitas terbaru. Tombol "Lihat situs" dan panel SMTP dihapus.

### Keamanan dan backup (v6)

- **Ganti password**: admin lewat menu *Pengaturan*, pengguna lewat tombol *Ganti password* di Dashboard (`POST auth/password`, min. 8 karakter, wajib memasukkan password lama). Selama akun admin masih memakai password bawaan (`Admin123!`), muncul banner peringatan di semua halaman admin.
- **Backup**: *Pengaturan > Unduh backup* menghasilkan ZIP berisi `database.sql` (struktur + data, bisa diimpor ke database kosong) dan folder `uploads/`, lengkap dengan `BACA-SAYA.txt`. Jika ekstensi ZipArchive tidak ada di server, yang diunduh hanya berkas `.sql`. Setiap unduhan tercatat di log aktivitas (kelompok *Sistem*). Berkas backup memuat hash password, jadi simpan dengan aman.
- **Pengaturan > Email**: status SMTP dan tombol kirim email uji (dipindah dari dashboard).

### Beranda, sampul, SMTP, dan Bagikan (v6)

- **Beranda terisi penuh**: tiap bagian (Paling banyak dibaca, Cerita pilihan) mengambil 6 cerita dan grid menyesuaikan jumlah kolom (6, 5, 4, 3, atau 2) sehingga baris selalu penuh sampai tepi.
- **Sampul penuh rasio 2:3**: kartu tidak lagi memakai tumpukan gradien dan chip di atas sampul (kategori pindah ke badan kartu). Sampul bawaan dibuat ulang sebagai `illustrations/*-sampul.svg` (400x600). Sampul yang diunggah penulis otomatis dirapikan di browser ke 800x1200 JPEG: seluruh gambar tetap terlihat, sisanya diisi versi kabur dari gambar itu sendiri. Untuk database lama, sampul contoh dialihkan ke berkas baru secara otomatis.
- **SMTP dari panel admin**: *Pengaturan > Email notifikasi* berisi formulir (server, port, keamanan, username, sandi, pengirim) dengan isi cepat Gmail/Microsoft 365/Yahoo, tombol uji kirim, dan pesan galat yang menjelaskan apa yang harus diperbaiki. Pengaturan disimpan di tabel `settings` dan menggantikan `config.local.php`; sandi tidak pernah dikirim balik ke browser dan tidak ikut di backup. Pasangan port/enkripsi yang salah (465 dengan TLS, 587 dengan SSL) diperbaiki otomatis, dan metode login AUTH PLAIN didukung selain LOGIN.
- **Bagikan cerita**: tombol *Bagikan* di halaman cerita dan di pembaca buku. Di HP membuka lembar bagikan bawaan; di komputer membuka jendela berisi tautan salin dan tombol WhatsApp, Facebook, X, Telegram, dan Email. Tautannya `api/share.php?id=ID`: crawler membaca judul, deskripsi, dan sampul (tag Open Graph) sehingga pratinjau muncul di WhatsApp/Facebook, sedangkan pengunjung langsung dialihkan ke `#/cerita/ID`. Sampul SVG tidak dapat ditampilkan platform tersebut, jadi dipakai `og-default.png`. Hanya cerita berstatus terbit yang bisa dibagikan.

### Profil admin dan pengguna (v6)

- Halaman **Profil saya** (`/profil` untuk pengguna, `/admin/profil` untuk admin; admin yang membuka `/profil` dialihkan otomatis). Isinya: ubah nama, ubah email, dan ganti password di satu tempat. Menu: *Profil saya* di menu akun situs, di sidebar admin, dan kartu nama di dasar sidebar admin.
- **Mengganti email wajib memasukkan password saat ini** (nama tidak). Email baru dinormalkan ke huruf kecil dan dicek agar tidak dipakai akun lain. Alamat lama diberi tahu lewat email (bila SMTP aktif) dan akun menerima notifikasi, sehingga pemilik asli tahu bila perubahan bukan darinya. Endpoint: `PUT auth/profile` (name, email, current).
- Perubahan profil admin tercatat di log aktivitas (menampilkan nama/email lama dan baru).
- Form ganti password di Pengaturan dan Dashboard diganti tautan ke halaman profil agar tidak ada dua tempat.

### Lupa password (v6)

- **Lewat email** (butuh SMTP aktif): tautan *Lupa password?* di halaman masuk (`/lupa`) mengirim tautan `#/reset?token=…` yang berlaku 60 menit dan sekali pakai. Token acak 256-bit; di database hanya hash SHA-256-nya yang disimpan (tabel `password_resets`, tidak ikut backup). Respons sama untuk email terdaftar maupun tidak (akun tidak bisa ditebak), dibatasi 5 permintaan per IP dan 3 per akun tiap jam, dan permintaan baru menghanguskan tautan lama. Jika SMTP belum diatur, halaman memberi tahu agar menghubungi admin.
- **Reset oleh admin** (tanpa SMTP): *Pengguna dan admin > Reset password* membuat password sementara 12 karakter yang tampil satu kali; pemilik akun diminta menggantinya di Profil. Tidak bisa dipakai untuk akun sendiri. Keduanya tercatat di log aktivitas untuk akun admin.

## Perubahan v18: peran admin, reviewer/publisher, pengguna

- **Satu admin saja.** Endpoint `admin/admins` diganti `POST admin/reviewers`; tidak ada jalan membuat atau menghapus admin dari aplikasi. Admin tidak bisa mengubah peran atau menghapus dirinya sendiri.
- **Peran baru reviewer/publisher** untuk mengelola cerita. Admin bisa membuat akun reviewer baru atau menjadikan pengguna sebagai reviewer (`POST admin/users/{id}/role` dengan `{"role":"reviewer"|"user"}`).
- **Menu panel mengikuti peran.** Reviewer hanya melihat Ringkasan, Kelola cerita, Permintaan, Notifikasi, dan Profil. Halaman Kelola akun, Log aktivitas, dan Pengaturan khusus admin.
- Tindakan reviewer ikut tercatat di log aktivitas (hanya admin yang bisa melihat log). Cerita masuk dan permintaan penulis memberi notifikasi ke admin dan semua reviewer.
- Akun contoh baru: `reviewer@ceritarakyat.id` / `Reviewer123!` (ganti sebelum dipakai publik).


## Penyesuaian tampilan sampul cerita

- Halaman detail cerita kini menampilkan judul dan daerah asal di atas ilustrasi sampul, mengikuti komposisi sampul pada flipbook.
- Ditambahkan bingkai sampul marun, garis aksen emas, bayangan buku, dan efek lipatan sudut kanan bawah.
- File sumber yang diperbarui: `frontend/src/pages/StoryDetail.tsx` dan `frontend/src/styles/global.css`.
- Untuk memperbarui hasil produksi setelah perubahan sumber, jalankan `cd frontend`, `npm ci`, `npm run build`, lalu dari folder utama jalankan `node scripts/assemble.mjs`.
