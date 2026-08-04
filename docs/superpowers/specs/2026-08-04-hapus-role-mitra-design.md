# Hapus Role Mitra & Allowlist Penonton Kamera

**Tanggal:** 4 Agustus 2026
**Status:** disetujui, siap dibuat rencana implementasi

## Latar

Dosen pembimbing meminta role `mitra` dihapus. App menyisakan tiga role: `admin`,
`pengelola`, `user`. Konsekuensinya bukan sekadar menghapus satu nilai enum —
seluruh alur "pengajuan mitra" ikut hilang, dan kamera perlu pemilik baru serta
cara baru menentukan siapa yang boleh menontonnya.

Model bisnisnya jadi: **user biasa boleh menonton kamera, tapi harus membeli paket
ke pengelola.** Pembelian paketnya urusan di luar sistem (booking yang sudah ada);
yang diatur di sini adalah pemberian aksesnya — **pengelola menambahkan sendiri
siapa yang boleh menonton**, bukan otomatis dari booking. Ini disengaja: pengelola
yang memutuskan, sistem tidak menebak dari transaksi.

## Keadaan produksi (dicek 4 Agustus 2026)

Menentukan besarnya pekerjaan, jadi dicatat:

- **Nol user berrole `mitra`.** Total non-`user` cuma 2 admin + 1 pengelola.
- **Satu dokumen kamera** (`cameras/OdSpu8wfFUaxv9OfJ1oZ`, nama "test").
- **Satu dokumen verification**, dan `requestedRole`-nya sudah `"pengelola"` eksplisit.
- **Satu destinasi bertaut kamera**: Desa Wisata Bahoi (`destinations/alGlcRJJQ0gb5y3vbo4S`).

Artinya **tidak ada migrasi data role sama sekali**. Fallback legacy
`requestedRole() ?? "mitra"` boleh dihapus mentah, bukan diarahkan ulang ke
`"pengelola"` — tidak ada dokumen yang bergantung padanya.

**Sudah dikerjakan sebelum spec ini ditulis:** `ownerUid`/`ownerName`/`ownerEmail`
kamera "test" dipindahkan dari admin (`amejingmeng@gmail.com`) ke pengelola
(`anakgilegile@gmail.com`, uid `yZ7a1It5SVNJFqAKdIxqEyeusn13`). Tanpa ini pengelola
tidak bisa mengelola penonton kamera di destinasi kelolaannya sendiri, karena
rule tulis di bawah bertumpu pada `ownerUid`.

## Model data

```
cameras/{id}
  + viewers: string[]          // alamat email, bukan uid

destinations/{id}
    cameraId: string           // sudah ada — doc id kamera, bukan id stream
  − cameraStreamId             // dihapus
  − cameraStreamUrl            // dihapus
  − cameraName                 // dihapus
```

**Kenapa allowlist berbasis email, bukan uid.** Rule `users` hanya mengizinkan baca
dokumen sendiri atau admin, jadi pengelola tidak bisa menerjemahkan email → uid dari
klien. Pilihannya: bikin route Admin SDK khusus, atau simpan emailnya langsung dan
cocokkan ke `request.auth.token.email` di rules. Yang kedua nol kode server, dan
bonusnya pengelola bisa memberi akses ke email yang belum punya akun — orangnya
langsung bisa menonton begitu mendaftar.

**Kenapa tiga field denormalisasi kamera dihapus dari destinasi.** Dokumen
`destinations` itu `allow read: if true`, dan `settings/cameraServer` juga publik.
Selama `cameraStreamId` masih ada di sana, siapa pun bisa merakit
`{serverUrl}/stream/{id}` sendiri — allowlist-nya cuma jadi hiasan. Halaman
destinasi kini membaca `cameras/{cameraId}` langsung, dan rules yang memutuskan
apakah dokumennya terbaca. `cameraId` sendiri aman dipublikasikan: itu doc id
Firestore, bukan id stream, dan tidak bisa dipakai menyusun URL apa pun.

## Firestore rules

```js
match /cameras/{cameraId} {
  function camUserRole() { ... }          // tetap
  function camUserLocation() { ... }      // tetap

  allow read: if request.auth != null
    && (
      resource.data.ownerUid == request.auth.uid
      || camUserRole() == 'admin'
      || (camUserRole() == 'pengelola' && resource.data.location == camUserLocation())
      || request.auth.token.email in resource.data.get('viewers', [])
    );

  allow create: if request.auth != null
    && request.resource.data.ownerUid == request.auth.uid
    && request.resource.data.status == 'pending'
    && camUserRole() in ['pengelola', 'admin'];   // 'mitra' dicoret

  // Pemilik kelola daftar penontonnya. hasOnly() wajib: tanpanya pemilik bisa
  // menyetujui kameranya sendiri lewat jalur ini — approve/reject tetap
  // eksklusif Admin SDK server VPS.
  allow update: if request.auth != null
    && resource.data.ownerUid == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewers']);
}

match /settings/{settingId} {
  allow write: if ... settingsUserRole() in ['pengelola', 'admin'];  // 'mitra' dicoret
}
```

`resource.data.get('viewers', [])` dipakai, bukan `resource.data.viewers` — dokumen
kamera lama tidak punya field itu dan akses langsung akan meledak jadi error, bukan
`false`.

**Yang harus diverifikasi sebelum rules ini dipasang:** ID token dari login kode
email membawa klaim `email`. Login lewat `createCustomToken(uid)` di
`app/api/auth/verify-code/route.ts`, dan akun Auth-nya selalu dibuat dengan `email`,
jadi klaimnya semestinya ikut. Buktikan dulu di browser (`getIdTokenResult()`) —
kalau ternyata kosong, allowlist harus balik ke uid + route Admin SDK resolver.

## Perubahan UI

**Pendaftaran kamera tetap di `/kamera`.** `CameraManager` tidak dipindah ke
dashboard; pengelola mendaftarkan kamera, melihat QR siaran, dan menghapus kamera
dari sana seperti sekarang.

**`CameraSection.tsx` dipangkas.** Sekarang komponen ini merutekan empat keadaan
(manager / pending / rejected / form). Tiga yang terakhir hilang bersama pengajuan
mitra. Sisanya: `canManageCameras(role)` → `CameraManager`, selain itu kartu
keterangan singkat bahwa kamera muncul di halaman destinasi setelah pengelola
memberi akses. Langganan `onSnapshot` ke `users/{uid}` ikut hilang — tidak ada lagi
yang dibaca darinya di sini.

**`KameraPanel.tsx` (dashboard) dapat kelola penonton.** Tiap kartu kamera yang
`ownerUid`-nya sama dengan pengelola yang sedang login mendapat input email +
daftar chip penonton dengan tombol hapus. Admin melihat daftarnya tapi tidak
mengelola — rule tulisnya bertumpu pada kepemilikan, dan admin bukan pemilik.

**`LiveMonitorPanel.tsx` berubah sumber data.** Prop `cameraStreamId` /
`cameraStreamUrl` / `cameraName` diganti satu prop `cameraDocId`. Komponen
berlangganan `cameras/{docId}`; kalau rules menolak atau dokumennya kosong,
`hasCamera` jadi `false` dan blok kamera tidak dirender — blok sensor tetap
tampil. Tidak ada pengecekan role di klien sama sekali: rules satu-satunya gerbang,
jadi tidak ada dua sumber kebenaran yang bisa berbeda.

`app/destinations/[id]/page.tsx` menyesuaikan syarat rendernya jadi
`dest.cameraId || stationPath(dest)`.

**`DestinasiPanel.tsx` berhenti mendenormalisasi.** Blok `linkedCam` di `handleSave`
dan tiga baris `cameraStreamId`/`cameraName`/`cameraStreamUrl` dihapus; `cameraId`
tetap disimpan lewat `...form`.

## Yang dihapus

| Berkas | Yang dicabut |
| --- | --- |
| `app/syarat-mitra/page.tsx` | seluruh halaman |
| `lib/verification.ts` | `AGREEMENT.mitra`, `"mitra"` dari `RoleRequestInput.requestedRole`, cabang `mustAgreeMitra` |
| `lib/verification.check.ts` | 12 kasus uji bermitra |
| `lib/firestore.ts` | `requestedRole()` + fallback, default `= "mitra"` di `approveRoleRequest` (baris 333), `"mitra"` dari tipe `AppUser.role` & `MitraVerification.requestedRole`, `"mitra"` di `canManageCameras` |
| `lib/useAuth.ts` | `'mitra'` dari `UserRole` |
| `lib/sendVerification.ts` | `'mitra'` dari parameter `notifyApproval` |
| `lib/i18n.ts` | ~7 kunci (`verifyForm.agreeTailMitra`, `verifyForm.submitMitra`, `verifyForm.mustAgreeMitra`, `manager.mitraPendingNote`, `role.mitraDesc`, dan teks `verifyForm.title`/`lede` yang menyebut mitra) |
| `components/cameras/VerificationForm.tsx` | prop `requestedRole` (bernilai tunggal sekarang), percabangan `isPengelola` |
| `components/cameras/CameraSection.tsx` | cabang pending / rejected / form |
| `components/profile/PengelolaRequest.tsx` | guard "mitra pending" (baris 67–75) |
| `components/profile/RoleBadge.tsx` | entri `mitra` |
| `components/dashboard/PenggunaPanel.tsx` | `<option value="mitra">`, warna badge `mitra` |
| `app/api/notify-approval/route.ts` | template email mitra, `role !== 'mitra'` di validasi |
| `firestore.rules` | `'mitra'` di `cameras.create` dan `settings.write` |

`MitraVerification` sebagai **nama tipe** ikut diganti jadi `RoleVerification` —
menyisakan nama "Mitra" pada tipe yang tidak lagi punya hubungan dengan mitra akan
menyesatkan pembaca berikutnya.

## Migrasi data

Satu dokumen, dijalankan sekali lewat Admin SDK (bukan MCP — `updateMask`-nya tidak
dihormati dan menimpa dokumen):

- `destinations/alGlcRJJQ0gb5y3vbo4S`: hapus field `cameraStreamId`,
  `cameraStreamUrl`, `cameraName`. Selama masih ada, id stream `dbskg4` tetap
  terbaca publik walaupun kodenya sudah tidak memakainya.

Kamera "test" sudah dipindahkan kepemilikannya (lihat bagian *Keadaan produksi*).

## Pengecekan

- `lib/verification.check.ts` dirapikan mengikuti tipe baru dan tetap lulus
  `node`-polos — ini penjaga regresi yang sudah ada, bukan berkas baru.
- `lib/i18nHardcoded.check.ts` tetap lulus setelah kunci mitra dicabut.
- Uji manual berurutan: pengelola daftarkan kamera → tambahkan email user biasa →
  user itu buka halaman destinasi dan blok kamera muncul → hapus emailnya → blok
  kamera hilang → buka halaman destinasi tanpa login, blok kamera tidak ada
  sementara blok sensor tetap tampil.

## Di luar cakupan

**Server kamera VPS masih menyajikan `/stream/{cameraId}` tanpa autentikasi.**
Siapa pun yang pernah melihat id stream sebuah kamera tetap bisa menontonnya
langsung dari server, di luar website. Yang ditutup spec ini adalah jalur website:
id stream berhenti disebarkan lewat dokumen publik, sehingga tidak ada cara baru
mendapatkannya. Menutup jalur server butuh pemeriksaan token di repo Python
terpisah — pekerjaan tersendiri, dicatat di sini supaya batasnya jelas dan tidak
dikira sudah beres.

**Pemberian akses otomatis dari booking** sengaja tidak dibuat. Pengelola yang
menambahkan penonton satu per satu.
