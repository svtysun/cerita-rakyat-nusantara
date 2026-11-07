<?php
declare(strict_types=1);

$GLOBALS['CFG'] = require __DIR__ . '/config.php';
if (is_file(__DIR__ . '/config.local.php')) {
    $GLOBALS['CFG'] = array_replace_recursive($GLOBALS['CFG'], require __DIR__ . '/config.local.php');
}

function cfg(string $key, $default = null)
{
    if (str_starts_with($key, 'mail.')) {
        $o = mail_overrides();
        if ($o !== null) { $n = substr($key, 5); return array_key_exists($n, $o) ? $o[$n] : $default; }
    }
    $v = $GLOBALS['CFG'];
    foreach (explode('.', $key) as $part) {
        if (!is_array($v) || !array_key_exists($part, $v)) return $default;
        $v = $v[$part];
    }
    return $v;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $dsn = (string) cfg('db.dsn');
    $opts = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];
    if ($dsn !== '') {
        $pdo = new PDO($dsn, null, null, $opts);
        if (str_starts_with($dsn, 'sqlite')) $pdo->exec('PRAGMA foreign_keys = ON');
    } else {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', cfg('db.host'), cfg('db.port'), cfg('db.name'));
        $pdo = new PDO($dsn, (string) cfg('db.user'), (string) cfg('db.pass'), $opts + [PDO::ATTR_EMULATE_PREPARES => false]);
    }
    ensure_schema($pdo);
    return $pdo;
}

/** Menyesuaikan basis data lama secara otomatis (kolom, tabel, dan perbaikan data sekali jalan), jadi tidak ada berkas migrasi manual. */
function ensure_schema(PDO $pdo): void
{
    try { $pdo->query('SELECT views FROM stories LIMIT 1')->closeCursor(); }
    catch (Throwable $e) {
        try { $pdo->exec('ALTER TABLE stories ADD COLUMN views INT NOT NULL DEFAULT 0'); } catch (Throwable $e2) { /* abaikan */ }
    }
    // Tabel pengaturan (v6): dibuat otomatis bila belum ada.
    try { $pdo->query('SELECT 1 FROM settings LIMIT 1')->closeCursor(); }
    catch (Throwable $e) {
        foreach ([
            'CREATE TABLE IF NOT EXISTS settings (skey VARCHAR(60) NOT NULL PRIMARY KEY, svalue TEXT NOT NULL, updated_at DATETIME NOT NULL) ENGINE=InnoDB',
            'CREATE TABLE IF NOT EXISTS settings (skey VARCHAR(60) NOT NULL PRIMARY KEY, svalue TEXT NOT NULL, updated_at DATETIME NOT NULL)',
        ] as $ddl) { try { $pdo->exec($ddl); break; } catch (Throwable $e2) { /* coba varian berikutnya */ } }
    }
    // Tabel log aktivitas admin (v6): dibuat otomatis bila belum ada. Coba MySQL (dengan/tanpa FK), lalu SQLite.
    try { $pdo->query('SELECT 1 FROM admin_logs LIMIT 1')->closeCursor(); }
    catch (Throwable $e) {
        $cols = 'admin_name VARCHAR(80) NOT NULL, action VARCHAR(40) NOT NULL, target_type VARCHAR(20) NOT NULL, target_id INT NULL, target_label VARCHAR(160) NOT NULL DEFAULT \'\', detail VARCHAR(500) NULL, created_at DATETIME NOT NULL';
        $variants = [
            "CREATE TABLE IF NOT EXISTS admin_logs (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, admin_id INT UNSIGNED NULL, $cols, INDEX idx_logs_time (created_at), INDEX idx_logs_admin (admin_id), INDEX idx_logs_action (action), CONSTRAINT fk_logs_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB",
            "CREATE TABLE IF NOT EXISTS admin_logs (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, admin_id INT UNSIGNED NULL, $cols, INDEX idx_logs_time (created_at), INDEX idx_logs_admin (admin_id), INDEX idx_logs_action (action)) ENGINE=InnoDB",
            "CREATE TABLE IF NOT EXISTS admin_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER NULL, $cols)",
        ];
        foreach ($variants as $ddl) { try { $pdo->exec($ddl); break; } catch (Throwable $e2) { /* coba varian berikutnya */ } }
    }
    // Tabel token reset password (v6): dibuat otomatis bila belum ada.
    try { $pdo->query('SELECT 1 FROM password_resets LIMIT 1')->closeCursor(); }
    catch (Throwable $e) {
        $c = 'token_hash CHAR(64) NOT NULL, ip VARCHAR(45) NOT NULL DEFAULT \'\', expires_at DATETIME NOT NULL, used_at DATETIME NULL, created_at DATETIME NOT NULL';
        foreach ([
            "CREATE TABLE IF NOT EXISTS password_resets (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NULL, $c, UNIQUE KEY uq_reset_token (token_hash), INDEX idx_reset_user (user_id), INDEX idx_reset_ip (ip, created_at), CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB",
            "CREATE TABLE IF NOT EXISTS password_resets (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NULL, $c, UNIQUE KEY uq_reset_token (token_hash), INDEX idx_reset_user (user_id), INDEX idx_reset_ip (ip, created_at)) ENGINE=InnoDB",
            "CREATE TABLE IF NOT EXISTS password_resets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NULL, $c)",
        ] as $ddl) { try { $pdo->exec($ddl); break; } catch (Throwable $e2) { /* coba varian berikutnya */ } }
    }
    // Perbaikan data sekali jalan; versi skema dicatat di tabel settings.
    try {
        $ver = $pdo->query("SELECT svalue FROM settings WHERE skey = 'schema.version'")->fetchColumn();
        if ((int) $ver < 6) {
            // Sampul contoh kini berukuran 2:3 penuh (berkas *-sampul.svg).
            $pdo->exec("UPDATE stories SET image_url = REPLACE(image_url, '.svg', '-sampul.svg') WHERE image_url IN ("
                . implode(',', array_map(fn($n) => "'illustrations/$n.svg'", ['asal-usul-danau-sentani', 'batu-menangis', 'cenderawasih', 'danau-toba', 'malin-kundang', 'sangkuriang', 'timun-mas'])) . ')');
            // Notifikasi yang terkirim ke orang yang melakukan tindakan itu sendiri.
            $pdo->exec('DELETE FROM notifications WHERE sender_user_id IS NOT NULL AND user_id = sender_user_id');
            $now = date('Y-m-d H:i:s');
            if ($ver === false) $pdo->prepare("INSERT INTO settings (skey, svalue, updated_at) VALUES ('schema.version', '6', ?)")->execute([$now]);
            else $pdo->prepare("UPDATE settings SET svalue = '6', updated_at = ? WHERE skey = 'schema.version'")->execute([$now]);
        }
    } catch (Throwable $e) { /* tabel settings belum siap: dicoba lagi pada permintaan berikutnya */ }
    // v7: peran baru 'reviewer' (reviewer/publisher) dan hanya boleh ada satu admin.
    try {
        $ver = $pdo->query("SELECT svalue FROM settings WHERE skey = 'schema.version'")->fetchColumn();
        if ((int) $ver < 7) {
            // MySQL/MariaDB: tambahkan nilai 'reviewer' ke kolom ENUM. SQLite tidak punya ENUM, jadi gagal ini diabaikan.
            try { $pdo->exec("ALTER TABLE users MODIFY role ENUM('user','reviewer','admin') NOT NULL DEFAULT 'user'"); } catch (Throwable $e2) { /* bukan MySQL atau sudah sesuai */ }
            // Bila data lama punya lebih dari satu admin: admin dengan id terkecil tetap admin, sisanya menjadi reviewer
            // (mereka tetap bisa mengelola cerita seperti sebelumnya, hanya tidak lagi mengelola akun).
            $keep = $pdo->query("SELECT MIN(id) FROM users WHERE role = 'admin'")->fetchColumn();
            if ($keep !== false && $keep !== null) {
                $pdo->prepare("UPDATE users SET role = 'reviewer' WHERE role = 'admin' AND id <> ?")->execute([(int) $keep]);
            }
            $now = date('Y-m-d H:i:s');
            if ($ver === false) $pdo->prepare("INSERT INTO settings (skey, svalue, updated_at) VALUES ('schema.version', '7', ?)")->execute([$now]);
            else $pdo->prepare("UPDATE settings SET svalue = '7', updated_at = ? WHERE skey = 'schema.version'")->execute([$now]);
        }
    } catch (Throwable $e) { /* dicoba lagi pada permintaan berikutnya */ }
    // v8: kunci di level database agar hanya ada satu admin (berlaku juga untuk perubahan lewat phpMyAdmin atau SQL langsung).
    try {
        $ver = $pdo->query("SELECT svalue FROM settings WHERE skey = 'schema.version'")->fetchColumn();
        if ((int) $ver < 8) {
            // Rapikan dulu bila masih ada lebih dari satu admin: id terkecil tetap admin, sisanya menjadi reviewer.
            $keep = $pdo->query("SELECT MIN(id) FROM users WHERE role = 'admin'")->fetchColumn();
            if ($keep !== false && $keep !== null) {
                $pdo->prepare("UPDATE users SET role = 'reviewer' WHERE role = 'admin' AND id <> ?")->execute([(int) $keep]);
            }
            $locked = false;
            // MySQL 5.7+/MariaDB 10.2+: kolom turunan bernilai 1 hanya untuk admin (NULL untuk lainnya) dan wajib unik.
            try { $pdo->exec("ALTER TABLE users ADD COLUMN single_admin TINYINT GENERATED ALWAYS AS (IF(role = 'admin', 1, NULL)) STORED, ADD UNIQUE KEY uq_single_admin (single_admin)"); $locked = true; } catch (Throwable $e2) { /* sudah ada atau bukan MySQL */ }
            // SQLite: indeks unik parsial.
            if (!$locked) { try { $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_single_admin ON users(role) WHERE role = 'admin'"); $locked = true; } catch (Throwable $e2) { /* tidak didukung */ } }
            $now = date('Y-m-d H:i:s');
            if ($ver === false) $pdo->prepare("INSERT INTO settings (skey, svalue, updated_at) VALUES ('schema.version', '8', ?)")->execute([$now]);
            else $pdo->prepare("UPDATE settings SET svalue = '8', updated_at = ? WHERE skey = 'schema.version'")->execute([$now]);
        }
    } catch (Throwable $e) { /* dicoba lagi pada permintaan berikutnya */ }
    // v9: sampul buku lama (gambar 330px + garis emas) diubah menjadi sampul penuh satu halaman, memakai gambar sampul cerita.
    // Hanya halaman 1 yang masih berpola bawaan dan belum diubah admin yang disentuh.
    try {
        $ver = $pdo->query("SELECT svalue FROM settings WHERE skey = 'schema.version'")->fetchColumn();
        if ((int) $ver < 9) {
            $rows = $pdo->query("SELECT p.id, p.content, s.image_url, s.title FROM flipbook_pages p JOIN flipbooks f ON f.id = p.flipbook_id JOIN stories s ON s.id = f.story_id WHERE p.page_no = 1")->fetchAll(PDO::FETCH_ASSOC);
            $upd = $pdo->prepare('UPDATE flipbook_pages SET content = ? WHERE id = ?');
            foreach ($rows as $r) {
                $c = json_decode((string) $r['content'], true);
                $el = is_array($c) ? ($c['elements'] ?? null) : null;
                $img = trim((string) ($r['image_url'] ?? ''));
                if (!is_array($el) || count($el) < 4 || $img === '') continue;
                [$a, $b, $t, $loc] = $el;
                $old = ($a['type'] ?? '') === 'image' && (int) ($a['y'] ?? -1) === 0 && (int) ($a['h'] ?? 0) === 330
                    && ($b['type'] ?? '') === 'shape' && (int) ($b['y'] ?? 0) === 330 && (int) ($b['h'] ?? 0) === 6
                    && ($t['type'] ?? '') === 'text' && (int) ($t['y'] ?? 0) === 360;
                if (!$old) continue;
                $a['src'] = $img; $a['h'] = 560; $a['alt'] = 'Sampul ' . $r['title'];
                $t['y'] = 400; $t['h'] = 90;
                $c['elements'] = array_merge([$a, $t, $loc], array_slice($el, 4));
                $upd->execute([json_encode($c, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (int) $r['id']]);
            }
            $now = date('Y-m-d H:i:s');
            if ($ver === false) $pdo->prepare("INSERT INTO settings (skey, svalue, updated_at) VALUES ('schema.version', '9', ?)")->execute([$now]);
            else $pdo->prepare("UPDATE settings SET svalue = '9', updated_at = ? WHERE skey = 'schema.version'")->execute([$now]);
        }
    } catch (Throwable $e) { /* dicoba lagi pada permintaan berikutnya */ }
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function now(): string { return date('Y-m-d H:i:s'); }

/** Semua pengaturan dari tabel settings (disimpan di memori selama satu permintaan). */
function settings_all(bool $reload = false): array
{
    static $cache = null, $busy = false;
    if ($reload) $cache = null;
    if ($cache !== null) return $cache;
    if ($busy) return [];
    $busy = true;
    $cache = [];
    try { foreach (q('SELECT skey, svalue FROM settings')->fetchAll() as $r) $cache[$r['skey']] = (string) $r['svalue']; }
    catch (Throwable $e) { /* tabel belum ada: pakai berkas konfigurasi */ }
    $busy = false;
    return $cache;
}

function setting_set(string $key, string $value): void
{
    $exists = q('SELECT 1 FROM settings WHERE skey = ?', [$key])->fetchColumn();
    if ($exists) q('UPDATE settings SET svalue = ?, updated_at = ? WHERE skey = ?', [$value, now(), $key]);
    else q('INSERT INTO settings (skey, svalue, updated_at) VALUES (?,?,?)', [$key, $value, now()]);
}

/** Pengaturan email dari database bila admin sudah menyimpannya lewat panel; null = pakai berkas konfigurasi. */
function mail_overrides(): ?array
{
    static $busy = false;
    if ($busy) return null;
    $busy = true;
    try {
        $s = settings_all();
        if (($s['mail.configured'] ?? '') !== '1') return null;
        return [
            'host' => $s['mail.host'] ?? '', 'port' => (int) ($s['mail.port'] ?? 587), 'secure' => $s['mail.secure'] ?? 'tls',
            'user' => $s['mail.user'] ?? '', 'pass' => $s['mail.pass'] ?? '', 'from_email' => $s['mail.from_email'] ?? '',
            'from_name' => ($s['mail.from_name'] ?? '') !== '' ? $s['mail.from_name'] : 'Cerita Rakyat Nusantara',
            'app_url' => $s['mail.app_url'] ?? '', 'verify_peer' => ($s['mail.verify_peer'] ?? '1') !== '0',
        ];
    } finally { $busy = false; }
}

/** Pola LIKE aman dengan karakter escape '!' (sintaks sama di MySQL dan SQLite). */
function like_term(string $term): string
{
    return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_substr(trim($term), 0, 80)) . '%';
}

/** Menghapus log lebih tua dari masa simpan (config log_retention_days). Mengembalikan jumlah baris yang dihapus. */
function purge_old_logs(): int
{
    $days = (int) cfg('log_retention_days', 90);
    if ($days <= 0) return 0;
    try {
        return q('DELETE FROM admin_logs WHERE created_at < ?', [date('Y-m-d H:i:s', time() - $days * 86400)])->rowCount();
    } catch (Throwable $e) {
        error_log('[CRN] gagal membersihkan log: ' . $e->getMessage());
        return 0;
    }
}

/**
 * Mencatat tindakan admin ke log aktivitas. Kegagalan mencatat TIDAK boleh menggagalkan tindakannya.
 * $mergeMinutes > 0: entri yang sama (admin + aksi + target) dalam rentang itu digabung, agar simpan otomatis tidak membanjiri log.
 */
function admin_log(array $admin, string $action, string $targetType, ?int $targetId, string $label, ?string $detail = null, int $mergeMinutes = 0): void
{
    try {
        $label = mb_substr($label, 0, 160);
        $detail = $detail !== null ? mb_substr($detail, 0, 500) : null;
        if ($mergeMinutes > 0 && $targetId !== null) {
            $cut = date('Y-m-d H:i:s', time() - $mergeMinutes * 60);
            $last = q('SELECT id FROM admin_logs WHERE admin_id = ? AND action = ? AND target_id = ? AND created_at >= ? ORDER BY id DESC LIMIT 1', [$admin['id'], $action, $targetId, $cut])->fetch();
            if ($last) { q('UPDATE admin_logs SET detail = ?, target_label = ?, created_at = ? WHERE id = ?', [$detail, $label, now(), $last['id']]); return; }
        }
        q('INSERT INTO admin_logs (admin_id, admin_name, action, target_type, target_id, target_label, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
            [$admin['id'], mb_substr((string) $admin['name'], 0, 80), $action, $targetType, $targetId, $label, $detail, now()]);
        if (random_int(1, 20) === 1) purge_old_logs(); // pembersihan otomatis tanpa cron
    } catch (Throwable $e) {
        error_log('[CRN] gagal mencatat log: ' . $e->getMessage());
    }
}

function respond($data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $code, string $msg, array $extra = []): never
{
    respond(['error' => $msg] + $extra, $code);
}

function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $d = json_decode($raw, true);
    if (!is_array($d)) fail(400, 'Format data tidak valid.');
    return $d;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name((string) cfg('session_name'));
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function current_user(): ?array
{
    static $cache = false;
    if ($cache !== false) return $cache;
    start_session();
    $id = $_SESSION['uid'] ?? null;
    $cache = null;
    if ($id) {
        $u = q('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [$id])->fetch();
        if ($u) { $u['id'] = (int) $u['id']; $cache = $u; }
    }
    return $cache;
}

function require_login(): array
{
    $u = current_user();
    if (!$u) fail(401, 'Silakan masuk terlebih dahulu.');
    return $u;
}

/** Admin dan reviewer/publisher: boleh mengelola cerita (setujui, tolak, desain, terbitkan). */
function is_staff(?array $u): bool
{
    return $u !== null && in_array($u['role'], ['admin', 'reviewer'], true);
}

/** Khusus admin (hanya ada satu): kelola akun, log aktivitas, backup, dan pengaturan email. */
function require_admin(): array
{
    $u = require_login();
    if ($u['role'] !== 'admin') fail(403, 'Fitur ini hanya untuk administrator.');
    return $u;
}

/** Admin atau reviewer/publisher: kelola cerita, editor flipbook, unggahan gambar, dan permintaan penulis. */
function require_staff(): array
{
    $u = require_login();
    if (!is_staff($u)) fail(403, 'Fitur ini hanya untuk admin atau reviewer.');
    return $u;
}

/** Validasi string wajib. */
function field(array $d, string $key, string $label, int $min, int $max): string
{
    $v = $d[$key] ?? '';
    if (!is_string($v)) fail(422, "$label tidak valid.");
    $v = trim($v);
    $len = mb_strlen($v);
    if ($len < $min) fail(422, $min <= 1 ? "$label wajib diisi." : "$label minimal $min karakter.");
    if ($len > $max) fail(422, "$label maksimal $max karakter.");
    return $v;
}

function valid_url(?string $u): ?string
{
    $u = trim((string) $u);
    if ($u === '') return null;
    if (mb_strlen($u) > 500) fail(422, 'Alamat gambar terlalu panjang.');
    if (preg_match('#^https?://[^\s<>"\']+$#i', $u)) return $u;
    if (preg_match('#^[A-Za-z0-9_./-]+$#', $u) && !str_contains($u, '..') && !preg_match('#^[a-z]+:#i', $u)) return $u;
    fail(422, 'Alamat gambar tidak valid.');
}

function notify(int $userId, ?int $senderId, string $type, string $message): void
{
    // Jangan kirim notifikasi (dan email) ke orang yang melakukan tindakan itu sendiri.
    if ($senderId !== null && $senderId === $userId) return;
    q('INSERT INTO notifications (user_id, sender_user_id, type, message, is_read, created_at) VALUES (?,?,?,?,0,?)',
        [$userId, $senderId, $type, $message, now()]);
    if (mail_enabled()) {
        $u = q('SELECT name, email FROM users WHERE id = ?', [$userId])->fetch();
        if ($u) {
            [$subject, $cta, $path] = mail_meta($type);
            queue_mail($u['email'], $subject, $subject, 'Halo ' . $u['name'] . ",\n\n" . $message, $cta, $path);
        }
    }
}

function notify_admins(?int $senderId, string $type, string $message): void
{
    foreach (q("SELECT id FROM users WHERE role IN ('admin','reviewer')")->fetchAll() as $a) {
        notify((int) $a['id'], $senderId, $type, $message);
    }
}

function clamp_num($v, float $min, float $max, float $def): float
{
    if (!is_numeric($v)) return $def;
    return max($min, min($max, (float) $v));
}

function hex_color($v, string $def): string
{
    return (is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v)) ? $v : $def;
}

function pick($v, array $allowed, string $def): string
{
    return (is_string($v) && in_array($v, $allowed, true)) ? $v : $def;
}

/** Membersihkan data flipbook dari klien: hanya struktur dan nilai yang diizinkan yang disimpan. */
function sanitize_flipbook(array $d): array
{
    $pages = $d['pages'] ?? null;
    if (!is_array($pages) || count($pages) > 60) fail(422, 'Flipbook maksimal 60 halaman.');
    $anims = ['none', 'fade', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'zoom', 'bounce', 'float', 'pulse', 'sway'];
    $outPages = [];
    foreach (array_values($pages) as $p) {
        if (!is_array($p)) continue;
        $els = [];
        foreach (array_slice(is_array($p['elements'] ?? null) ? $p['elements'] : [], 0, 150) as $e) {
            if (!is_array($e)) continue;
            $type = pick($e['type'] ?? '', ['text', 'image', 'shape'], '');
            if ($type === '') continue;
            $a = is_array($e['anim'] ?? null) ? $e['anim'] : [];
            $o = [
                'id' => substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($e['id'] ?? '')) ?: bin2hex(random_bytes(4)), 0, 24),
                'type' => $type,
                'x' => clamp_num($e['x'] ?? 0, -2000, 3000, 0),
                'y' => clamp_num($e['y'] ?? 0, -2000, 3000, 0),
                'w' => clamp_num($e['w'] ?? 100, 8, 3000, 100),
                'h' => clamp_num($e['h'] ?? 100, 8, 3000, 100),
                'rotation' => clamp_num($e['rotation'] ?? 0, -360, 360, 0),
                'opacity' => clamp_num($e['opacity'] ?? 1, 0, 1, 1),
                'shadow' => (bool) ($e['shadow'] ?? false),
                'anim' => [
                    'type' => pick($a['type'] ?? 'none', $anims, 'none'),
                    'delay' => clamp_num($a['delay'] ?? 0, 0, 10, 0),
                    'duration' => clamp_num($a['duration'] ?? 0.8, 0.1, 10, 0.8),
                ],
            ];
            if ($type === 'text') {
                $o += [
                    'text' => mb_substr((string) ($e['text'] ?? ''), 0, 3000),
                    'font' => pick($e['font'] ?? '', ['serif', 'sans', 'reading'], 'reading'),
                    'size' => clamp_num($e['size'] ?? 18, 8, 200, 18),
                    'color' => hex_color($e['color'] ?? '', '#241519'),
                    'bold' => (bool) ($e['bold'] ?? false),
                    'italic' => (bool) ($e['italic'] ?? false),
                    'align' => pick($e['align'] ?? '', ['left', 'center', 'right'], 'left'),
                    'lineHeight' => clamp_num($e['lineHeight'] ?? 1.5, 0.8, 3, 1.5),
                ];
            } elseif ($type === 'image') {
                $src = valid_url((string) ($e['src'] ?? ''));
                if (!$src) continue;
                $o += [
                    'src' => $src, 'alt' => mb_substr((string) ($e['alt'] ?? ''), 0, 200), 'radius' => clamp_num($e['radius'] ?? 0, 0, 500, 0),
                    'fit' => pick($e['fit'] ?? '', ['cover', 'contain', 'fill'], 'cover'),
                    'flipX' => (bool) ($e['flipX'] ?? false), 'flipY' => (bool) ($e['flipY'] ?? false),
                    'filter' => pick($e['filter'] ?? '', ['none', 'grayscale', 'sepia', 'warm', 'vintage', 'bright', 'soft'], 'none'),
                ];
            } else {
                $o += [
                    'shape' => pick($e['shape'] ?? '', ['rect', 'circle'], 'rect'),
                    'fill' => hex_color($e['fill'] ?? '', '#C99A3B'),
                    'radius' => clamp_num($e['radius'] ?? 0, 0, 500, 0),
                ];
            }
            $els[] = $o;
        }
        $page = [
            'id' => substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($p['id'] ?? '')) ?: bin2hex(random_bytes(4)), 0, 24),
            'bg' => hex_color($p['bg'] ?? '', '#FBF6EC'),
            'elements' => $els,
        ];
        if (!empty($p['bgImage'])) { $bi = valid_url((string) $p['bgImage']); if ($bi) $page['bgImage'] = $bi; }
        $outPages[] = $page;
    }
    $s = is_array($d['settings'] ?? null) ? $d['settings'] : [];
    return ['pages' => $outPages, 'settings' => ['speed' => pick($s['speed'] ?? '', ['fast', 'normal', 'slow'], 'normal')]];
}

require_once __DIR__ . '/mailer.php';

/* ---------- Backup ---------- */

const BACKUP_TABLES = ['users', 'stories', 'favorites', 'notifications', 'story_requests', 'flipbooks', 'flipbook_pages', 'flipbook_assets', 'admin_logs', 'settings'];

/** Menulis seluruh struktur dan isi tabel sebagai berkas SQL ke $fh. Mengembalikan jumlah tabel yang berhasil ditulis. */
function dump_database($fh): int
{
    $pdo = db();
    $mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    fwrite($fh, "-- Backup Cerita Rakyat Nusantara, dibuat " . now() . "\n-- Impor ke database kosong (phpMyAdmin > Impor). Berkas ini berisi hash password: simpan dengan aman.\n");
    fwrite($fh, $mysql ? "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n" : "PRAGMA foreign_keys=OFF;\n\n");
    foreach (array_reverse(BACKUP_TABLES) as $t) fwrite($fh, "DROP TABLE IF EXISTS `$t`;\n");
    fwrite($fh, "\n");
    $done = 0;
    foreach (BACKUP_TABLES as $t) {
        try {
            if ($mysql) $ddl = (string) ($pdo->query("SHOW CREATE TABLE `$t`")->fetch(PDO::FETCH_NUM)[1] ?? '');
            else $ddl = (string) q("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [$t])->fetchColumn();
            if ($ddl === '') continue;
            fwrite($fh, $ddl . ";\n\n");
            // Sandi SMTP sengaja tidak dimasukkan ke backup (isi ulang di Pengaturan setelah memulihkan).
            $st = $pdo->query($t === 'settings' ? "SELECT * FROM `settings` WHERE skey <> 'mail.pass' ORDER BY 1" : "SELECT * FROM `$t` ORDER BY 1");
            $cols = null; $batch = [];
            $flush = function () use (&$batch, &$cols, $fh, $t) {
                if (!$batch) return;
                fwrite($fh, "INSERT INTO `$t` (" . implode(', ', array_map(fn($c) => "`$c`", $cols)) . ") VALUES\n" . implode(",\n", $batch) . ";\n");
                $batch = [];
            };
            while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
                $cols ??= array_keys($row);
                $vals = array_map(fn($v) => $v === null ? 'NULL' : (is_int($v) || is_float($v) ? (string) $v : $pdo->quote((string) $v)), array_values($row));
                $batch[] = '(' . implode(', ', $vals) . ')';
                if (count($batch) >= 100) $flush();
            }
            $flush();
            fwrite($fh, "\n");
            $done++;
        } catch (Throwable $e) {
            error_log('[CRN] backup tabel ' . $t . ': ' . $e->getMessage());
        }
    }
    fwrite($fh, $mysql ? "SET FOREIGN_KEY_CHECKS=1;\n" : "PRAGMA foreign_keys=ON;\n");
    return $done;
}
