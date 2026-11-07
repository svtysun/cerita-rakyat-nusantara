<?php
// Konfigurasi default. Untuk menimpa nilai, buat file config.local.php di folder ini
// (isinya `return [...]` dengan kunci yang sama) atau gunakan environment variable.
return [
    'db' => [
        'dsn'  => getenv('DB_DSN') ?: '', // kosong = pakai MySQL dari pengaturan di bawah
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DB_PORT') ?: '3306',
        'name' => getenv('DB_NAME') ?: 'cerita_rakyat',
        'user' => getenv('DB_USER') ?: 'root',
        'pass' => getenv('DB_PASS') ?: '',
    ],
    // Isi jika frontend dijalankan dari origin lain (mis. http://localhost:5173 tanpa proxy).
    'allowed_origin' => getenv('ALLOWED_ORIGIN') ?: '',
    // Email (SMTP). Kosongkan 'host' untuk menonaktifkan email; notifikasi dalam aplikasi tetap berjalan.
    // Contoh Gmail: host smtp.gmail.com, port 587, secure tls, user = alamat Gmail, pass = "Sandi aplikasi" Google.
    'mail' => [
        'host' => getenv('SMTP_HOST') ?: '',
        'port' => getenv('SMTP_PORT') ?: '587',
        'secure' => getenv('SMTP_SECURE') ?: 'tls', // tls (STARTTLS, port 587) | ssl (port 465) | kosong (tanpa enkripsi)
        'user' => getenv('SMTP_USER') ?: '',
        'pass' => getenv('SMTP_PASS') ?: '',
        'from_email' => getenv('SMTP_FROM') ?: '',
        'from_name' => 'Cerita Rakyat Nusantara',
        'app_url' => getenv('APP_URL') ?: '', // alamat situs, mis. https://ceritarakyat.id/ (kosong = terdeteksi otomatis)
        'verify_peer' => true,
    ],
    // Log aktivitas admin yang lebih tua dari sekian hari dihapus otomatis. 0 = simpan selamanya.
    'log_retention_days' => (int) (getenv('LOG_RETENTION_DAYS') ?: 90),
    'upload_max_bytes' => 5 * 1024 * 1024,
    'session_name' => 'crn_session',
];
