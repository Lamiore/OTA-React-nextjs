import type { MetadataRoute } from 'next';

/**
 * Manifest PWA — Next menyisipkan <link rel="manifest"> sendiri karena file ini
 * ada. Pasangannya service worker di public/sw.js: manifest bikin situs bisa
 * dipasang ke home screen, service worker yang bikin tiket tetap terbuka saat
 * sinyal hilang.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lautara — Dive Into Adventure',
    short_name: 'Lautara',
    description: 'Platform OTA untuk destinasi selam terbaik di Indonesia Utara',
    // Bukan '/': halaman itu hanya mengalihkan, dan pengguna yang memasang
    // aplikasi ini mau langsung ke daftar destinasi.
    start_url: '/beranda',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'id',
    background_color: '#FBFAF8',
    theme_color: '#1B8A8F',
    icons: [
      // ponytail: satu SVG dipakai untuk semua ukuran, bukan set PNG. Kalau
      // prompt "Install" Chrome tidak muncul di perangkat target, ganti dengan
      // PNG 192x192 dan 512x512 — sisa manifest ini tidak berubah.
      //
      // Namanya bukan /icon.svg: path itu sudah dipakai app/icon.svg (favicon
      // tab, konvensi App Router), dan file public bernama sama membuat Next
      // menolak dengan "conflicting public file and page file".
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
