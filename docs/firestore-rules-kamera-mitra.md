# Delta Firestore Rules — Kamera Mitra

Repo tidak menyimpan file rules; ruleset aktif dikelola di Firebase console
(Firestore Database → Rules). Terapkan DUA perubahan berikut ke ruleset aktif,
lalu Publish.

## 1. Blok baru: koleksi `cameras`

Tambahkan di dalam `match /databases/{database}/documents { ... }`, sejajar
dengan blok koleksi lain:

```
match /cameras/{cameraId} {
  function camUserRole() {
    return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
  }
  // Privat: hanya pemilik dan admin.
  allow read: if request.auth != null &&
    (resource.data.ownerUid == request.auth.uid || camUserRole() == 'admin');
  // Hanya mitra/pengelola/admin yang boleh mendaftarkan kamera miliknya sendiri.
  allow create: if request.auth != null &&
    request.resource.data.ownerUid == request.auth.uid &&
    camUserRole() in ['mitra', 'pengelola', 'admin'];
  allow delete: if request.auth != null &&
    (resource.data.ownerUid == request.auth.uid || camUserRole() == 'admin');
  // Edit kamera belum ada di aplikasi.
  allow update: if false;
}
```

Catatan query (sudah sesuai kode aplikasi):
- Mitra membaca dengan filter `where('ownerUid', '==', uid)` → lolos aturan
  `resource.data.ownerUid == request.auth.uid`.
- Admin membaca seluruh koleksi tanpa filter → lolos lewat `camUserRole() == 'admin'`.

## 2. Ubah blok `users`: izinkan user menulis `verification`-nya sendiri, tanpa bisa mengubah `role`

Pada blok `match /users/{uid}` yang sudah ada, pastikan aturan update
memenuhi SEMUA ketentuan ini:

- Admin tetap boleh mengubah `role` (mekanisme dropdown PenggunaPanel).
- Pemilik dokumen (`request.auth.uid == uid`) boleh update HANYA jika
  `role` tidak berubah:

```
allow update: if request.auth != null && (
  isAdmin() ||
  (request.auth.uid == uid &&
    request.resource.data.role == resource.data.role)
);
```

(`isAdmin()` = helper yang sudah ada di ruleset aktif; bila namanya berbeda,
gunakan padanannya. Bila blok `users` saat ini belum mengizinkan pemilik
meng-update dokumennya sendiri, aturan di atas sekaligus membukanya —
terbatas: `role` tidak boleh berubah.)

`approveMitra`/`rejectMitra` dijalankan admin sehingga tetap lolos lewat
cabang `isAdmin()`.

## Uji cepat setelah Publish (Rules Playground atau devtools)

1. User `role: 'user'` create `cameras/{x}` → DITOLAK.
2. User `role: 'mitra'` create dengan `ownerUid` = uid sendiri → LOLOS;
   dengan `ownerUid` orang lain → DITOLAK.
3. User update `users/{uid-sendiri}` mengubah `verification` → LOLOS;
   mengubah `role` → DITOLAK.
4. Mitra query `cameras` filter `ownerUid == uid sendiri` → LOLOS;
   tanpa filter → DITOLAK. Admin tanpa filter → LOLOS.
