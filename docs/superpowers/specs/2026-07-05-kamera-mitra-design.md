# Kamera Mitra — Registrasi Kamera per User Terverifikasi

**Tanggal:** 2026-07-05
**Status:** Disetujui

## Latar Belakang

User biasa tidak bisa menambahkan apa pun ke platform. Dibutuhkan jalur agar
pihak luar terverifikasi (operator dive, resort, komunitas) bisa mendaftarkan
kamera miliknya sendiri dan melihat live stream-nya dari aplikasi.

Sistem ini **terpisah total** dari monitoring yang sudah ada
(`/monitoring` + `NEXT_PUBLIC_CAMERA_URL` + koleksi `monitoring_data`) —
tidak ada file monitoring yang disentuh.

## Keputusan Desain

1. **Role baru `mitra`** — hierarki menjadi `user → mitra → pengelola → admin`.
   Mitra ke atas (mitra/pengelola/admin) bisa mengelola kamera; pengelola dan
   admin tidak perlu verifikasi. Mitra TIDAK mendapat akses dashboard.
2. **Alur verifikasi:** user isi form (nama lengkap, no. HP, instansi) di
   profil → admin meninjau di dashboard → Setujui (role naik ke `mitra`) atau
   Tolak (bisa ajukan ulang).
3. **Kamera = identitas + URL stream langsung** (MJPEG/HTTP) yang diisi user;
   aplikasi menampilkan stream via `<img>` seperti pola `CameraPanel`.
4. **Visibilitas privat:** kamera hanya terlihat oleh pemiliknya (di profil)
   dan admin (di dashboard). Tidak ada galeri publik.
5. **Arsitektur data:** field `verification` embedded di `users/{uid}`
   (dashboard admin sudah streaming koleksi `users`); kamera di koleksi
   top-level `cameras` dengan `ownerUid` (bukan subcollection).

## Model Data

### `lib/useAuth.ts`

```ts
export type UserRole = 'user' | 'mitra' | 'pengelola' | 'admin';
```

### `lib/firestore.ts`

```ts
export interface MitraVerification {
  fullName: string;     // nama lengkap penanggung jawab
  phone: string;        // no. HP/WhatsApp aktif
  organization: string; // instansi/organisasi (operator dive, resort, ...)
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: unknown; // serverTimestamp
  reviewedAt?: unknown; // serverTimestamp saat admin setujui/tolak
}

// AppUser bertambah:
//   role: 'user' | 'mitra' | 'pengelola' | 'admin'
//   verification?: MitraVerification

export interface Camera {
  id: string;         // Firestore doc id
  cameraId: string;   // ID perangkat yang diisi user (bebas, unik per pemilik)
  name: string;       // nama tampilan, misal "Kamera Dermaga Bunaken"
  streamUrl: string;  // URL stream langsung (MJPEG/HTTP), wajib http(s)://
  location: string;   // lokasi pemasangan, boleh string kosong
  ownerUid: string;
  ownerName: string;  // snapshot nama pemilik saat dibuat (untuk panel admin)
  ownerEmail: string; // snapshot email pemilik saat dibuat
  createdAt: unknown;
}
```

Helper baru di `lib/firestore.ts`:

- `canManageCameras(role)` → `role === 'mitra' || role === 'pengelola' || role === 'admin'`.
- `submitMitraVerification(uid, data: { fullName; phone; organization })` —
  `updateDoc(users/{uid}, { verification: { ...data, status: 'pending', submittedAt: serverTimestamp() } })`.
  Dipakai juga untuk ajukan ulang setelah ditolak (menimpa verification lama).
- `approveMitra(uid)` — `updateDoc(users/{uid}, { role: 'mitra', 'verification.status': 'approved', 'verification.reviewedAt': serverTimestamp() })`.
- `rejectMitra(uid)` — `updateDoc(users/{uid}, { 'verification.status': 'rejected', 'verification.reviewedAt': serverTimestamp() })` (role tetap `user`).
- `addCamera(data: Omit<Camera, 'id' | 'createdAt'>)` — `addDoc(cameras, { ...data, createdAt: serverTimestamp() })`.
- `deleteCamera(id)` — `deleteDoc(cameras/{id})`.
- `subscribeMyCameras(uid, cb)` — `onSnapshot(query(cameras, where('ownerUid', '==', uid)))`.
- `subscribeAllCameras(cb)` — `onSnapshot(collection(cameras))` (panel admin).

## Perubahan UI

### Profil — `components/profile/ProfileView.tsx`

- Item menu baru **"Kamera"** (deskripsi: "Daftarkan & pantau kamera milikmu")
  di `menuItems` **di atas** "Riwayat Booking", ikon kamera.
- State `view` bertambah `'kamera'`; deep-link `?view=kamera` mengikuti pola
  `?view=riwayat` yang ada. Klik item → `setView('kamera')`.
- View `'kamera'` merender tombol "Kembali" + `<CameraSection user={user} role={role} />`
  (pola sama dengan view `'riwayat'`).

### Komponen baru — `components/cameras/`

**`CameraSection.tsx`** — router kecil berdasarkan role & status:

- `canManageCameras(role)` → render `CameraManager`.
- Selain itu, lihat `users/{uid}.verification` (onSnapshot dokumen sendiri):
  - tidak ada, atau `status === 'approved'` tapi role bukan mitra+ (kasus
    role diturunkan admin) → render `VerificationForm`;
  - `status === 'pending'` → kartu status "Pengajuan sedang ditinjau admin"
    beserta data yang diajukan;
  - `status === 'rejected'` → kartu "Pengajuan ditolak" + tombol
    "Ajukan Ulang" yang membuka `VerificationForm` terisi data lama.

**`VerificationForm.tsx`** — form: Nama Lengkap, No. HP, Instansi/Organisasi.
Semua wajib (trim tidak boleh kosong); No. HP `inputMode="tel"`. Submit →
`submitMitraVerification` → kartu status pending. Ada teks penjelasan singkat
kenapa verifikasi dibutuhkan.

**`CameraManager.tsx`** — untuk mitra/pengelola/admin:

- Daftar kamera milik sendiri (`subscribeMyCameras`): nama, ID kamera,
  lokasi, tombol **Lihat Live** dan **Hapus** (konfirmasi modal, pola portal
  `createPortal(document.body)` seperti modal batal di `BookingHistory`).
- Form **Tambah Kamera**: ID Kamera (wajib), Nama (wajib), URL Stream
  (wajib, harus diawali `http://` atau `https://`), Lokasi (opsional).
  Sebelum simpan: cek duplikat `cameraId` terhadap daftar kamera sendiri yang
  sudah ter-load (bukan query ekstra) → error "ID kamera sudah terdaftar."
- Empty state: "Belum ada kamera. Tambahkan kamera pertamamu."

**`CameraLiveModal.tsx`** — modal fullscreen-ish (portal ke body) berisi
`<img src={streamUrl}>`; `onError` → kartu error: "Tidak bisa terhubung ke
kamera. Pastikan kamera online dan satu jaringan. Catatan: bila aplikasi
dibuka lewat HTTPS, stream `http://` jaringan lokal akan diblokir browser."

### Dashboard admin

**`components/dashboard/DashboardSidebar.tsx`**
- `DashboardPage` bertambah `'kamera'`; `allMenuItems` bertambah
  `{ key: 'kamera', label: 'Kamera', roles: ['admin'] }` dengan ikon kamera.

**`app/dashboard/page.tsx`**
- `{page === 'kamera' && role === 'admin' && <KameraPanel />}`.

**`components/dashboard/KameraPanel.tsx`** (baru)
- `subscribeAllCameras`: tabel/daftar semua kamera — nama, ID, pemilik
  (`ownerName`/`ownerEmail` snapshot), lokasi, tombol **Lihat Live**
  (pakai `CameraLiveModal` yang sama). Tanpa hapus/edit di tahap ini.

**`components/dashboard/PenggunaPanel.tsx`**
- `roleColors` + dropdown role bertambah `mitra`.
- Baris user dengan `verification?.status === 'pending'` menampilkan blok
  pengajuan (nama lengkap, HP, instansi, tanggal) + tombol **Setujui**
  (`approveMitra`) dan **Tolak** (`rejectMitra`).

## Firestore Security Rules

Repo tidak menyimpan file rules (dikelola di Firebase console). Saat
implementasi, minta ruleset aktif dari console, lalu serahkan teks final
gabungan untuk ditempel ulang. Perubahan yang dibutuhkan:

- **`users/{uid}` update oleh pemilik:** boleh menulis field `verification`
  miliknya sendiri, tapi TIDAK boleh mengubah `role`
  (`request.resource.data.role == resource.data.role` saat penulis bukan
  admin). Admin tetap bebas mengubah `role` (mekanisme yang sudah berjalan).
- **Koleksi baru `cameras`:**

```
match /cameras/{cameraId} {
  function userRole() {
    return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
  }
  allow read: if request.auth != null &&
    (resource.data.ownerUid == request.auth.uid || userRole() == 'admin');
  allow create: if request.auth != null &&
    request.resource.data.ownerUid == request.auth.uid &&
    userRole() in ['mitra', 'pengelola', 'admin'];
  allow delete: if request.auth != null &&
    (resource.data.ownerUid == request.auth.uid || userRole() == 'admin');
  allow update: if false; // edit kamera belum ada di tahap ini
}
```

## Error Handling

- Semua field wajib divalidasi client-side (trim ≠ kosong) sebelum submit.
- `streamUrl` wajib lolos `/^https?:\/\//i`, selain itu error inline.
- Duplikat `cameraId` per pemilik ditolak dengan pesan jelas.
- Stream gagal dimuat (`onerror` pada `<img>`) → kartu error + catatan
  mixed-content (HTTPS app vs `http://` LAN) — batasan yang sama dengan
  `CameraPanel` lama.
- Aksi Firestore gagal → pesan error singkat, tombol kembali aktif
  (tidak ada silent fail; pola `try/finally` untuk state loading).

## Testing

Repo belum punya test infra; verifikasi manual via `npm run dev`:

1. User biasa buka Profil → Kamera → form verifikasi tampil; submit →
   status pending; dokumen `users/{uid}.verification` terisi.
2. Admin buka Dashboard → Pengguna → blok pengajuan tampil → Setujui →
   role user berubah `mitra` (badge di panel), user melihat CameraManager
   secara live (onSnapshot).
3. Tolak pengajuan → user melihat status ditolak → Ajukan Ulang berfungsi.
4. Mitra tambah kamera (ID, nama, URL, lokasi) → muncul di daftar; duplikat
   ID ditolak; URL tanpa http(s) ditolak.
5. Lihat Live menampilkan stream (uji dengan URL MJPEG lokal); URL mati
   menampilkan kartu error.
6. Hapus kamera (dengan konfirmasi) → hilang dari daftar.
7. Admin → Dashboard → Kamera: semua kamera semua user tampil + Lihat Live.
8. Pengelola/admin buka Profil → Kamera → langsung CameraManager tanpa
   verifikasi. Mitra tetap TIDAK bisa membuka `/dashboard`.
9. Rules: user biasa tidak bisa create `cameras` (uji dari console/devtools);
   user tidak bisa mengubah `role`-nya sendiri.

## Di Luar Scope

- Integrasi deteksi karang / server Python dengan kamera mitra.
- Galeri kamera publik.
- Edit kamera (hanya tambah/hapus di tahap ini).
- Upload dokumen identitas (KTP dsb.) — verifikasi cukup data teks.
- Notifikasi (bell/email) saat pengajuan disetujui/ditolak.
- Halaman `/monitoring` dan semua komponen `components/monitoring/` —
  tidak disentuh.
