<?php
declare(strict_types=1);

/**
 * Pengirim email via SMTP (tanpa pustaka tambahan).
 * Atur di config.local.php:  'mail' => ['host' => 'smtp.gmail.com', 'port' => 587, 'secure' => 'tls',
 *   'user' => 'akun@gmail.com', 'pass' => 'sandi-aplikasi', 'from_email' => 'akun@gmail.com', 'app_url' => 'https://situsmu.id/']
 * Bila 'host' kosong, email dinonaktifkan dan notifikasi tetap tampil di dalam aplikasi.
 */

function mail_enabled(): bool
{
    return trim((string) cfg('mail.host')) !== '';
}

function app_url(): string
{
    $u = trim((string) cfg('mail.app_url'));
    if ($u === '') {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $dir = rtrim(str_replace('\\', '/', dirname(dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')))), '/');
        $u = ($https ? 'https://' : 'http://') . $host . $dir . '/';
    }
    return rtrim($u, '/') . '/';
}

function mail_b64(string $s): string
{
    return rtrim(chunk_split(base64_encode($s), 76, "\r\n"));
}

function mail_header_encode(string $s): string
{
    return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

/** Templat email HTML sederhana dengan tema marun. */
function mail_html(string $heading, string $body, string $ctaLabel = '', string $ctaUrl = ''): string
{
    $h = htmlspecialchars($heading, ENT_QUOTES, 'UTF-8');
    $b = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));
    $btn = ($ctaLabel !== '' && $ctaUrl !== '')
        ? '<p style="margin:26px 0 4px"><a href="' . htmlspecialchars($ctaUrl, ENT_QUOTES, 'UTF-8') . '" style="background:#6E1423;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;display:inline-block">' . htmlspecialchars($ctaLabel, ENT_QUOTES, 'UTF-8') . '</a></p>'
        : '';
    return '<!doctype html><html lang="id"><body style="margin:0;background:#F6EFE2;font-family:Segoe UI,Arial,sans-serif;color:#2A1519">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">'
        . '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2D4C0">'
        . '<tr><td style="background:#6E1423;padding:20px 28px;color:#E9CB8F;font-size:18px;font-weight:700;font-family:Georgia,serif">Cerita Rakyat Nusantara</td></tr>'
        . '<tr><td style="padding:28px"><h1 style="margin:0 0 14px;font-size:21px;font-family:Georgia,serif;color:#3D0A14">' . $h . '</h1>'
        . '<p style="margin:0;font-size:15px;line-height:1.65;color:#4a3a3d">' . $b . '</p>' . $btn . '</td></tr>'
        . '<tr><td style="padding:16px 28px;background:#FBF5EC;font-size:12px;color:#7a6a6d">Email otomatis dari Cerita Rakyat Nusantara. Mohon tidak membalas email ini.</td></tr>'
        . '</table></td></tr></table></body></html>';
}

/**
 * Mengirim satu email. Mengembalikan null bila berhasil, atau pesan galat (teks) bila gagal.
 */
function smtp_send(string $to, string $subject, string $html, string $text): ?string
{
    $host = trim((string) cfg('mail.host'));
    $port = (int) cfg('mail.port', 587);
    $secure = strtolower((string) cfg('mail.secure', 'tls')); // tls (STARTTLS), ssl, atau kosong
    $user = (string) cfg('mail.user');
    $pass = (string) cfg('mail.pass');
    $from = (string) (cfg('mail.from_email') ?: $user);
    $fromName = (string) cfg('mail.from_name', 'Cerita Rakyat Nusantara');
    if ($host === '' || $from === '') return 'SMTP belum dikonfigurasi (host/from_email kosong).';
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return "Alamat tujuan tidak valid: $to";

    // Perbaiki salah pasangan port dan enkripsi yang umum: 465 = SSL langsung, 587 = STARTTLS.
    if ($port === 465 && $secure === 'tls') $secure = 'ssl';
    elseif ($port === 587 && $secure === 'ssl') $secure = 'tls';

    $verify = (bool) cfg('mail.verify_peer', true);
    $ctx = stream_context_create(['ssl' => ['verify_peer' => $verify, 'verify_peer_name' => $verify, 'SNI_enabled' => true, 'peer_name' => $host]]);
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $fp = @stream_socket_client($remote, $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) return "Tidak dapat terhubung ke $host:$port ($errstr)";
    stream_set_timeout($fp, 12);

    $read = function () use ($fp): string {
        $out = '';
        while (($line = fgets($fp, 2048)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $out;
    };
    $send = function (string $cmd) use ($fp, $read): string { fwrite($fp, $cmd . "\r\n"); return $read(); };
    $expect = function (string $resp, array $codes): string {
        if (!in_array(substr($resp, 0, 3), $codes, true)) throw new RuntimeException(trim($resp) !== '' ? trim($resp) : 'Server SMTP tidak merespons.');
        return $resp;
    };

    try {
        $helo = preg_replace('/[^A-Za-z0-9.-]/', '', (string) (parse_url(app_url(), PHP_URL_HOST) ?: 'localhost')) ?: 'localhost';
        $expect($read(), ['220']);
        $ehlo = $expect($send("EHLO $helo"), ['250']);
        if ($secure === 'tls') {
            $expect($send('STARTTLS'), ['220']);
            if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                $why = error_get_last()['message'] ?? '';
                throw new RuntimeException('Gagal memulai koneksi TLS (STARTTLS)' . ($why !== '' ? ': ' . $why : '.'));
            }
            $ehlo = $expect($send("EHLO $helo"), ['250']);
        }
        if ($user !== '') {
            // Pilih metode sesuai yang ditawarkan server: LOGIN (umum) atau PLAIN.
            if (stripos($ehlo, 'AUTH') !== false && stripos($ehlo, 'LOGIN') === false && stripos($ehlo, 'PLAIN') !== false) {
                $expect($send('AUTH PLAIN ' . base64_encode("\0$user\0$pass")), ['235']);
            } else {
                $expect($send('AUTH LOGIN'), ['334']);
                $expect($send(base64_encode($user)), ['334']);
                $expect($send(base64_encode($pass)), ['235']);
            }
        }
        $expect($send("MAIL FROM:<$from>"), ['250']);
        $expect($send("RCPT TO:<$to>"), ['250', '251']);
        $expect($send('DATA'), ['354']);

        $boundary = 'b' . bin2hex(random_bytes(8));
        $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
        $msg = 'From: ' . mail_header_encode($fromName) . " <$from>\r\n"
            . "To: <$to>\r\n"
            . 'Subject: ' . mail_header_encode($subject) . "\r\n"
            . 'Date: ' . date('r') . "\r\n"
            . 'Message-ID: <' . bin2hex(random_bytes(10)) . "@$domain>\r\n"
            . "MIME-Version: 1.0\r\n"
            . "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n\r\n"
            . "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . mail_b64($text) . "\r\n"
            . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . mail_b64($html) . "\r\n"
            . "--$boundary--";
        $msg = preg_replace('/^\./m', '..', $msg);
        fwrite($fp, $msg . "\r\n.\r\n");
        $expect($read(), ['250']);
        @$send('QUIT');
        fclose($fp);
        return null;
    } catch (Throwable $e) {
        @fclose($fp);
        return $e->getMessage();
    }
}

/** Antrean email: dikirim setelah respons API selesai agar halaman tidak menunggu SMTP. */
function queue_mail(string $to, string $subject, string $heading, string $body, string $ctaLabel = '', string $ctaPath = ''): void
{
    if (!mail_enabled()) return;
    $url = $ctaPath !== '' ? app_url() . ltrim($ctaPath, '/') : '';
    $GLOBALS['MAIL_QUEUE'][] = [
        'to' => $to, 'subject' => $subject,
        'html' => mail_html($heading, $body, $ctaLabel, $url),
        'text' => $heading . "\n\n" . $body . ($url !== '' ? "\n\n$ctaLabel: $url" : ''),
    ];
    static $registered = false;
    if (!$registered) { register_shutdown_function('flush_mail_queue'); $registered = true; }
}

function flush_mail_queue(): void
{
    $queue = $GLOBALS['MAIL_QUEUE'] ?? [];
    if (!$queue) return;
    $GLOBALS['MAIL_QUEUE'] = [];
    ignore_user_abort(true);
    @set_time_limit(90);
    if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
    foreach ($queue as $m) {
        $err = smtp_send($m['to'], $m['subject'], $m['html'], $m['text']);
        if ($err !== null) error_log('[cerita-rakyat mail] gagal kirim ke ' . $m['to'] . ': ' . $err);
    }
}

/** Judul email dan tautan tombol untuk tiap jenis notifikasi. */
function mail_meta(string $type): array
{
    return match ($type) {
        'story_submitted' => ['Cerita baru menunggu persetujuan', 'Tinjau cerita', '#/admin/cerita'],
        'request' => ['Permintaan penulis baru', 'Lihat permintaan', '#/admin/permintaan'],
        'approved' => ['Ceritamu disetujui', 'Buka dashboard', '#/dashboard'],
        'rejected' => ['Ceritamu belum dapat diterbitkan', 'Lihat alasan', '#/dashboard'],
        'published' => ['Ceritamu sudah terbit sebagai buku', 'Baca bukunya', '#/dashboard'],
        'request_result' => ['Kabar permintaanmu', 'Buka dashboard', '#/dashboard'],
        'welcome' => ['Selamat datang di Cerita Rakyat Nusantara', 'Mulai menulis', '#/tambah'],
        'account' => ['Pemberitahuan akun', 'Masuk ke akunmu', '#/masuk'],
        default => ['Pemberitahuan baru', 'Buka aplikasi', '#/'],
    };
}

/** Mengubah galat teknis SMTP menjadi saran yang bisa langsung dilakukan admin. */
function smtp_friendly(string $raw): string
{
    $r = strtolower($raw);
    $hint = null;
    if (str_contains($r, 'tidak dapat terhubung')) $hint = 'Server tidak bisa dihubungi. Periksa host dan port. Sebagian hosting memblokir koneksi keluar (port 25, 465, atau 587); tanyakan ke penyedia hosting.';
    elseif (str_contains($r, 'tls') || str_contains($r, 'ssl') || str_contains($r, 'certificate')) $hint = 'Koneksi aman gagal. Pastikan pilihan Keamanan sesuai port (587 = TLS, 465 = SSL). Jika hosting tidak punya sertifikat CA yang lengkap, matikan "Verifikasi sertifikat" sebagai jalan terakhir.';
    elseif (str_starts_with($r, '535') || str_contains($r, 'authentication') || str_contains($r, 'username and password') || str_contains($r, 'badcredentials')) $hint = 'Username atau sandi ditolak. Untuk Gmail gunakan "Sandi aplikasi" (bukan sandi login biasa) dan aktifkan verifikasi 2 langkah.';
    elseif (str_starts_with($r, '534') || str_starts_with($r, '530') || str_contains($r, 'must issue a starttls')) $hint = 'Server meminta enkripsi atau login lebih dulu. Pilih Keamanan TLS (port 587) atau SSL (port 465) dan isi username serta sandi.';
    elseif (str_starts_with($r, '550') || str_starts_with($r, '553') || str_starts_with($r, '554') || str_contains($r, 'sender') || str_contains($r, 'relay')) $hint = 'Server menolak pengirim atau penerima. Pastikan "Email pengirim" sama dengan akun SMTP dan tidak diblokir.';
    elseif (str_contains($r, 'tidak merespons') || str_contains($r, 'timed out')) $hint = 'Server tidak merespons tepat waktu. Periksa host dan port, atau coba lagi nanti.';
    return $hint === null ? $raw : $hint . ' (Detail: ' . trim($raw) . ')';
}
