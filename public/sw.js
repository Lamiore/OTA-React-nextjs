/*
 * Service worker seadanya — cukup untuk satu hal: tiket QR tetap terbuka di
 * dermaga waktu sinyal hilang. Shell halaman dilayani dari cache, datanya dari
 * cache persisten Firestore (lihat lib/firebase.ts).
 *
 * Tidak ada precache manifest dan tidak ada build step: yang pernah dibuka
 * pengunjung, itu yang tersimpan. Halaman yang belum pernah dibuka online
 * memang tidak akan terbuka offline — itu batas yang disengaja.
 *
 * Naikkan CACHE saat perilakunya berubah; versi lama dibuang saat activate.
 */
const CACHE = 'nusa-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function putInCache(request, response) {
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy));
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Firestore, RTDB, dan gambar dari host lain diurus jaringan + SDK-nya
  // sendiri. Men-cache-nya di sini justru menyajikan data basi.
  if (url.origin !== self.location.origin) return;

  // Navigasi: jaringan dulu supaya selalu dapat versi terbaru, salinan disimpan,
  // dan saat offline jatuh ke salinan halaman itu — atau ke beranda kalau
  // halaman itu sendiri belum pernah dibuka.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(request, response))
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/beranda'))),
    );
    return;
  }

  // Aset build ber-hash tidak pernah berubah isinya — cache dulu, hemat data.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches
        .match(request)
        .then((hit) => hit || fetch(request).then((response) => putInCache(request, response))),
    );
  }
});
