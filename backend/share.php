<?php
declare(strict_types=1);

/**
 * Halaman pratinjau tautan untuk dibagikan (WhatsApp, Facebook, X, Telegram, dsb.).
 * Aplikasi memakai router "#/", sehingga pembaca tautan (crawler) tidak bisa melihat judul dan sampul cerita.
 * Tautan bagikan mengarah ke berkas ini: crawler membaca tag Open Graph di bawah, sedangkan
 * pengunjung biasa langsung dialihkan ke halaman cerita yang sebenarnya.
 *
 * Contoh: https://situsmu.id/api/share.php?id=5
 */
require __DIR__ . '/lib.php';

$id = (int) ($_GET['id'] ?? 0);
$base = app_url();
$e = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

$s = null;
try {
    if ($id > 0) $s = q("SELECT id, title, region, province, category, short_description, image_url FROM stories WHERE id = ? AND status = 'published'", [$id])->fetch() ?: null;
} catch (Throwable $ex) {
    error_log('[CRN] share: ' . $ex->getMessage());
}

header('X-Content-Type-Options: nosniff');
if (!$s) { header('Location: ' . $base, true, 302); exit; }

$target = $base . '#/cerita/' . (int) $s['id'];
$self = $base . 'api/share.php?id=' . (int) $s['id'];
$title = $s['title'] . ' | Cerita Rakyat Nusantara';
$desc = trim($s['category'] . ' dari ' . $s['region'] . ', ' . $s['province'] . '. ' . $s['short_description']);
if (mb_strlen($desc) > 200) $desc = rtrim(mb_substr($desc, 0, 197)) . '...';

// Gambar harus raster (JPG/PNG/WEBP/GIF); SVG tidak ditampilkan oleh WhatsApp/Facebook, jadi pakai gambar bawaan.
$img = (string) $s['image_url'];
$isRaster = (bool) preg_match('/\.(jpe?g|png|webp|gif)(\?.*)?$/i', $img);
$imgUrl = $isRaster ? (preg_match('#^https?://#i', $img) ? $img : $base . ltrim($img, '/')) : $base . 'og-default.png';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
?>
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title><?= $e($title) ?></title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="<?= $e($desc) ?>">
<link rel="canonical" href="<?= $e($target) ?>">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Cerita Rakyat Nusantara">
<meta property="og:locale" content="id_ID">
<meta property="og:title" content="<?= $e($s['title']) ?>">
<meta property="og:description" content="<?= $e($desc) ?>">
<meta property="og:image" content="<?= $e($imgUrl) ?>">
<meta property="og:url" content="<?= $e($self) ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= $e($s['title']) ?>">
<meta name="twitter:description" content="<?= $e($desc) ?>">
<meta name="twitter:image" content="<?= $e($imgUrl) ?>">
<meta http-equiv="refresh" content="0;url=<?= $e($target) ?>">
<script>location.replace(<?= json_encode($target, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?>);</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:32px;color:#2A1519;background:#FBF5EC">
<p>Membuka cerita <b><?= $e($s['title']) ?></b>&hellip;</p>
<p><a href="<?= $e($target) ?>">Klik di sini jika halaman tidak terbuka otomatis.</a></p>
</body>
</html>
