<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require __DIR__ . '/handlers.php';

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = (string) cfg('allowed_origin');
if ($allowed !== '' && $origin === $allowed) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Vary: Origin');
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(204); exit; }

// Tindakan yang mengubah data wajib berupa JSON atau multipart (memicu preflight CORS pada lintas-origin).
if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    $ct = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
    $hasBody = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0;
    if ($hasBody && !str_starts_with($ct, 'application/json') && !str_starts_with($ct, 'multipart/form-data')) {
        fail(415, 'Jenis konten tidak didukung.');
    }
}

$routes = [
    ['GET', 'meta', 'h_meta'],
    ['GET', 'stories', 'h_stories_list'],
    ['POST', 'stories', 'h_story_create'],
    ['GET', 'stories/(\d+)', 'h_story_get'],
    ['POST', 'stories/(\d+)/view', 'h_story_view'],
    ['PUT', 'stories/(\d+)', 'h_story_update'],
    ['DELETE', 'stories/(\d+)', 'h_story_delete'],
    ['POST', 'stories/(\d+)/requests', 'h_story_request'],
    ['GET', 'my/stories', 'h_my_stories'],
    ['POST', 'auth/register', 'h_register'],
    ['POST', 'auth/login', 'h_login'],
    ['POST', 'auth/logout', 'h_logout'],
    ['GET', 'auth/me', 'h_me'],
    ['POST', 'auth/password', 'h_password_change'],
    ['PUT', 'auth/profile', 'h_profile_update'],
    ['POST', 'auth/forgot', 'h_password_forgot'],
    ['GET', 'auth/reset-check', 'h_password_reset_check'],
    ['POST', 'auth/reset', 'h_password_reset'],
    ['GET', 'favorites', 'h_favorites'],
    ['POST', 'favorites/(\d+)', 'h_favorite_toggle'],
    ['GET', 'notifications', 'h_notifications'],
    ['POST', 'notifications/read', 'h_notifications_read'],
    ['POST', 'notifications/(\d+)/read', 'h_notification_read'],
    ['POST', 'upload', 'h_upload'],
    ['GET', 'admin/stats', 'h_admin_stats'],
    ['GET', 'admin/stories', 'h_admin_stories'],
    ['POST', 'admin/stories/(\d+)/approve', 'h_admin_approve'],
    ['POST', 'admin/stories/(\d+)/reject', 'h_admin_reject'],
    ['POST', 'admin/stories/(\d+)/publish', 'h_admin_publish'],
    ['POST', 'admin/stories/(\d+)/unpublish', 'h_admin_unpublish'],
    ['DELETE', 'admin/stories/(\d+)', 'h_admin_story_delete'],
    ['GET', 'admin/flipbooks/(\d+)', 'h_admin_flipbook_get'],
    ['PUT', 'admin/flipbooks/(\d+)', 'h_admin_flipbook_save'],
    ['GET', 'admin/assets', 'h_admin_assets'],
    ['POST', 'admin/assets/bulk-delete', 'h_admin_assets_bulk_delete'],
    ['DELETE', 'admin/assets/(\d+)', 'h_admin_asset_delete'],
    ['GET', 'admin/requests', 'h_admin_requests'],
    ['POST', 'admin/requests/(\d+)/resolve', 'h_admin_request_resolve'],
    ['GET', 'admin/users', 'h_admin_users'],
    ['POST', 'admin/reviewers', 'h_admin_create_reviewer'],
    ['POST', 'admin/users/(\d+)/role', 'h_admin_user_role'],
    ['DELETE', 'admin/users/(\d+)', 'h_admin_user_delete'],
    ['POST', 'admin/users/(\d+)/reset-password', 'h_admin_user_reset_password'],
    ['GET', 'admin/logs', 'h_admin_logs'],
    ['GET', 'admin/backup', 'h_admin_backup'],
    ['GET', 'admin/mail', 'h_admin_mail_status'],
    ['PUT', 'admin/mail', 'h_admin_mail_save'],
    ['POST', 'admin/mail/reset', 'h_admin_mail_reset'],
    ['POST', 'admin/mail/test', 'h_admin_mail_test'],
];

$route = trim((string) ($_GET['r'] ?? ''), '/');

try {
    $methodMatched = false;
    foreach ($routes as [$m, $pattern, $fn]) {
        if (!preg_match('#^' . $pattern . '$#', $route, $mm)) continue;
        $methodMatched = true;
        if ($m !== $method) continue;
        array_shift($mm);
        $fn(...array_map('intval', $mm));
        exit;
    }
    fail($methodMatched ? 405 : 404, $methodMatched ? 'Metode tidak diizinkan.' : 'Endpoint tidak ditemukan.');
} catch (PDOException $e) {
    error_log('[CRN] DB error: ' . $e->getMessage());
    fail(500, 'Terjadi kesalahan pada basis data. Pastikan database sudah dibuat dan dikonfigurasi.');
} catch (Throwable $e) {
    error_log('[CRN] ' . $e->getMessage());
    fail(500, 'Terjadi kesalahan pada server.');
}
