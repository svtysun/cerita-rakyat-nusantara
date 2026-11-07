<?php
declare(strict_types=1);

const STORY_COLS = 's.id, s.user_id, s.title, s.region, s.province, s.category, s.short_description, s.image_url, s.author, s.status, s.reject_reason, s.created_at, s.updated_at, s.views';
const PROVINCES = ['Sumatera', 'Jawa', 'Kalimantan', 'Sulawesi', 'Bali dan Nusa Tenggara', 'Maluku', 'Papua'];
const CATEGORIES = ['Legenda', 'Fabel', 'Dongeng', 'Mitos'];

function story_out(array $r): array
{
    foreach (['id', 'user_id', 'views'] as $k) if (isset($r[$k])) $r[$k] = (int) $r[$k];
    if (isset($r['is_favorite'])) $r['is_favorite'] = (int) $r['is_favorite'] > 0;
    if (isset($r['has_flipbook'])) $r['has_flipbook'] = (int) $r['has_flipbook'] > 0;
    return $r;
}

function find_story(int $id): array
{
    $r = q('SELECT ' . STORY_COLS . ', s.full_story, u.name AS owner_name, u.email AS owner_email FROM stories s JOIN users u ON u.id = s.user_id WHERE s.id = ?', [$id])->fetch();
    if (!$r) fail(404, 'Cerita tidak ditemukan.');
    return $r;
}

function story_input(array $d): array
{
    $province = $d['province'] ?? '';
    $category = $d['category'] ?? '';
    if (!in_array($province, PROVINCES, true)) fail(422, 'Pilih pulau asal cerita.');
    if (!in_array($category, CATEGORIES, true)) fail(422, 'Pilih kategori cerita.');
    return [
        'title' => field($d, 'title', 'Judul', 3, 120),
        'region' => field($d, 'region', 'Daerah asal', 2, 80),
        'province' => $province,
        'category' => $category,
        'short_description' => field($d, 'short_description', 'Deskripsi singkat', 10, 240),
        'full_story' => field($d, 'full_story', 'Cerita lengkap', 100, 20000),
        'image_url' => valid_url($d['image_url'] ?? ''),
    ];
}

/* ---------- Publik ---------- */

function h_meta(): void
{
    $total = (int) q("SELECT COUNT(*) FROM stories WHERE status = 'published'")->fetchColumn();
    $prov = q("SELECT province, COUNT(*) AS count FROM stories WHERE status = 'published' GROUP BY province ORDER BY province")->fetchAll();
    $cat = q("SELECT category, COUNT(*) AS count FROM stories WHERE status = 'published' GROUP BY category ORDER BY category")->fetchAll();
    $regions = (int) q("SELECT COUNT(DISTINCT region) FROM stories WHERE status = 'published'")->fetchColumn();
    respond([
        'published' => $total,
        'regions' => $regions,
        'provinces' => array_map(fn($r) => ['province' => $r['province'], 'count' => (int) $r['count']], $prov),
        'categories' => array_map(fn($r) => ['category' => $r['category'], 'count' => (int) $r['count']], $cat),
        'all_provinces' => PROVINCES,
        'all_categories' => CATEGORIES,
    ]);
}

function h_stories_list(): void
{
    $u = current_user();
    $uid = $u['id'] ?? 0;
    $where = ["s.status = 'published'"];
    $p = [$uid];
    $term = trim((string) ($_GET['q'] ?? ''));
    if ($term !== '') {
        // Karakter escape '!' dipakai (bukan backslash) agar sintaks sama di MySQL dan SQLite.
        $like = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_substr($term, 0, 80)) . '%';
        $where[] = "(s.title LIKE ? ESCAPE '!' OR s.short_description LIKE ? ESCAPE '!' OR s.region LIKE ? ESCAPE '!')";
        array_push($p, $like, $like, $like);
    }
    if (!empty($_GET['province'])) { $where[] = 's.province = ?'; $p[] = (string) $_GET['province']; }
    if (!empty($_GET['category'])) { $where[] = 's.category = ?'; $p[] = (string) $_GET['category']; }
    $limit = max(1, min(60, (int) ($_GET['limit'] ?? 60)));
    $order = (($_GET['sort'] ?? '') === 'popular') ? 's.views DESC, s.updated_at DESC, s.id DESC' : 's.updated_at DESC, s.id DESC';
    $sql = 'SELECT ' . STORY_COLS . ', (SELECT COUNT(*) FROM favorites f WHERE f.story_id = s.id AND f.user_id = ?) AS is_favorite
            FROM stories s WHERE ' . implode(' AND ', $where) . ' ORDER BY ' . $order . ' LIMIT ' . $limit;
    respond(['stories' => array_map('story_out', q($sql, $p)->fetchAll())]);
}

function load_flipbook(int $storyId): ?array
{
    $fb = q('SELECT id, status, settings, published_at, updated_at FROM flipbooks WHERE story_id = ?', [$storyId])->fetch();
    if (!$fb) return null;
    $pages = [];
    foreach (q('SELECT page_uid, bg, content FROM flipbook_pages WHERE flipbook_id = ? ORDER BY page_no', [$fb['id']])->fetchAll() as $r) {
        $c = json_decode((string) $r['content'], true) ?: [];
        $page = ['id' => $r['page_uid'], 'bg' => $r['bg'], 'elements' => $c['elements'] ?? []];
        if (!empty($c['bgImage'])) $page['bgImage'] = $c['bgImage'];
        $pages[] = $page;
    }
    $settings = json_decode((string) $fb['settings'], true) ?: ['speed' => 'normal'];
    return ['status' => $fb['status'], 'pages' => $pages, 'settings' => $settings, 'published_at' => $fb['published_at'], 'updated_at' => $fb['updated_at']];
}

function h_story_get(int $id): void
{
    $u = current_user();
    $s = find_story($id);
    $isAdmin = is_staff($u);
    $isOwner = $u && (int) $s['user_id'] === $u['id'];
    if ($s['status'] !== 'published' && !$isAdmin && !$isOwner) fail(404, 'Cerita tidak ditemukan.');
    $s = story_out($s);
    if (!$isAdmin && !$isOwner) { unset($s['owner_email']); }
    if (!$isAdmin) unset($s['owner_email']);
    $fav = $u ? (int) q('SELECT COUNT(*) FROM favorites WHERE user_id = ? AND story_id = ?', [$u['id'], $id])->fetchColumn() > 0 : false;
    $s['is_favorite'] = $fav;
    $fb = null;
    if ($s['status'] === 'published' || $isAdmin) $fb = load_flipbook($id);
    if ($fb && !$isAdmin && $fb['status'] !== 'published') $fb = null;
    respond(['story' => $s, 'flipbook' => $fb]);
}

/** Menghitung satu pembaca. Satu sesi hanya dihitung sekali per cerita; penulis dan admin tidak dihitung. */
function h_story_view(int $id): void
{
    $s = q('SELECT id, user_id, views, status FROM stories WHERE id = ?', [$id])->fetch();
    if (!$s || $s['status'] !== 'published') fail(404, 'Cerita tidak ditemukan.');
    $u = current_user();
    if ($u && (is_staff($u) || (int) $s['user_id'] === $u['id'])) respond(['views' => (int) $s['views'], 'counted' => false]);
    start_session();
    $seen = $_SESSION['viewed'] ?? [];
    if (isset($seen[$id])) respond(['views' => (int) $s['views'], 'counted' => false]);
    $seen[$id] = time();
    $_SESSION['viewed'] = $seen;
    q('UPDATE stories SET views = views + 1 WHERE id = ?', [$id]);
    respond(['views' => (int) $s['views'] + 1, 'counted' => true]);
}

/* ---------- Akun ---------- */

function h_register(): void
{
    $d = json_body();
    $name = field($d, 'name', 'Nama', 2, 80);
    $email = strtolower(field($d, 'email', 'Email', 5, 160));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(422, 'Format email tidak valid.');
    $pass = (string) ($d['password'] ?? '');
    if (strlen($pass) < 6) fail(422, 'Password minimal 6 karakter.');
    if (strlen($pass) > 200) fail(422, 'Password terlalu panjang.');
    if (q('SELECT id FROM users WHERE email = ?', [$email])->fetch()) fail(409, 'Email sudah terdaftar. Silakan masuk.');
    q("INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?,?,?,'user',?)", [$name, $email, password_hash($pass, PASSWORD_DEFAULT), now()]);
    $id = (int) db()->lastInsertId();
    start_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
    notify($id, null, 'welcome', 'Selamat datang di Cerita Rakyat Nusantara! Akunmu sudah aktif. Kirim ceritamu lewat menu "Tulis Cerita", dan kami akan memberi kabar setiap ada perkembangan.');
    respond(['user' => ['id' => $id, 'name' => $name, 'email' => $email, 'role' => 'user']], 201);
}

function h_login(): void
{
    $d = json_body();
    $email = strtolower(trim((string) ($d['email'] ?? '')));
    $pass = (string) ($d['password'] ?? '');
    if ($email === '' || $pass === '') fail(422, 'Email dan password wajib diisi.');
    $u = q('SELECT id, name, email, role, password_hash FROM users WHERE email = ?', [$email])->fetch();
    if (!$u || !password_verify($pass, $u['password_hash'])) {
        usleep(300000);
        fail(401, 'Email atau password salah.');
    }
    start_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $u['id'];
    if (in_array($u['role'], ['admin', 'reviewer'], true)) admin_log(['id' => (int) $u['id'], 'name' => $u['name']], 'auth.login', 'user', (int) $u['id'], $u['name'], $u['role'] === 'admin' ? 'Masuk ke panel admin' : 'Masuk ke panel reviewer');
    respond(['user' => ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role']]]);
}

function h_logout(): void
{
    start_session();
    $_SESSION = [];
    session_destroy();
    respond(['ok' => true]);
}

/** Hash password akun admin contoh pada data awal (Admin123!). Dipakai hanya untuk mendeteksi bahwa password belum diganti. */
const SEED_ADMIN_HASH = '$2y$10$wOwjgLmYnYJRimTYnN847uhplYqQaMViSEMs2pHwXNK67kTGYhto.';

function h_password_change(): void
{
    $u = require_login();
    $d = json_body();
    $cur = (string) ($d['current'] ?? '');
    $new = (string) ($d['password'] ?? '');
    $row = q('SELECT password_hash FROM users WHERE id = ?', [$u['id']])->fetch();
    if (!$row || !password_verify($cur, (string) $row['password_hash'])) fail(422, 'Password saat ini salah.');
    if (strlen($new) < 8) fail(422, 'Password baru minimal 8 karakter.');
    if (strlen($new) > 200) fail(422, 'Password terlalu panjang.');
    if ($new === $cur) fail(422, 'Password baru harus berbeda dari password saat ini.');
    q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $u['id']]);
    start_session();
    session_regenerate_id(true);
    if (is_staff($u)) admin_log($u, 'account.change_password', 'user', (int) $u['id'], (string) $u['name'], 'Mengganti password sendiri');
    respond(['ok' => true]);
}

function h_profile_update(): void
{
    $u = require_login();
    $d = json_body();
    $name = field($d, 'name', 'Nama', 2, 80);
    $email = strtolower(field($d, 'email', 'Email', 5, 160));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(422, 'Format email tidak valid.');
    $emailChanged = $email !== strtolower((string) $u['email']);
    if ($emailChanged) {
        // Mengganti email = mengganti kunci masuk, jadi wajib membuktikan password saat ini.
        $row = q('SELECT password_hash FROM users WHERE id = ?', [$u['id']])->fetch();
        if (!$row || !password_verify((string) ($d['current'] ?? ''), (string) $row['password_hash'])) { usleep(300000); fail(422, 'Password saat ini salah. Masukkan password untuk mengganti email.'); }
        if (q('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, $u['id']])->fetch()) fail(409, 'Email itu sudah dipakai akun lain.');
    }
    if ($name === $u['name'] && !$emailChanged) respond(['user' => $u]);
    q('UPDATE users SET name = ?, email = ? WHERE id = ?', [$name, $email, $u['id']]);
    $changes = [];
    if ($name !== $u['name']) $changes[] = 'Nama: ' . $u['name'] . ' → ' . $name;
    if ($emailChanged) {
        $changes[] = 'Email: ' . $u['email'] . ' → ' . $email;
        notify((int) $u['id'], null, 'account', 'Email akunmu diganti menjadi ' . $email . '. Gunakan email ini untuk masuk berikutnya.');
        // Beri tahu alamat lama agar pemilik asli tahu bila perubahan ini bukan dari dia.
        queue_mail((string) $u['email'], 'Email akunmu diganti', 'Email akunmu diganti', 'Email untuk akun ' . $u['name'] . ' di Cerita Rakyat Nusantara diganti menjadi ' . $email . '. Jika bukan kamu yang melakukannya, segera hubungi admin.');
    }
    $fresh = q('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [$u['id']])->fetch();
    $fresh['id'] = (int) $fresh['id'];
    if (is_staff($u)) admin_log($fresh, 'account.change_profile', 'user', (int) $u['id'], (string) $fresh['name'], implode('; ', $changes));
    respond(['user' => $fresh]);
}

/* ---------- Lupa password ---------- */

const RESET_TTL_MIN = 60;

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

/** Membuat token reset baru untuk $uid (token lama dihanguskan). Hanya hash-nya yang disimpan; token asli dikembalikan. */
function make_reset_token(int $uid): string
{
    q('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [now(), $uid]);
    $token = bin2hex(random_bytes(32));
    q('INSERT INTO password_resets (user_id, token_hash, ip, expires_at, used_at, created_at) VALUES (?,?,?,?,NULL,?)',
        [$uid, hash('sha256', $token), client_ip(), date('Y-m-d H:i:s', time() + RESET_TTL_MIN * 60), now()]);
    return $token;
}

function find_reset(string $token): ?array
{
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    $r = q('SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND user_id IS NOT NULL AND expires_at >= ?', [hash('sha256', $token), now()])->fetch();
    return $r ?: null;
}

function h_password_forgot(): void
{
    $d = json_body();
    $email = strtolower(trim((string) ($d['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(422, 'Masukkan alamat email yang valid.');
    if (!mail_enabled()) fail(503, 'Pengiriman email belum diaktifkan di situs ini, jadi tautan reset tidak dapat dikirim. Hubungi admin untuk mengatur ulang passwordmu.');
    q('DELETE FROM password_resets WHERE expires_at < ?', [date('Y-m-d H:i:s', time() - 86400)]);
    $ip = client_ip();
    $hourAgo = date('Y-m-d H:i:s', time() - 3600);
    if ((int) q('SELECT COUNT(*) FROM password_resets WHERE ip = ? AND created_at >= ?', [$ip, $hourAgo])->fetchColumn() >= 5) fail(429, 'Terlalu banyak permintaan. Coba lagi dalam satu jam.');
    $u = q('SELECT id, name, email FROM users WHERE email = ?', [$email])->fetch();
    if ($u && (int) q('SELECT COUNT(*) FROM password_resets WHERE user_id = ? AND created_at >= ?', [$u['id'], $hourAgo])->fetchColumn() < 3) {
        $token = make_reset_token((int) $u['id']);
        queue_mail((string) $u['email'], 'Atur ulang passwordmu', 'Atur ulang password',
            'Halo ' . $u['name'] . ",\n\nKami menerima permintaan untuk mengatur ulang password akunmu. Tautan di bawah berlaku " . RESET_TTL_MIN . " menit dan hanya bisa dipakai sekali.\n\nJika bukan kamu yang meminta, abaikan email ini. Passwordmu tidak akan berubah.",
            'Atur ulang password', '#/reset?token=' . $token);
    } elseif (!$u) {
        // Catat permintaan untuk email tak dikenal agar pembatasan per IP tetap berlaku (tanpa membocorkan apakah akun ada).
        q('INSERT INTO password_resets (user_id, token_hash, ip, expires_at, used_at, created_at) VALUES (NULL,?,?,?,?,?)', [hash('sha256', bin2hex(random_bytes(16))), $ip, now(), now(), now()]);
    }
    usleep(250000); // samakan waktu respons untuk email terdaftar dan tidak
    respond(['ok' => true]);
}

function h_password_reset_check(): void
{
    respond(['valid' => find_reset((string) ($_GET['token'] ?? '')) !== null]);
}

function h_password_reset(): void
{
    $d = json_body();
    $r = find_reset((string) ($d['token'] ?? ''));
    if (!$r) fail(410, 'Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.');
    $pass = (string) ($d['password'] ?? '');
    if (strlen($pass) < 8) fail(422, 'Password baru minimal 8 karakter.');
    if (strlen($pass) > 200) fail(422, 'Password terlalu panjang.');
    $uid = (int) $r['user_id'];
    q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $uid]);
    q('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [now(), $uid]);
    $u = q('SELECT id, name, role FROM users WHERE id = ?', [$uid])->fetch();
    notify($uid, null, 'account', 'Passwordmu berhasil diatur ulang lewat tautan email. Jika bukan kamu yang melakukannya, segera hubungi admin.');
    if ($u && is_staff($u)) admin_log(['id' => $uid, 'name' => $u['name']], 'account.reset_password', 'user', $uid, (string) $u['name'], 'Mengatur ulang password lewat tautan email');
    respond(['ok' => true]);
}

function h_admin_user_reset_password(int $id): void
{
    $a = require_admin();
    if ($id === $a['id']) fail(409, 'Untuk mengganti passwordmu sendiri, buka menu Profil saya.');
    $u = q('SELECT id, name, email FROM users WHERE id = ?', [$id])->fetch();
    if (!$u) fail(404, 'Akun tidak ditemukan.');
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // tanpa karakter yang mudah tertukar (0/O, 1/l/I)
    $pass = '';
    for ($i = 0; $i < 12; $i++) $pass .= $chars[random_int(0, strlen($chars) - 1)];
    q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $id]);
    q('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [now(), $id]);
    notify($id, $a['id'], 'account', 'Passwordmu diatur ulang oleh admin. Masuk dengan password sementara dari admin, lalu segera ganti lewat menu Profil.');
    admin_log($a, 'account.admin_reset_password', 'user', $id, (string) $u['name'], 'Password sementara dibuat untuk ' . $u['email']);
    respond(['password' => $pass, 'name' => $u['name'], 'email' => $u['email']]);
}

function h_me(): void
{
    respond(['user' => current_user()]);
}

/* ---------- Cerita milik pengguna ---------- */

function h_my_stories(): void
{
    $u = require_login();
    $rows = q('SELECT ' . STORY_COLS . ', (SELECT COUNT(*) FROM flipbooks fb WHERE fb.story_id = s.id) AS has_flipbook FROM stories s WHERE s.user_id = ? ORDER BY s.updated_at DESC, s.id DESC', [$u['id']])->fetchAll();
    respond(['stories' => array_map('story_out', $rows)]);
}

function h_story_create(): void
{
    $u = require_login();
    $in = story_input(json_body());
    q("INSERT INTO stories (user_id, title, region, province, category, short_description, full_story, image_url, author, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?)",
        [$u['id'], $in['title'], $in['region'], $in['province'], $in['category'], $in['short_description'], $in['full_story'], $in['image_url'], $u['name'], now(), now()]);
    $id = (int) db()->lastInsertId();
    notify_admins($u['id'], 'story_submitted', "Cerita baru menunggu persetujuan: \"{$in['title']}\" dari {$u['name']}.");
    respond(['story' => story_out(find_story($id))], 201);
}

function h_story_update(int $id): void
{
    $u = require_login();
    $s = find_story($id);
    $isAdmin = is_staff($u);
    if (!$isAdmin) {
        if ((int) $s['user_id'] !== $u['id']) fail(403, 'Kamu hanya dapat mengubah ceritamu sendiri.');
        if (!in_array($s['status'], ['pending', 'rejected'], true)) fail(409, 'Cerita yang sudah disetujui tidak dapat diubah langsung. Ajukan permintaan edit ke admin atau reviewer.');
    }
    $in = story_input(json_body());
    $status = (!$isAdmin && $s['status'] === 'rejected') ? 'pending' : $s['status'];
    q('UPDATE stories SET title=?, region=?, province=?, category=?, short_description=?, full_story=?, image_url=?, status=?, updated_at=? WHERE id=?',
        [$in['title'], $in['region'], $in['province'], $in['category'], $in['short_description'], $in['full_story'], $in['image_url'], $status, now(), $id]);
    if (!$isAdmin && $s['status'] === 'rejected') notify_admins($u['id'], 'story_submitted', "Cerita \"{$in['title']}\" diperbarui dan menunggu persetujuan ulang.");
    if ($isAdmin) admin_log($u, 'story.edit', 'story', $id, $in['title'], 'Isi atau detail cerita diubah oleh admin atau reviewer', 10);
    respond(['story' => story_out(find_story($id))]);
}

function h_story_delete(int $id): void
{
    $u = require_login();
    $s = find_story($id);
    if ((int) $s['user_id'] !== $u['id']) fail(403, 'Kamu hanya dapat menghapus ceritamu sendiri.');
    if (!in_array($s['status'], ['pending', 'rejected'], true)) fail(409, 'Cerita yang sudah disetujui harus diajukan penghapusannya ke admin.');
    q('DELETE FROM stories WHERE id = ?', [$id]);
    respond(['ok' => true]);
}

function h_story_request(int $id): void
{
    $u = require_login();
    $s = find_story($id);
    if ((int) $s['user_id'] !== $u['id']) fail(403, 'Kamu hanya dapat mengajukan permintaan untuk ceritamu sendiri.');
    if (!in_array($s['status'], ['approved', 'published'], true)) fail(409, 'Cerita ini masih bisa kamu ubah atau hapus langsung.');
    $d = json_body();
    $type = $d['type'] ?? '';
    if (!in_array($type, ['edit', 'delete'], true)) fail(422, 'Jenis permintaan tidak valid.');
    $reason = field($d, 'reason', 'Alasan', 5, 500);
    if (q("SELECT id FROM story_requests WHERE story_id = ? AND user_id = ? AND status = 'pending'", [$id, $u['id']])->fetch()) fail(409, 'Permintaanmu masih diproses admin.');
    q("INSERT INTO story_requests (story_id, user_id, request_type, reason, status, created_at) VALUES (?,?,?,?, 'pending', ?)", [$id, $u['id'], $type, $reason, now()]);
    $label = $type === 'edit' ? 'pengubahan' : 'penghapusan';
    notify_admins($u['id'], 'request', "Permintaan $label cerita \"{$s['title']}\" dari {$u['name']}.");
    respond(['ok' => true], 201);
}

/* ---------- Favorit & notifikasi ---------- */

function h_favorites(): void
{
    $u = require_login();
    $rows = q('SELECT ' . STORY_COLS . ', 1 AS is_favorite FROM favorites f JOIN stories s ON s.id = f.story_id WHERE f.user_id = ? AND s.status = ? ORDER BY f.created_at DESC', [$u['id'], 'published'])->fetchAll();
    respond(['stories' => array_map('story_out', $rows)]);
}

function h_favorite_toggle(int $id): void
{
    $u = require_login();
    $s = q("SELECT id FROM stories WHERE id = ? AND status = 'published'", [$id])->fetch();
    if (!$s) fail(404, 'Cerita tidak ditemukan.');
    $has = q('SELECT id FROM favorites WHERE user_id = ? AND story_id = ?', [$u['id'], $id])->fetch();
    if ($has) {
        q('DELETE FROM favorites WHERE id = ?', [$has['id']]);
        respond(['is_favorite' => false]);
    }
    q('INSERT INTO favorites (user_id, story_id, created_at) VALUES (?,?,?)', [$u['id'], $id, now()]);
    respond(['is_favorite' => true]);
}

function h_notifications(): void
{
    $u = require_login();
    $rows = q('SELECT id, type, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50', [$u['id']])->fetchAll();
    $unread = (int) q('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0', [$u['id']])->fetchColumn();
    foreach ($rows as &$r) { $r['id'] = (int) $r['id']; $r['is_read'] = (int) $r['is_read'] > 0; }
    respond(['notifications' => $rows, 'unread' => $unread]);
}

function h_notifications_read(): void
{
    $u = require_login();
    q('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [$u['id']]);
    respond(['ok' => true]);
}

function h_notification_read(int $id): void
{
    $u = require_login();
    q('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [$id, $u['id']]);
    respond(['ok' => true]);
}

/* ---------- Unggah gambar ---------- */

function h_upload(): void
{
    $u = require_login();
    $f = $_FILES['file'] ?? null;
    if (!$f || !is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        $e = $f['error'] ?? UPLOAD_ERR_NO_FILE;
        fail(422, in_array($e, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'Ukuran gambar terlalu besar (maks. 5 MB).' : 'Pilih berkas gambar terlebih dahulu.');
    }
    if ($f['size'] > (int) cfg('upload_max_bytes')) fail(422, 'Ukuran gambar terlalu besar (maks. 5 MB).');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'][$mime] ?? null;
    if (!$ext || @getimagesize($f['tmp_name']) === false) fail(422, 'Format gambar harus JPG, PNG, WEBP, atau GIF.');
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail(500, 'Folder unggahan tidak dapat dibuat.');
    $name = bin2hex(random_bytes(10)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) fail(500, 'Gambar gagal disimpan.');
    $url = 'api/uploads/' . $name;
    q('INSERT INTO flipbook_assets (uploaded_by, url, original_name, created_at) VALUES (?,?,?,?)', [$u['id'], $url, mb_substr(basename((string) $f['name']), 0, 160), now()]);
    respond(['url' => $url], 201);
}

/* ---------- Admin ---------- */

function h_admin_stats(): void
{
    $me = require_staff();
    $c = fn(string $sql) => (int) q($sql)->fetchColumn();
    respond([
        'total' => $c('SELECT COUNT(*) FROM stories'),
        'pending' => $c("SELECT COUNT(*) FROM stories WHERE status = 'pending'"),
        'approved' => $c("SELECT COUNT(*) FROM stories WHERE status = 'approved'"),
        'published' => $c("SELECT COUNT(*) FROM stories WHERE status = 'published'"),
        'rejected' => $c("SELECT COUNT(*) FROM stories WHERE status = 'rejected'"),
        'users' => $c("SELECT COUNT(*) FROM users WHERE role = 'user'"),
        'admins' => $c("SELECT COUNT(*) FROM users WHERE role = 'admin'"),
        'reviewers' => $c("SELECT COUNT(*) FROM users WHERE role = 'reviewer'"),
        'is_admin' => $me['role'] === 'admin',
        'requests' => $c("SELECT COUNT(*) FROM story_requests WHERE status = 'pending'"),
        'default_password' => hash_equals(SEED_ADMIN_HASH, (string) q('SELECT password_hash FROM users WHERE id = ?', [$me['id']])->fetchColumn()),
    ]);
}

function h_admin_stories(): void
{
    require_staff();
    $p = [];
    $cond = [];
    $st = $_GET['status'] ?? '';
    if (in_array($st, ['pending', 'approved', 'published', 'rejected'], true)) { $cond[] = 's.status = ?'; $p[] = $st; }
    $term = trim((string) ($_GET['q'] ?? ''));
    if ($term !== '') {
        $like = like_term($term);
        $cond[] = "(s.title LIKE ? ESCAPE '!' OR s.region LIKE ? ESCAPE '!' OR u.name LIKE ? ESCAPE '!')";
        array_push($p, $like, $like, $like);
    }
    $pv = (string) ($_GET['province'] ?? '');
    if ($pv !== '' && in_array($pv, PROVINCES, true)) { $cond[] = 's.province = ?'; $p[] = $pv; }
    $ct = (string) ($_GET['category'] ?? '');
    if ($ct !== '' && in_array($ct, CATEGORIES, true)) { $cond[] = 's.category = ?'; $p[] = $ct; }
    $w = $cond ? 'WHERE ' . implode(' AND ', $cond) : '';
    $rows = q('SELECT ' . STORY_COLS . ', u.name AS owner_name, u.email AS owner_email, (SELECT COUNT(*) FROM flipbooks fb WHERE fb.story_id = s.id) AS has_flipbook FROM stories s JOIN users u ON u.id = s.user_id ' . $w . ' ORDER BY s.updated_at DESC, s.id DESC', $p)->fetchAll();
    respond(['stories' => array_map('story_out', $rows)]);
}

function h_admin_approve(int $id): void
{
    $a = require_staff();
    $s = find_story($id);
    if (!in_array($s['status'], ['pending', 'rejected'], true)) fail(409, 'Cerita ini sudah disetujui.');
    q("UPDATE stories SET status = 'approved', reject_reason = NULL, updated_at = ? WHERE id = ?", [now(), $id]);
    notify((int) $s['user_id'], $a['id'], 'approved', "Ceritamu \"{$s['title']}\" disetujui dan sedang disiapkan menjadi buku oleh admin.");
    admin_log($a, 'story.approve', 'story', $id, $s['title'], $s['status'] === 'rejected' ? 'Disetujui setelah sebelumnya ditolak' : null);
    respond(['ok' => true]);
}

function h_admin_reject(int $id): void
{
    $a = require_staff();
    $s = find_story($id);
    if ($s['status'] !== 'pending') fail(409, 'Hanya cerita berstatus menunggu yang dapat ditolak.');
    $reason = field(json_body(), 'reason', 'Alasan penolakan', 5, 300);
    q("UPDATE stories SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?", [$reason, now(), $id]);
    notify((int) $s['user_id'], $a['id'], 'rejected', "Ceritamu \"{$s['title']}\" belum dapat diterbitkan. Alasan: $reason");
    admin_log($a, 'story.reject', 'story', $id, $s['title'], 'Alasan: ' . $reason);
    respond(['ok' => true]);
}

function h_admin_publish(int $id): void
{
    $a = require_staff();
    $s = find_story($id);
    if (!in_array($s['status'], ['approved', 'published'], true)) fail(409, 'Setujui cerita terlebih dahulu sebelum menerbitkan.');
    $fb = q('SELECT id FROM flipbooks WHERE story_id = ?', [$id])->fetch();
    $pages = $fb ? (int) q('SELECT COUNT(*) FROM flipbook_pages WHERE flipbook_id = ?', [$fb['id']])->fetchColumn() : 0;
    if ($pages < 1) fail(422, 'Buat dan simpan flipbook terlebih dahulu sebelum menerbitkan.');
    q("UPDATE flipbooks SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?", [now(), now(), $fb['id']]);
    q("UPDATE stories SET status = 'published', updated_at = ? WHERE id = ?", [now(), $id]);
    if ($s['status'] !== 'published') notify((int) $s['user_id'], $a['id'], 'published', "Ceritamu \"{$s['title']}\" sudah terbit sebagai buku flipbook. Selamat!");
    admin_log($a, 'story.publish', 'story', $id, $s['title'], $s['status'] === 'published' ? 'Penerbitan diperbarui' : null);
    respond(['ok' => true]);
}

function h_admin_unpublish(int $id): void
{
    $a = require_staff();
    $s = find_story($id);
    if ($s['status'] !== 'published') fail(409, 'Cerita ini belum terbit.');
    q("UPDATE stories SET status = 'approved', updated_at = ? WHERE id = ?", [now(), $id]);
    q("UPDATE flipbooks SET status = 'draft', updated_at = ? WHERE story_id = ?", [now(), $id]);
    admin_log($a, 'story.unpublish', 'story', $id, $s['title']);
    respond(['ok' => true]);
}

function h_admin_story_delete(int $id): void
{
    $a = require_staff();
    $s = find_story($id);
    q('DELETE FROM stories WHERE id = ?', [$id]);
    admin_log($a, 'story.delete', 'story', null, $s['title'], 'Status terakhir: ' . $s['status'] . '; penulis: ' . $s['owner_name']);
    respond(['ok' => true]);
}

function h_admin_flipbook_get(int $id): void
{
    require_staff();
    $s = find_story($id);
    respond(['story' => story_out($s), 'flipbook' => load_flipbook($id)]);
}

function h_admin_flipbook_save(int $id): void
{
    $a = require_staff();
    $s = find_story($id);
    if (!in_array($s['status'], ['approved', 'published'], true)) fail(409, 'Setujui cerita terlebih dahulu sebelum mendesain flipbook.');
    $clean = sanitize_flipbook(json_body());
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $fb = q('SELECT id FROM flipbooks WHERE story_id = ?', [$id])->fetch();
        $settings = json_encode($clean['settings']);
        if ($fb) {
            $fid = (int) $fb['id'];
            q('UPDATE flipbooks SET settings = ?, updated_at = ? WHERE id = ?', [$settings, now(), $fid]);
            q('DELETE FROM flipbook_pages WHERE flipbook_id = ?', [$fid]);
        } else {
            q("INSERT INTO flipbooks (story_id, status, settings, created_at, updated_at) VALUES (?, 'draft', ?, ?, ?)", [$id, $settings, now(), now()]);
            $fid = (int) $pdo->lastInsertId();
        }
        foreach ($clean['pages'] as $i => $p) {
            $content = ['elements' => $p['elements']];
            if (isset($p['bgImage'])) $content['bgImage'] = $p['bgImage'];
            q('INSERT INTO flipbook_pages (flipbook_id, page_no, page_uid, bg, content) VALUES (?,?,?,?,?)',
                [$fid, $i + 1, $p['id'], $p['bg'], json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    admin_log($a, 'flipbook.save', 'story', $id, $s['title'], count($clean['pages']) . ' halaman' . ($s['status'] === 'published' ? ' (buku sudah terbit)' : ''), 15);
    respond(['ok' => true, 'pages' => count($clean['pages'])]);
}

/** Apakah gambar unggahan ini masih dipakai di halaman flipbook atau sebagai gambar pengajuan cerita? */
function asset_in_use(string $url): bool
{
    if (q('SELECT 1 FROM flipbook_pages WHERE INSTR(content, ?) > 0 LIMIT 1', [$url])->fetchColumn()) return true;
    return (bool) q('SELECT 1 FROM stories WHERE image_url = ? LIMIT 1', [$url])->fetchColumn();
}

/**
 * Menghapus satu unggahan dari pustaka. Berkas di server ikut dihapus HANYA bila tidak lagi dipakai
 * di buku mana pun, supaya flipbook yang sudah dibuat tidak kehilangan gambar.
 * @return array{removed: bool, file_deleted: bool, in_use: bool}
 */
function asset_remove(array $row): array
{
    $url = (string) $row['url'];
    $inUse = asset_in_use($url);
    $fileDeleted = false;
    if (!$inUse && preg_match('#^api/uploads/([a-f0-9]{20}\.(?:jpg|png|webp|gif))$#', $url, $m)) {
        $path = __DIR__ . '/uploads/' . $m[1];
        if (is_file($path)) $fileDeleted = @unlink($path);
    }
    q('DELETE FROM flipbook_assets WHERE id = ?', [$row['id']]);
    return ['removed' => true, 'file_deleted' => $fileDeleted, 'in_use' => $inUse];
}

function h_admin_assets(): void
{
    require_staff();
    $rows = q('SELECT id, url, original_name, created_at FROM flipbook_assets ORDER BY id DESC LIMIT 200')->fetchAll();
    foreach ($rows as &$r) { $r['id'] = (int) $r['id']; $r['used'] = asset_in_use((string) $r['url']); }
    respond(['assets' => $rows]);
}

function h_admin_asset_delete(int $id): void
{
    $a = require_staff();
    $row = q('SELECT id, url, original_name FROM flipbook_assets WHERE id = ?', [$id])->fetch();
    if (!$row) fail(404, 'Gambar tidak ditemukan. Mungkin sudah dihapus.');
    $res = asset_remove($row);
    admin_log($a, 'asset.delete', 'asset', null, (string) $row['original_name'], $res['in_use'] ? 'Dilepas dari pustaka; berkas dipertahankan karena masih dipakai di buku' : 'Berkas dihapus dari server');
    respond(['ok' => true] + $res);
}

/** Hapus banyak sekaligus: {"ids":[1,2]} atau {"unused":true} untuk membersihkan semua yang tidak terpakai. */
function h_admin_assets_bulk_delete(): void
{
    $a = require_staff();
    $d = json_body();
    if (!empty($d['unused'])) {
        $rows = q('SELECT id, url FROM flipbook_assets')->fetchAll();
        $rows = array_values(array_filter($rows, fn($r) => !asset_in_use((string) $r['url'])));
    } else {
        $ids = array_values(array_unique(array_filter(array_map('intval', is_array($d['ids'] ?? null) ? $d['ids'] : []), fn($i) => $i > 0)));
        if (!$ids) fail(422, 'Pilih gambar yang akan dihapus.');
        if (count($ids) > 200) fail(422, 'Terlalu banyak gambar sekaligus (maks. 200).');
        $in = implode(',', array_fill(0, count($ids), '?'));
        $rows = q("SELECT id, url FROM flipbook_assets WHERE id IN ($in)", $ids)->fetchAll();
    }
    $deleted = 0; $files = 0; $kept = 0;
    foreach ($rows as $r) {
        $res = asset_remove($r);
        $deleted++;
        if ($res['file_deleted']) $files++;
        if ($res['in_use']) $kept++;
    }
    if ($deleted > 0) admin_log($a, 'asset.delete', 'asset', null, $deleted . ' gambar unggahan', $files . ' berkas dihapus dari server, ' . $kept . ' dipertahankan karena dipakai di buku' . (!empty($d['unused']) ? ' (bersihkan yang tak terpakai)' : ''));
    respond(['ok' => true, 'deleted' => $deleted, 'files_deleted' => $files, 'kept_in_books' => $kept]);
}

function h_admin_requests(): void
{
    require_staff();
    $rows = q("SELECT r.id, r.story_id, r.request_type, r.reason, r.created_at, s.title, u.name AS user_name FROM story_requests r JOIN stories s ON s.id = r.story_id JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' ORDER BY r.id")->fetchAll();
    foreach ($rows as &$r) { $r['id'] = (int) $r['id']; $r['story_id'] = (int) $r['story_id']; }
    respond(['requests' => $rows]);
}

function h_admin_request_resolve(int $id): void
{
    $a = require_staff();
    $r = q("SELECT r.*, s.title FROM story_requests r JOIN stories s ON s.id = r.story_id WHERE r.id = ? AND r.status = 'pending'", [$id])->fetch();
    if (!$r) fail(404, 'Permintaan tidak ditemukan atau sudah diproses.');
    $decision = json_body()['decision'] ?? '';
    if (!in_array($decision, ['approve', 'reject'], true)) fail(422, 'Keputusan tidak valid.');
    $uid = (int) $r['user_id'];
    if ($decision === 'reject') {
        q("UPDATE story_requests SET status = 'rejected', resolved_at = ? WHERE id = ?", [now(), $id]);
        notify($uid, $a['id'], 'request_result', "Permintaanmu untuk cerita \"{$r['title']}\" tidak disetujui.");
    } elseif ($r['request_type'] === 'delete') {
        q('DELETE FROM stories WHERE id = ?', [$r['story_id']]);
        notify($uid, $a['id'], 'request_result', "Cerita \"{$r['title']}\" sudah dihapus sesuai permintaanmu.");
    } else {
        q("UPDATE story_requests SET status = 'approved', resolved_at = ? WHERE id = ?", [now(), $id]);
        q("UPDATE stories SET status = 'pending', updated_at = ? WHERE id = ?", [now(), $r['story_id']]);
        q("UPDATE flipbooks SET status = 'draft', updated_at = ? WHERE story_id = ?", [now(), $r['story_id']]);
        notify($uid, $a['id'], 'request_result', "Permintaan edit disetujui. Ceritamu \"{$r['title']}\" kembali ke status menunggu sehingga bisa kamu ubah; admin akan meninjau ulang.");
    }
    $who = (string) (q('SELECT name FROM users WHERE id = ?', [$uid])->fetchColumn() ?: 'penulis');
    admin_log($a, 'request.' . ($decision === 'approve' ? 'approve' : 'reject'), 'story', $decision === 'approve' && $r['request_type'] === 'delete' ? null : (int) $r['story_id'], (string) $r['title'],
        'Permintaan ' . ($r['request_type'] === 'delete' ? 'hapus' : 'edit') . ' dari ' . $who . ': ' . $r['reason']);
    respond(['ok' => true]);
}

function h_admin_users(): void
{
    require_admin();
    $rows = q('SELECT u.id, u.name, u.email, u.role, u.created_at, (SELECT COUNT(*) FROM stories s WHERE s.user_id = u.id) AS stories FROM users u ORDER BY u.role, u.id')->fetchAll();
    foreach ($rows as &$r) { $r['id'] = (int) $r['id']; $r['stories'] = (int) $r['stories']; }
    respond(['users' => $rows]);
}

function h_admin_create_reviewer(): void
{
    $me = require_admin();
    $d = json_body();
    $name = field($d, 'name', 'Nama', 2, 80);
    $email = strtolower(field($d, 'email', 'Email', 5, 160));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(422, 'Format email tidak valid.');
    $pass = (string) ($d['password'] ?? '');
    if (strlen($pass) < 8) fail(422, 'Password minimal 8 karakter.');
    if (strlen($pass) > 200) fail(422, 'Password terlalu panjang.');
    if (q('SELECT id FROM users WHERE email = ?', [$email])->fetch()) fail(409, 'Email sudah terdaftar.');
    q("INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?,?,?,'reviewer',?)", [$name, $email, password_hash($pass, PASSWORD_DEFAULT), now()]);
    $newId = (int) db()->lastInsertId();
    admin_log($me, 'account.create_reviewer', 'user', $newId, $name, $email);
    notify($newId, $me['id'], 'account', 'Akun reviewer/publisher untukmu dibuat oleh ' . $me['name'] . ". Masuk dengan email $email dan password yang diberikan admin, lalu segera ganti lewat menu Profil.");
    respond(['ok' => true], 201);
}

/** Admin mengubah peran akun: pengguna <-> reviewer. Peran admin tidak dapat diberikan atau dicabut (hanya ada satu admin). */
function h_admin_user_role(int $id): void
{
    $me = require_admin();
    $d = json_body();
    $role = (string) ($d['role'] ?? '');
    if (!in_array($role, ['user', 'reviewer'], true)) fail(422, 'Peran harus pengguna atau reviewer. Peran admin tidak dapat diberikan karena hanya ada satu admin.');
    if ($id === $me['id']) fail(409, 'Peran akun adminmu sendiri tidak dapat diubah.');
    $u = q('SELECT id, name, email, role FROM users WHERE id = ?', [$id])->fetch();
    if (!$u) fail(404, 'Akun tidak ditemukan.');
    if ($u['role'] === 'admin') fail(409, 'Peran admin tidak dapat diubah.');
    if ($u['role'] === $role) respond(['ok' => true]);
    q('UPDATE users SET role = ? WHERE id = ?', [$role, $id]);
    admin_log($me, 'account.set_role', 'user', $id, (string) $u['name'], $role === 'reviewer' ? 'Dijadikan reviewer/publisher' : 'Dikembalikan menjadi pengguna biasa');
    notify($id, $me['id'], 'account', $role === 'reviewer'
        ? 'Perananmu kini reviewer/publisher: kamu bisa menyetujui, mendesain, dan menerbitkan cerita lewat panel. Keluar lalu masuk lagi bila menu belum berubah.'
        : 'Perananmu dikembalikan menjadi pengguna biasa oleh admin.');
    respond(['ok' => true]);
}

function h_admin_user_delete(int $id): void
{
    $a = require_admin();
    if ($id === $a['id']) fail(409, 'Kamu tidak dapat menghapus akunmu sendiri.');
    $u = q('SELECT id, role FROM users WHERE id = ?', [$id])->fetch();
    if (!$u) fail(404, 'Akun tidak ditemukan.');
    if ($u['role'] === 'admin') fail(409, 'Akun admin tidak dapat dihapus.');
    $gone = q('SELECT name, email, role FROM users WHERE id = ?', [$id])->fetch();
    q('DELETE FROM users WHERE id = ?', [$id]);
    if ($gone) admin_log($a, 'account.delete_' . ($gone['role'] === 'reviewer' ? 'reviewer' : 'user'), 'user', null, (string) $gone['name'], (string) $gone['email']);
    if ($gone) queue_mail($gone['email'], 'Akunmu telah dihapus', 'Akunmu telah dihapus', 'Halo ' . $gone['name'] . ",\n\nAkunmu di Cerita Rakyat Nusantara telah dihapus oleh administrator beserta cerita-ceritanya. Bila ini keliru, silakan daftar kembali atau hubungi admin.");
    respond(['ok' => true]);
}

/* ---------- Pengaturan email (admin) ---------- */

/** Pengaturan email untuk ditampilkan ke admin. Sandi TIDAK PERNAH dikirim ke browser. */
function mail_settings_out(): array
{
    $db = (settings_all()['mail.configured'] ?? '') === '1';
    $host = trim((string) cfg('mail.host'));
    return [
        'enabled' => mail_enabled(), 'source' => $db ? 'database' : ($host !== '' ? 'file' : 'none'),
        'host' => $host, 'port' => (int) cfg('mail.port', 587), 'secure' => (string) cfg('mail.secure', 'tls'),
        'user' => (string) cfg('mail.user'), 'has_pass' => (string) cfg('mail.pass') !== '',
        'from_email' => (string) cfg('mail.from_email'), 'from' => (string) (cfg('mail.from_email') ?: cfg('mail.user')),
        'from_name' => (string) cfg('mail.from_name', 'Cerita Rakyat Nusantara'),
        'verify_peer' => (bool) cfg('mail.verify_peer', true), 'app_url' => app_url(),
    ];
}

function h_admin_mail_status(): void
{
    require_admin();
    respond(mail_settings_out());
}

function h_admin_mail_save(): void
{
    $a = require_admin();
    $d = json_body();
    $host = trim((string) ($d['host'] ?? ''));
    if ($host !== '' && !preg_match('/^[A-Za-z0-9]([A-Za-z0-9.\-]{0,188}[A-Za-z0-9])?$/', $host)) fail(422, 'Host SMTP tidak valid. Contoh: smtp.gmail.com');
    $port = (int) ($d['port'] ?? 587);
    if ($host !== '' && ($port < 1 || $port > 65535)) fail(422, 'Port harus antara 1 dan 65535.');
    $secure = (string) ($d['secure'] ?? 'tls');
    if (!in_array($secure, ['tls', 'ssl', 'none'], true)) fail(422, 'Pilihan keamanan tidak dikenal.');
    $user = trim((string) ($d['user'] ?? ''));
    if (mb_strlen($user) > 190) fail(422, 'Username terlalu panjang.');
    $from = trim((string) ($d['from_email'] ?? ''));
    if ($from !== '' && !filter_var($from, FILTER_VALIDATE_EMAIL)) fail(422, 'Format email pengirim tidak valid.');
    if ($host !== '' && $from === '' && !filter_var($user, FILTER_VALIDATE_EMAIL)) fail(422, 'Isi email pengirim (atau gunakan alamat email sebagai username).');
    $name = trim((string) ($d['from_name'] ?? ''));
    if (mb_strlen($name) > 80) fail(422, 'Nama pengirim maksimal 80 karakter.');
    $appUrl = trim((string) ($d['app_url'] ?? ''));
    if ($appUrl !== '' && !preg_match('#^https?://[^\s]+$#i', $appUrl)) fail(422, 'Alamat situs harus diawali http:// atau https://');
    $pass = (string) ($d['pass'] ?? '');
    if (strlen($pass) > 300) fail(422, 'Sandi terlalu panjang.');

    setting_set('mail.configured', '1');
    setting_set('mail.host', $host);
    setting_set('mail.port', (string) $port);
    setting_set('mail.secure', $secure === 'none' ? '' : $secure);
    setting_set('mail.user', $user);
    if ($pass !== '') setting_set('mail.pass', $pass);
    elseif (!empty($d['clear_pass'])) setting_set('mail.pass', '');
    elseif (!array_key_exists('mail.pass', settings_all())) setting_set('mail.pass', (string) (cfg('mail.pass') ?? ''));
    setting_set('mail.from_email', $from);
    setting_set('mail.from_name', $name);
    setting_set('mail.app_url', $appUrl);
    setting_set('mail.verify_peer', !empty($d['verify_peer']) ? '1' : '0');
    settings_all(true);
    admin_log($a, 'system.mail_settings', 'system', null, 'Pengaturan email', $host === '' ? 'Email dinonaktifkan' : "$host:$port (" . ($secure === 'none' ? 'tanpa enkripsi' : $secure) . "), pengirim " . ($from ?: $user));
    respond(mail_settings_out());
}

function h_admin_mail_reset(): void
{
    $a = require_admin();
    q("DELETE FROM settings WHERE skey LIKE 'mail.%'");
    settings_all(true);
    admin_log($a, 'system.mail_settings', 'system', null, 'Pengaturan email', 'Kembali memakai pengaturan dari berkas konfigurasi');
    respond(mail_settings_out());
}

function h_admin_mail_test(): void
{
    $a = require_admin();
    if (!mail_enabled()) fail(409, 'SMTP belum diatur. Isi pengaturan email lalu simpan terlebih dahulu.');
    $err = smtp_send($a['email'], 'Email uji Cerita Rakyat Nusantara', mail_html('Email uji berhasil', "Halo {$a['name']},\n\nJika kamu membaca ini, pengaturan SMTP sudah benar. Notifikasi persetujuan, penolakan, dan penerbitan cerita akan dikirim lewat email seperti ini.", 'Buka aplikasi', app_url()), "Email uji berhasil. Pengaturan SMTP sudah benar.");
    if ($err !== null) fail(502, 'Gagal mengirim. ' . smtp_friendly($err));
    admin_log($a, 'mail.test', 'user', $a['id'], $a['name'], 'Email uji dikirim ke ' . $a['email'], 5);
    respond(['ok' => true, 'to' => $a['email']]);
}


/* ---------- Log aktivitas admin ---------- */

const LOG_GROUPS = ['story', 'flipbook', 'request', 'account', 'asset', 'auth', 'mail', 'system'];

function h_admin_logs(): void
{
    require_admin();
    purge_old_logs();
    $w = [];
    $p = [];
    $term = trim((string) ($_GET['q'] ?? ''));
    if ($term !== '') {
        $like = like_term($term);
        $w[] = "(l.admin_name LIKE ? ESCAPE '!' OR l.target_label LIKE ? ESCAPE '!' OR l.detail LIKE ? ESCAPE '!')";
        array_push($p, $like, $like, $like);
    }
    $group = (string) ($_GET['group'] ?? '');
    if (in_array($group, LOG_GROUPS, true)) { $w[] = 'l.action LIKE ?'; $p[] = $group . '.%'; }
    $aid = (int) ($_GET['admin'] ?? 0);
    if ($aid > 0) { $w[] = 'l.admin_id = ?'; $p[] = $aid; }
    $range = (string) ($_GET['range'] ?? '');
    $since = ['today' => 'today', '7d' => '-7 days', '30d' => '-30 days'][$range] ?? null;
    if ($since !== null) { $w[] = 'l.created_at >= ?'; $p[] = date('Y-m-d H:i:s', (int) strtotime($since === 'today' ? 'today 00:00:00' : $since)); }
    $where = $w ? 'WHERE ' . implode(' AND ', $w) : '';
    $total = (int) q("SELECT COUNT(*) FROM admin_logs l $where", $p)->fetchColumn();
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 30)));
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $rows = q("SELECT l.id, l.admin_id, l.admin_name, l.action, l.target_type, l.target_id, l.target_label, l.detail, l.created_at FROM admin_logs l $where ORDER BY l.id DESC LIMIT $limit OFFSET $offset", $p)->fetchAll();
    foreach ($rows as &$r) {
        $r['id'] = (int) $r['id'];
        $r['admin_id'] = $r['admin_id'] !== null ? (int) $r['admin_id'] : null;
        $r['target_id'] = $r['target_id'] !== null ? (int) $r['target_id'] : null;
    }
    unset($r);
    $admins = q("SELECT id, name FROM users WHERE role IN ('admin','reviewer') ORDER BY name")->fetchAll();
    foreach ($admins as &$a) $a['id'] = (int) $a['id'];
    respond(['logs' => $rows, 'total' => $total, 'admins' => $admins, 'retention_days' => max(0, (int) cfg('log_retention_days', 90))]);
}

/* ---------- Backup data ---------- */

function h_admin_backup(): void
{
    $a = require_admin();
    $tmp = sys_get_temp_dir();
    $sqlPath = tempnam($tmp, 'crnsql');
    $fh = $sqlPath ? fopen($sqlPath, 'wb') : false;
    if (!$fh) fail(500, 'Berkas sementara untuk backup tidak dapat dibuat.');
    $tables = dump_database($fh);
    fclose($fh);
    if ($tables === 0) { @unlink($sqlPath); fail(500, 'Backup database gagal dibuat.'); }

    $upDir = __DIR__ . '/uploads';
    $files = is_dir($upDir) ? array_values(array_filter(scandir($upDir) ?: [], fn($f) => $f !== '' && $f[0] !== '.' && is_file("$upDir/$f"))) : [];
    $stamp = date('Ymd-His');
    $readme = "Backup Cerita Rakyat Nusantara\nDibuat: " . now() . " oleh " . $a['name'] . "\n\nIsi:\n- database.sql : seluruh tabel dan datanya\n- uploads/     : gambar yang diunggah (" . count($files) . " berkas)\n\nCara memulihkan:\n1. Buat database kosong, lalu impor database.sql (phpMyAdmin > Impor).\n2. Salin isi folder uploads/ ke folder api/uploads/ di server.\n\nPeringatan: database.sql berisi hash password pengguna. Simpan di tempat aman dan jangan dibagikan.\n";

    $outPath = $sqlPath;
    $name = "backup-cerita-nusantara-$stamp.sql";
    $mime = 'application/sql';
    $zipPath = null;
    if (class_exists('ZipArchive')) {
        $zipPath = tempnam($tmp, 'crnzip');
        $zip = new ZipArchive();
        if ($zipPath && $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
            $zip->addFile($sqlPath, 'database.sql');
            $zip->addFromString('BACA-SAYA.txt', $readme);
            foreach ($files as $f) $zip->addFile("$upDir/$f", "uploads/$f");
            if ($zip->close()) { $outPath = $zipPath; $name = "backup-cerita-nusantara-$stamp.zip"; $mime = 'application/zip'; }
        }
    }
    admin_log($a, 'system.backup', 'system', null, 'Backup data', $tables . ' tabel' . ($outPath === $zipPath ? ', ' . count($files) . ' berkas unggahan' : ' (hanya database; ekstensi ZIP tidak tersedia di server)'));
    header('Content-Type: ' . $mime);
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header('Content-Length: ' . filesize($outPath));
    readfile($outPath);
    @unlink($sqlPath);
    if ($zipPath) @unlink($zipPath);
}
