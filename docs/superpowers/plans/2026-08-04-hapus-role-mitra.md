# Hapus Role Mitra & Allowlist Penonton Kamera — Rencana Implementasi

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengerjakan rencana ini tugas per tugas. Langkahnya memakai checkbox (`- [ ]`) untuk penanda.

**Spec:** `docs/superpowers/specs/2026-08-04-hapus-role-mitra-design.md`

**Goal:** Hapus role `mitra` sampai bersih dan ganti akses kamera publik dengan allowlist email yang dikelola pengelola.

**Architecture:** Role tinggal tiga (`admin`, `pengelola`, `user`). Kamera dimiliki pengelola; pemilik menulis `viewers: string[]` berisi email di dokumen kameranya. Firestore rules jadi satu-satunya gerbang: halaman destinasi berhenti memakai field kamera yang didenormalisasi ke dokumen publik dan membaca `cameras/{docId}` langsung — kalau rules menolak, blok kamera tidak dirender. Tidak ada pengecekan role di klien.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Firebase Web SDK v12, firebase-admin v14, Tailwind. Tanpa framework tes — logika murni dijaga berkas `lib/*.check.ts` yang dijalankan `node` polos.

## Global Constraints

- Role yang sah persis tiga: `'user' | 'pengelola' | 'admin'`. Tidak ada `'mitra'` yang tersisa di kode, tipe, rules, kamus, maupun rute.
- Email penonton **selalu** disimpan `trim().toLowerCase()`. Rules mencocokkan dengan `in` yang membandingkan string persis.
- `lib/*.check.ts` harus tetap bisa dijalankan `node lib/<nama>.check.ts` tanpa bundler. Berkas yang di-import olehnya (`lib/verification.ts`) tidak boleh meng-import apa pun.
- Tiap kunci di `lib/i18n.ts` wajib punya `id` **dan** `en`.
- `components/profile`, `components/cameras`, `components/destinations`, `components/chat` dipindai `lib/i18nHardcoded.check.ts` — semua teks di sana lewat `t()`. `components/dashboard` **di luar pindaian**: teks Indonesia langsung boleh di sana, dan itu memang pola panel dashboard yang sudah ada.
- Komentar dan prosa di kode berbahasa Indonesia, mengikuti gaya berkas sekitarnya.
- Jangan `git push`. Commit lokal saja.

## Peta Berkas

| Berkas | Tanggung jawab setelah perubahan |
| --- | --- |
| `lib/useAuth.ts` | tipe `UserRole` tiga nilai |
| `lib/verification.ts` | aturan form pengajuan pengelola (satu-satunya jenis pengajuan) |
| `lib/verification.check.ts` | penjaga regresi validasi pengajuan |
| `lib/firestore.ts` | tipe + operasi Firestore; **baru:** `normalizeViewerEmail`, `addCameraViewer`, `removeCameraViewer` |
| `lib/cameraViewers.check.ts` | **baru** — penjaga normalisasi email penonton |
| `lib/sendVerification.ts` | pemberitahuan persetujuan (role tunggal) |
| `lib/i18n.ts` | kamus tanpa kunci mitra |
| `firestore.rules` | gerbang akses kamera: pemilik / admin / penonton |
| `components/cameras/CameraSection.tsx` | rute dua keadaan: pengelola → `CameraManager`, selain itu kartu keterangan |
| `components/cameras/VerificationForm.tsx` | form pengajuan pengelola, tanpa percabangan role |
| `components/dashboard/CameraViewers.tsx` | **baru** — kelola daftar penonton satu kamera |
| `components/dashboard/KameraPanel.tsx` | daftar kamera (pemilik untuk pengelola, semua untuk admin) + sisip `CameraViewers` |
| `components/destinations/LiveMonitorPanel.tsx` | baca `cameras/{docId}`, render blok kamera hanya bila terbaca & `approved` |
| `components/dashboard/DestinasiPanel.tsx` | tautkan `cameraId` saja, berhenti mendenormalisasi |

---

## Task 1: Cabut `mitra` dari lapisan data & tipe

Tugas ini menyentuh `lib/` saja. Setelahnya `npm run build` **akan gagal** karena komponen masih menyebut `'mitra'` — itu disengaja dan diperbaiki di Task 2. Yang harus hijau di akhir tugas ini adalah `node lib/verification.check.ts`.

**Files:**
- Modify: `lib/useAuth.ts:9`
- Modify: `lib/verification.ts:18-32, 47-70, 136-142`
- Modify: `lib/firestore.ts:140-196, 258-293, 331-338, 384, 425-433`
- Modify: `lib/sendVerification.ts:17`
- Modify: `lib/verification.check.ts` (12 kasus bermitra)

**Interfaces:**
- Consumes: —
- Produces:
  - `type UserRole = 'user' | 'pengelola' | 'admin'` (`lib/useAuth.ts`)
  - `interface RoleVerification` menggantikan `MitraVerification` (`lib/firestore.ts`) — field sama persis kecuali `requestedRole` dihapus
  - `AppUser.role: "user" | "pengelola" | "admin"`
  - `submitRoleRequest(uid: string, data: {...}): Promise<void>` — kunci `requestedRole` hilang dari objek `data`
  - `approveRoleRequest(uid: string, verification?: Pick<RoleVerification, "destination" | "destinationLocation" | "destinationDescription">): Promise<void>` — parameter `role` hilang; fungsi selalu menaikkan ke `"pengelola"`
  - `notifyApproval(uid: string): Promise<void>` — parameter `role` hilang
  - `validateRoleRequest(input: RoleRequestInput): string | null` — `RoleRequestInput` tanpa `requestedRole`; cabang wajib-destinasi jadi tanpa syarat
  - `AGREEMENT` tinggal satu kunci: `AGREEMENT.pengelola`
  - `canManageCameras(role): boolean` — `role === "pengelola" || role === "admin"`
  - `requestedRole()` **dihapus**

- [ ] **Step 1: Sesuaikan `lib/verification.check.ts` lebih dulu (ini tes yang gagal)**

Berkas ini penjaga regresi yang sudah ada; menyesuaikannya duluan membuat langkah berikutnya punya tes merah yang jelas.

Buang setiap kasus yang memakai `requestedRole: 'mitra'` (ada 12), dan cabut kunci `requestedRole` dari objek yang tersisa. Ganti blok terakhir yang melooping dua role:

```ts
for (const role of ['mitra', 'pengelola'] as const) {
```

dengan pemeriksaan satu perjanjian:

```ts
// Perjanjian pengelola satu-satunya yang tersisa setelah role mitra dihapus.
assert.equal(AGREEMENT.pengelola.path, '/syarat-pengelola');
assert.ok(/^\d+\.\d+$/.test(AGREEMENT.pengelola.version));
assert.ok(AGREEMENT.pengelola.label.length > 0);
```

Sesuaikan juga kasus yang menguji pesan `mustAgreeMitra` — sekarang form tanpa centang selalu mengembalikan `"verifyForm.mustAgreePengelola"`:

```ts
assert.equal(
  validateRoleRequest({ ...lengkap, ...alamat, agreed: false }),
  'verifyForm.mustAgreePengelola',
  'form tanpa centang perjanjian harus ditolak'
);
```

- [ ] **Step 2: Jalankan cek untuk memastikan gagal**

```bash
node lib/verification.check.ts
```

Diharapkan: GAGAL. Pesannya menyebut `requestedRole` atau `AGREEMENT.mitra` — `lib/verification.ts` belum diubah, jadi tipenya belum cocok.

- [ ] **Step 3: Rampingkan `lib/verification.ts`**

Hapus kunci `mitra` dari `AGREEMENT` sehingga tersisa:

```ts
export const AGREEMENT = {
  pengelola: {
    // 1.2: destinasi tidak lagi ditetapkan admin dari daftar yang sudah ada —
    // pengaju menuliskan sendiri destinasinya dan dokumennya dibuat otomatis
    // saat pengajuan disetujui. Pasal 1 dan 3 ikut berubah, jadi versinya naik.
    version: "1.2",
    path: "/syarat-pengelola",
    label: "Perjanjian Pengelola",
  },
} as const;
```

Cabut `requestedRole` dari `RoleRequestInput`, dan perbarui komentar `shippingAddress` yang menyebut mitra:

```ts
export interface RoleRequestInput {
  fullName: string;
  phone: string;
  organization: string;
  /** Nama destinasi yang diketik pengaju. Dokumennya dibuat otomatis saat
   *  pengajuan disetujui — pengaju tidak memilih dari daftar yang sudah ada. */
  destination?: string;
  destinationLocation?: string;
  destinationDescription?: string;
  /** Salah satu LAND_RIGHTS. */
  landRights?: string;
  /** Centang pernyataan berhak mengelola lokasi yang diajukan. */
  declaredRights?: boolean;
  /** Alamat kirim paket sensor. */
  shippingAddress?: string;
  postalCode?: string;
  /** Penerima paket bila bukan pendaftar sendiri; kosong = pakai pendaftar. */
  recipientName?: string;
  recipientPhone?: string;
  /** Centang Perjanjian Pengelola. */
  agreed?: boolean;
}
```

Di `validateRoleRequest`, buang ketiga penjaga `input.requestedRole === "pengelola"` — sekarang semua pengajuan adalah pengajuan pengelola:

```ts
export function validateRoleRequest(input: RoleRequestInput): string | null {
  if (
    !input.fullName.trim() ||
    !input.phone.trim() ||
    !input.organization.trim()
  ) {
    return "verifyForm.allFieldsRequired";
  }
  // Destinasi selalu ditulis sendiri: dokumennya dibuat saat disetujui, jadi
  // keempat kolom ini wajib — tanpa salah satunya dokumen tidak bisa dibuat.
  if (!input.destination?.trim()) {
    return "verifyForm.newDestNameRequired";
  }
  if (!input.destinationLocation?.trim()) {
    return "verifyForm.newDestLocationRequired";
  }
  if (!input.destinationDescription?.trim()) {
    return "verifyForm.newDestDescRequired";
  }
  if (!input.landRights) {
    return "verifyForm.landRightsRequired";
  }
  if (!input.shippingAddress?.trim()) {
    return "verifyForm.shippingRequired";
  }
  // Ekspedisi menolak kode pos yang tidak lima angka; ditahan di sini supaya
  // paketnya tidak gagal kirim setelah pengajuan disetujui.
  if (!/^\d{5}$/.test(input.postalCode?.trim() ?? "")) {
    return "verifyForm.postalCodeInvalid";
  }
  // Pernyataan hak diperiksa sebelum persetujuan perjanjian: yang satu soal
  // fakta pengaju, yang lain soal isi dokumen — jangan digabung jadi satu.
  if (!input.declaredRights) {
    return "verifyForm.declareRightsRequired";
  }
  if (!input.agreed) {
    return "verifyForm.mustAgreePengelola";
  }
  return null;
}
```

- [ ] **Step 4: Jalankan cek untuk memastikan lulus**

```bash
node lib/verification.check.ts
```

Diharapkan: LULUS, tanpa keluaran error.

- [ ] **Step 5: Persempit `UserRole`**

`lib/useAuth.ts:9`:

```ts
export type UserRole = 'user' | 'pengelola' | 'admin';
```

- [ ] **Step 6: Bersihkan `lib/firestore.ts`**

Ganti nama tipe `MitraVerification` → `RoleVerification` dan cabut `requestedRole` beserta fungsi pembacanya. Blok `lib/firestore.ts:140-196` jadi:

```ts
// ── Users ──

export interface RoleVerification {
  fullName: string; // nama lengkap penanggung jawab
  phone: string; // no. HP/WhatsApp aktif
  organization: string; // instansi/organisasi (operator dive, resort, ...)
  status: "pending" | "approved" | "rejected";
  /** Nama destinasi yang diketik pengaju. Dokumennya dibuat otomatis oleh
   *  approveRoleRequest saat admin menyetujui — admin tidak membuatnya manual. */
  destination?: string;
  /** Legacy: penanda "usulan destinasi baru" dari saat destinasi masih dipilih
   *  lewat dropdown. Tidak ditulis lagi — sekarang semua pengajuan begitu. */
  newDestination?: boolean;
  destinationLocation?: string;
  destinationDescription?: string;
  /** Dasar hak mengelola lokasi yang dinyatakan pengaju (lihat LAND_RIGHTS). */
  landRights?: string;
  /** Pengaju mencentang pernyataan berhak mengelola lokasi. Waktunya mengikuti
   *  agreedAt — keduanya dicentang di form yang sama. */
  declaredRights?: boolean;
  /** Alamat kirim paket sensor + kode pos. */
  shippingAddress?: string;
  postalCode?: string;
  /** Penerima paket bila bukan pendaftar. Kosong = pendaftar sendiri; pakai
   *  packageRecipient() dari lib/verification, jangan baca langsung. */
  recipientName?: string;
  recipientPhone?: string;
  /** Versi Perjanjian Pengelola yang disetujui. Kosong pada pengajuan sebelum
   *  v1.0 terbit. */
  agreementVersion?: string;
  /** Waktu checkbox persetujuan dicentang. unknown mengikuti submittedAt. */
  agreedAt?: unknown;
  submittedAt: unknown;
  reviewedAt?: unknown;
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  /** No. HP/WhatsApp kontak — diisi sendiri di Pengaturan Akun. */
  phone?: string;
  role: "user" | "pengelola" | "admin";
  /** Id destinasi tersimpan (wishlist) — di-toggle dari tombol hati di kartu destinasi. */
  saved?: string[];
  /** Pengajuan jadi pengelola; tidak ada berarti belum pernah mengajukan. */
  verification?: RoleVerification;
}
```

`submitRoleRequest` (`lib/firestore.ts:258-293`) — cabut `requestedRole` dari objek `data` dan perbarui komentar judulnya:

```ts
/**
 * Kirim pengajuan jadi pengelola dari Pengaturan. Satu pengajuan aktif per
 * user — pengajuan baru menimpa yang lama.
 */
export async function submitRoleRequest(
  uid: string,
  data: {
    fullName: string;
    phone: string;
    organization: string;
    destination?: string;
    newDestination?: boolean;
    destinationLocation?: string;
    destinationDescription?: string;
    landRights?: string;
    declaredRights?: boolean;
    shippingAddress?: string;
    postalCode?: string;
    recipientName?: string;
    recipientPhone?: string;
    agreementVersion?: string;
  }
) {
```

Badan fungsinya tidak berubah.

`approveRoleRequest` (`lib/firestore.ts:331-374`) — parameter `role` dihapus, `"pengelola"` ditulis langsung:

```ts
export async function approveRoleRequest(
  uid: string,
  verification?: Pick<
    RoleVerification,
    "destination" | "destinationLocation" | "destinationDescription"
  >
) {
  if (!db) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), {
    role: "pengelola",
    "verification.status": "approved",
    "verification.reviewedAt": serverTimestamp(),
  });

  const name = verification?.destination?.trim();
  if (name) {
```

Sisa badan fungsinya (blok `getDocs` sampai `batch.commit()`) tidak berubah — hanya syarat `role === "pengelola" &&` yang hilang dari `if`.

Hapus seluruh fungsi `requestedRole()` (`lib/firestore.ts:179-182`).

`canManageCameras` (`lib/firestore.ts:425-433`):

```ts
/** Pengelola & admin boleh mengelola kamera. */
export function canManageCameras(role: string | null | undefined): boolean {
  return role === "pengelola" || role === "admin";
}
```

Perbarui juga komentar bagian di baris 384:

```ts
// ── Cameras (kamera pengelola — terpisah dari monitoring IoT) ──
```

Komentar `Destination.cameraId` (baris 65) juga menyebut mitra, tapi **jangan disentuh di sini** — Task 5 menulis ulang seluruh komentar itu. Menyuntingnya sekarang cuma bikin konflik.

- [ ] **Step 7: Sederhanakan `lib/sendVerification.ts`**

```ts
/**
 * Beri tahu user lewat email bahwa pengajuan pengelolanya disetujui. Dipanggil
 * admin dari dashboard; ID token admin ikut dikirim untuk dicek di server.
 */
export async function notifyApproval(uid: string) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('not-signed-in');
  const res = await fetch('/api/notify-approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uid }),
  });
  if (!res.ok) throw new Error('notify-send-failed');
}
```

- [ ] **Step 8: Jalankan ulang cek yang tidak bergantung komponen**

```bash
node lib/verification.check.ts && node lib/format.check.ts && node lib/loginCode.check.ts
```

Diharapkan: ketiganya LULUS.

- [ ] **Step 9: Commit**

```bash
git add lib/useAuth.ts lib/verification.ts lib/verification.check.ts lib/firestore.ts lib/sendVerification.ts
git commit -m "refactor: cabut role mitra dari lapisan data & tipe"
```

---

## Task 2: Cabut `mitra` dari komponen, rute, dan kamus

Menutup kerusakan build yang ditinggalkan Task 1. Di akhir tugas ini `npm run build` harus hijau dan tidak ada lagi kata `mitra` di `app/`, `components/`, `lib/`.

**Files:**
- Delete: `app/syarat-mitra/page.tsx` (beserta foldernya)
- Modify: `app/api/notify-approval/route.ts:7-22, 24-28, 45-60`
- Modify: `components/cameras/VerificationForm.tsx:4-27, 52-96, 267-315`
- Modify: `components/cameras/CameraSection.tsx` (tulis ulang)
- Modify: `components/profile/PengelolaRequest.tsx:8, 13-17, 26, 36, 45-79, 120, 141-147`
- Modify: `components/profile/RoleBadge.tsx:22-26`
- Modify: `components/profile/ProfileView.tsx:447-449`
- Modify: `components/dashboard/PenggunaPanel.tsx:4-22, 61-83, 153-158`
- Modify: `lib/i18n.ts` (7 kunci)

**Interfaces:**
- Consumes: semua yang diproduksi Task 1 — terutama `RoleVerification`, `approveRoleRequest(uid, verification?)`, `notifyApproval(uid)`, `AGREEMENT.pengelola`, `canManageCameras`
- Produces: `VerificationForm` dengan props `{ uid: string; initial?: RoleVerification; title?: string; description?: string }` — prop `requestedRole` hilang

- [ ] **Step 1: Hapus halaman perjanjian mitra**

```bash
rm -rf app/syarat-mitra
```

- [ ] **Step 2: Sederhanakan `app/api/notify-approval/route.ts`**

`COPY` tinggal satu bentuk, jadi objek berkuncinya tidak perlu lagi:

```ts
const COPY = {
  subject: 'Pengajuan pengelola disetujui — Nusa',
  title: 'Akun kamu sekarang Pengelola',
  body: 'Pengajuan jadi pengelola sudah disetujui admin. Menu Dashboard sekarang terbuka untuk mengelola destinasi, booking, dan kamera di wilayahmu.',
  cta: 'Buka Dashboard',
  path: '/dashboard',
} as const;

/**
 * Email pemberitahuan saat admin menyetujui pengajuan pengelola.
 * Hanya admin yang boleh memanggil: wajib kirim Firebase ID token di header
 * Authorization, dan role pemanggil dicek ke Firestore lewat Admin SDK.
 */
```

Validasi badan permintaan tinggal `uid` (baris 45-54):

```ts
  let uid: unknown;
  try {
    ({ uid } = await req.json());
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (typeof uid !== 'string') {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
```

dan baris 60 jadi:

```ts
  const c = COPY;
```

- [ ] **Step 3: Cabut percabangan role dari `VerificationForm.tsx`**

Props dan pembuka komponen (baris 4-27):

```tsx
import { submitRoleRequest, type RoleVerification } from '@/lib/firestore';
import { AGREEMENT, LAND_RIGHTS, validateRoleRequest } from '@/lib/verification';
import { useLang } from '@/lib/useLang';

interface Props {
  uid: string;
  /** Data pengajuan sebelumnya (prefill saat ajukan ulang setelah ditolak). */
  initial?: RoleVerification;
  title?: string;
  description?: string;
}

export default function VerificationForm({ uid, initial, title, description }: Props) {
  const { t } = useLang();
  const agreement = AGREEMENT.pengelola;
```

Di `handleSubmit`, buang `requestedRole` dari panggilan `validateRoleRequest` (baris 58) dan dari `submitRoleRequest` (baris 79), lalu ratakan sebaran `...(isPengelola && { ... })` jadi kolom biasa:

```tsx
      await submitRoleRequest(uid, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        organization: organization.trim(),
        // agreedAt tidak dikirim dari sini — submitRoleRequest yang
        // menstempelnya dengan serverTimestamp() begitu agreementVersion ada.
        agreementVersion: agreement.version,
        destination: destination.trim(),
        destinationLocation: destinationLocation.trim(),
        destinationDescription: destinationDescription.trim(),
        landRights,
        // Disimpan, bukan cuma divalidasi: Pasal 2 ayat 4 memakai pernyataan
        // ini sebagai dasar pencabutan, jadi harus ada jejaknya.
        declaredRights: true,
        shippingAddress: shippingAddress.trim(),
        postalCode: postalCode.trim(),
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
      });
```

Komentar di bawah blok itu menyebut `CameraSection`; ganti jadi:

```tsx
      // Tidak reset/pindah view di sini: PengelolaRequest berpindah ke kartu
      // status pending begitu onSnapshot dokumen user menerima perubahan.
```

Buang keempat pembungkus `{isPengelola && (` di baris 148, 207, 267 (blok destinasi, blok pengiriman, checkbox pernyataan hak) sehingga isinya jadi tanpa syarat — hapus baris pembuka `{isPengelola && (` dan penutup `)}` yang berpasangan, sesuaikan indentasinya.

Ekor label perjanjian (baris 298) dan tombol kirim (baris 310-314):

```tsx
            {t('verifyForm.agreeTailPengelola')}
```

```tsx
          {submitting ? t('verifyForm.submitting') : t('verifyForm.submitPengelola')}
```

- [ ] **Step 4: Tulis ulang `components/cameras/CameraSection.tsx`**

Tiga dari empat keadaan hilang bersama pengajuan mitra, dan langganan `onSnapshot` ke `users/{uid}` tidak lagi dibaca siapa pun di sini. Ganti seluruh isi berkas:

```tsx
'use client';

import type { User } from 'firebase/auth';
import type { UserRole } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';
import { canManageCameras } from '@/lib/firestore';
import CameraManager from './CameraManager';

interface Props {
  user: User;
  role: UserRole | null;
}

/**
 * View Kamera di halaman /kamera. Pengelola & admin mendaftarkan dan memantau
 * kameranya di sini. Pengguna biasa tidak punya kamera sendiri — kamera yang
 * boleh ditontonnya muncul di halaman destinasi begitu pengelola menambahkan
 * emailnya, jadi di sini cukup keterangan ke mana harus melihat.
 */
export default function CameraSection({ user, role }: Props) {
  const { t } = useLang();
  const manager = canManageCameras(role);

  return (
    <>
      <h1 className="font-serif text-2xl font-medium text-navy sm:text-3xl">{t('camera.title')}</h1>
      <p className="mt-2 text-sm text-navy-soft">
        {manager ? t('camera.lede') : t('camera.ledeViewer')}
      </p>

      <div className="mt-6">
        {manager ? (
          <CameraManager user={user} />
        ) : (
          <div className="card p-6">
            <p className="text-sm text-navy-soft leading-relaxed">{t('camera.viewerNote')}</p>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Cabut cabang mitra dari `PengelolaRequest.tsx`**

Import (baris 8) dan tipe state (baris 26, 36):

```tsx
import { type RoleVerification } from '@/lib/firestore';
```

```tsx
  const [verification, setVerification] = useState<RoleVerification | null>(null);
```

```tsx
      setVerification((snap.data()?.verification as RoleVerification | undefined) ?? null);
```

Komentar judul komponen (baris 13-17):

```tsx
/**
 * Pengajuan jadi pengelola dari Pengaturan. Tersimpan di
 * users/{uid}.verification; admin menyetujui dari dashboard Pengguna.
 */
```

Hapus baris 46 (`const forPengelola = ...`) dan seluruh blok `if (pending && !forPengelola)` (baris 67-79). Lalu longgarkan dua syarat sisanya:

```tsx
  if (pending) {
```

```tsx
  if (verification?.status === 'rejected' && !resubmitting) {
```

Terakhir, buang prop `requestedRole` dari pemanggilan form (baris 144).

- [ ] **Step 6: Cabut entri mitra dari `RoleBadge.tsx` dan komentar `ProfileView.tsx`**

`RoleBadge.tsx` — hapus blok `mitra` (baris 22-26) sehingga `roleInfo` tinggal `admin` dan `pengelola`.

`ProfileView.tsx:447-449`:

```tsx
        {/* Peran akun — hanya untuk pengelola ke atas; pengguna biasa tidak
            punya apa pun untuk ditampilkan di sini. */}
```

- [ ] **Step 7: Cabut mitra dari `PenggunaPanel.tsx`**

Import (baris 4-12) — buang `requestedRole`:

```tsx
import {
  approveRoleRequest,
  deleteUserAccount,
  rejectRoleRequest,
  subscribeUsers,
  updateUserRole,
  type AppUser,
} from '@/lib/firestore';
```

Warna badge (baris 17-22) — buang baris `mitra`:

```tsx
const roleColors: Record<AppUser['role'], string> = {
  user: 'bg-shore-100 text-navy-soft',
  pengelola: 'bg-warn-soft text-warn',
  admin: 'bg-teal-100 text-teal-700',
};
```

`handleReview` (baris 61-83) — tidak ada lagi role yang perlu ditentukan:

```tsx
  const handleReview = async (u: AppUser, approve: boolean) => {
    setReviewingUid(u.uid);
    setMailWarn(null);
    try {
      if (!approve) {
        await rejectRoleRequest(u.uid);
        return;
      }
      // Data destinasi ikut dikirim: approveRoleRequest yang membuat dokumennya
      // dan menautkan managerUid, jadi admin tidak perlu bikin manual dulu.
      await approveRoleRequest(u.uid, u.verification);
      // Persetujuan sudah tersimpan; email cuma pemberitahuan — gagal kirim
      // tidak membatalkan apa pun, cukup diberitahukan ke admin.
      try {
        await notifyApproval(u.uid);
      } catch {
        setMailWarn(`Role pengelola untuk ${u.name || u.email} sudah aktif, tapi email pemberitahuan gagal terkirim.`);
      }
    } finally {
      setReviewingUid(null);
    }
  };
```

Hapus `<option value="mitra">Mitra</option>` (baris 133).

Komentar dan label pengajuan (baris 153-158):

```tsx
            {/* Pengajuan jadi pengelola, dikirim dari Pengaturan Akun */}
            {u.verification?.status === 'pending' && (
              <div className="mt-4 rounded-md border border-warn-rule bg-warn-soft/60 p-4">
                <span className="inline-flex rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn">
                  Pengajuan Pengelola
                </span>
```

- [ ] **Step 8: Perbarui kamus `lib/i18n.ts`**

Hapus empat kunci ini seluruhnya: `verifyForm.agreeTailMitra`, `verifyForm.submitMitra`, `verifyForm.mustAgreeMitra`, `manager.mitraPendingNote`, `role.mitraDesc`.

Ganti judul dan keterangan form (baris 393-398) — sekarang form ini cuma dipakai pengajuan pengelola, dan komentar bagiannya ikut disesuaikan:

```ts
  // ── Form pengajuan pengelola ──
  "verifyForm.title": { id: "Ajukan Jadi Pengelola", en: "Apply to Be a Manager" },
  "verifyForm.desc": {
    id: "Lengkapi data di bawah. Setelah disetujui admin, role akunmu naik menjadi pengelola dan destinasi yang kamu usulkan dibuat otomatis.",
    en: "Fill in the details below. Once an admin approves, your account becomes a manager and the destination you propose is created automatically.",
  },
```

Perbarui komentar bagian di baris 623:

```ts
  // ── Jadi pengelola ──
```

Tambahkan dua kunci baru yang dipakai `CameraSection` (letakkan bersebelahan dengan `camera.lede` yang sudah ada):

```ts
  "camera.ledeViewer": {
    id: "Kamera yang boleh kamu tonton muncul di halaman destinasinya.",
    en: "Cameras you're allowed to watch appear on their destination page.",
  },
  "camera.viewerNote": {
    id: "Kamera dipasang dan dikelola pengelola destinasi. Setelah kamu membeli paket dan pengelola menambahkan emailmu, siaran langsungnya muncul di halaman destinasi tersebut.",
    en: "Cameras are installed and managed by the destination's manager. Once you buy a package and the manager adds your email, the live feed appears on that destination's page.",
  },
```

Hapus kunci lama yang tidak punya pemakai lagi setelah `CameraSection` ditulis ulang dan blok "mitra pending" di `PengelolaRequest` dicabut: `camera.ledeUnverified`, `camera.pendingNote`, `camera.rejectedNote`, `manager.requestOngoing`.

Sebelum menghapus, buktikan tidak ada pemakai tersisa:

```bash
grep -rn "camera.ledeUnverified\|camera.pendingNote\|camera.rejectedNote\|manager.requestOngoing" --include="*.tsx" --include="*.ts" app/ components/ lib/ | grep -v "lib/i18n.ts"
```

Diharapkan: tidak ada keluaran.

- [ ] **Step 9: Pastikan tidak ada `mitra` yang tersisa**

```bash
grep -rn "mitra\|Mitra" --include="*.ts" --include="*.tsx" app/ components/ lib/
```

Diharapkan: hanya satu baris tersisa, komentar di `lib/i18n.ts:8` yang memakai kata "mitra lokal" dalam arti sehari-hari (rekanan setempat), bukan nama role. Biarkan.

- [ ] **Step 10: Jalankan semua cek dan build**

```bash
node lib/i18n.check.ts && node lib/i18nHardcoded.check.ts && node lib/verification.check.ts && node lib/destinationKeys.check.ts && npm run build
```

Diharapkan: semua LULUS, build sukses tanpa error TypeScript.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: cabut role mitra dari komponen, rute, dan kamus"
```

---

## Task 3: Allowlist penonton — data layer & rules

Gerbang aksesnya. Tugas ini dibuka dengan pembuktian asumsi yang seluruh desain bergantung padanya: klaim `email` benar-benar ada di ID token.

**Files:**
- Create: `lib/cameraViewers.check.ts`
- Modify: `lib/firestore.ts` (tipe `Camera` + tiga fungsi baru)
- Modify: `firestore.rules:82-108, 125-136`

**Interfaces:**
- Consumes: `Camera`, `db` (`lib/firestore.ts`)
- Produces:
  - `normalizeViewerEmail(email: string): string`
  - `addCameraViewer(cameraDocId: string, email: string): Promise<void>`
  - `removeCameraViewer(cameraDocId: string, email: string): Promise<void>`
  - `Camera.viewers?: string[]`

- [ ] **Step 1: Buktikan klaim `email` ada di ID token — GERBANG**

Jalankan `npm run dev`, masuk lewat login kode email, lalu di konsol browser:

```js
(await firebase.auth().currentUser.getIdTokenResult()).claims.email
```

Kalau `firebase` tidak terekspos global, tambahkan sementara `window.__auth = auth;` di `lib/firebase.ts`, muat ulang, lalu:

```js
(await window.__auth.currentUser.getIdTokenResult()).claims
```

Diharapkan: objek klaim memuat `email` berisi alamat yang dipakai masuk, dan nilainya huruf kecil.

**Kalau `email` tidak ada:** BERHENTI. Seluruh desain allowlist bertumpu padanya. Laporkan ke pemilik proyek — jalan gantinya allowlist berbasis uid + route Admin SDK yang menerjemahkan email → uid, dan itu perubahan spec, bukan perubahan rencana. Jangan lanjut ke Step 2.

Buang `window.__auth` kalau tadi ditambahkan.

- [ ] **Step 2: Tulis cek yang gagal untuk normalisasi email**

Buat `lib/cameraViewers.check.ts`:

```ts
/**
 * Cek normalisasi email penonton kamera.
 *
 * Kenapa ini dijaga: rules mencocokkan `request.auth.token.email` dengan daftar
 * `viewers` memakai operator `in`, yang membandingkan string persis. ID token
 * selalu memuat email huruf kecil (route verify-code memasukkannya sudah
 * dinormalkan), sedangkan pengelola mengetik bebas. Kalau "Orang@Mail.com"
 * tersimpan apa adanya, orangnya tidak akan pernah bisa menonton — dan gagalnya
 * muncul sebagai "akses ditolak", bukan sebagai kesalahan input. Nyaris mustahil
 * dilacak dari gejalanya.
 *
 * Jalankan: node lib/cameraViewers.check.ts
 */
import assert from 'node:assert/strict';
import { normalizeViewerEmail } from './firestore.ts';

assert.equal(
  normalizeViewerEmail('Orang@Mail.com'),
  'orang@mail.com',
  'huruf besar harus diturunkan'
);

assert.equal(
  normalizeViewerEmail('  orang@mail.com  '),
  'orang@mail.com',
  'spasi tepi hasil salin-tempel harus dibuang'
);

assert.equal(
  normalizeViewerEmail(' ORANG@MAIL.COM '),
  'orang@mail.com',
  'spasi dan huruf besar sekaligus'
);

assert.equal(
  normalizeViewerEmail('orang@mail.com'),
  'orang@mail.com',
  'yang sudah normal tidak berubah'
);

console.log('cameraViewers.check.ts lulus');
```

- [ ] **Step 3: Jalankan cek untuk memastikan gagal**

```bash
node lib/cameraViewers.check.ts
```

Diharapkan: GAGAL dengan `SyntaxError` atau `is not a function` — `normalizeViewerEmail` belum ada.

`lib/firestore.ts` meng-import `firebase/firestore`, jadi Node harus bisa menyelesaikannya dari `node_modules`. Jalankan dari akar proyek. Kalau resolusinya bermasalah, jalankan `node --experimental-strip-types lib/cameraViewers.check.ts`.

- [ ] **Step 4: Tambahkan operasi penonton ke `lib/firestore.ts`**

Tambahkan `viewers` ke interface `Camera` (setelah field `status`):

```ts
  /** Email yang boleh menonton kamera ini, selalu huruf kecil tanpa spasi tepi.
   *  Ditulis pemilik lewat panel Kamera di dashboard; dicocokkan rules dengan
   *  `request.auth.token.email`. Kosong/absen = hanya pemilik & admin. */
  viewers?: string[];
```

Lalu di bawah `canManageCameras`, tambahkan:

```ts
/**
 * Bentuk simpan email penonton: sama persis dengan klaim `email` di ID token
 * (huruf kecil, tanpa spasi tepi). Rules mencocokkannya dengan operator `in`
 * yang membandingkan string persis — tanpa ini, email berhuruf besar tersimpan
 * apa adanya dan aksesnya ditolak diam-diam.
 */
export function normalizeViewerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Beri satu email hak menonton kamera. arrayUnion, jadi menambah email yang
 *  sudah ada tidak menduplikasinya. */
export async function addCameraViewer(cameraDocId: string, email: string) {
  if (!db) return;
  await updateDoc(doc(db, "cameras", cameraDocId), {
    viewers: arrayUnion(normalizeViewerEmail(email)),
  });
}

/** Cabut hak menonton satu email. */
export async function removeCameraViewer(cameraDocId: string, email: string) {
  if (!db) return;
  await updateDoc(doc(db, "cameras", cameraDocId), {
    viewers: arrayRemove(normalizeViewerEmail(email)),
  });
}
```

`arrayUnion`, `arrayRemove`, `doc`, dan `updateDoc` semuanya sudah ada di blok import berkas ini — jangan tambah import baru.

- [ ] **Step 5: Jalankan cek untuk memastikan lulus**

```bash
node lib/cameraViewers.check.ts
```

Diharapkan: `cameraViewers.check.ts lulus`.

- [ ] **Step 6: Perbarui `firestore.rules`**

Ganti seluruh blok `match /cameras/{cameraId}` (baris 82-108):

```js
    match /cameras/{cameraId} {
      function camUserRole() {
        return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
      }
      // Baca: pemilik, admin, atau email yang dimasukkan pemilik ke `viewers`.
      //
      // Cabang "pengelola untuk kamera di wilayahnya" sengaja tidak ada.
      // Bukan cuma karena pengelola sekarang memiliki kameranya sendiri: cabang
      // itu bergantung pada isi dokumen (`resource.data.location`), dan rules
      // bukan filter — query koleksi tanpa constraint tidak bisa dipenuhi
      // olehnya, sehingga panel Kamera pengelola ditolak seluruhnya. Klien
      // memakai query `where('ownerUid','==',uid)` yang membuktikan cabang
      // pertama di muka.
      //
      // get('viewers', []) dipakai, bukan resource.data.viewers: dokumen kamera
      // lama tidak punya field itu dan akses langsung jadi error, bukan false.
      allow read: if request.auth != null
        && (
          resource.data.ownerUid == request.auth.uid
          || camUserRole() == 'admin'
          || request.auth.token.email in resource.data.get('viewers', [])
        );
      // Hanya pengelola/admin boleh mendaftarkan kamera miliknya sendiri, dan
      // wajib berstatus 'pending' — validasi approve/reject hanya dari server
      // VPS (Admin SDK, bypass rules). User tidak bisa menyetujui kameranya sendiri.
      allow create: if request.auth != null
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.status == 'pending'
        && camUserRole() in ['pengelola', 'admin'];
      allow delete: if request.auth != null
        && (resource.data.ownerUid == request.auth.uid || camUserRole() == 'admin');
      // Pemilik mengelola daftar penontonnya, dan HANYA itu. hasOnly() wajib:
      // tanpanya pemilik bisa menyetujui kameranya sendiri lewat jalur ini,
      // padahal approve/reject eksklusif milik server VPS.
      allow update: if request.auth != null
        && resource.data.ownerUid == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewers']);
    }
```

Lalu di blok `settings` (baris 133-135), buang `'mitra'`:

```js
      // Hanya pengelola kamera yang boleh mengubah alamat server.
      allow write: if request.auth != null
        && settingsUserRole() in ['pengelola', 'admin'];
```

- [ ] **Step 7: Validasi sintaks rules**

```bash
npx firebase deploy --only firestore:rules --dry-run
```

Diharapkan: laporan kompilasi tanpa error. Kalau `--dry-run` tidak didukung versi CLI-nya, jalankan `npx firebase firestore:rules:release --help` untuk memastikan CLI hidup, lalu langsung ke Step 8 — deploy sendiri menolak rules yang tidak kompilasi.

- [ ] **Step 8: Pastikan penjaga kopling destinasi masih hijau**

```bash
node lib/destinationKeys.check.ts
```

Diharapkan: LULUS. Cek ini membaca `firestore.rules` sebagai teks; daftar `hasOnly` di blok `destinations` tidak kita sentuh, jadi harus tetap cocok dengan `EDITABLE_KEYS`.

- [ ] **Step 9: Deploy rules**

```bash
npx firebase deploy --only firestore:rules
```

Diharapkan: `Deploy complete!`.

Setelah ini panel Kamera pengelola akan **kosong** sampai Task 4 mengganti query-nya — itu bukan regresi, panelnya memang sudah tidak pernah termuat untuk pengelola sebelumnya.

- [ ] **Step 10: Commit**

```bash
git add lib/firestore.ts lib/cameraViewers.check.ts firestore.rules
git commit -m "feat: allowlist penonton kamera berbasis email + rules"
```

---

## Task 4: UI kelola penonton di dashboard Kamera

**Files:**
- Create: `components/dashboard/CameraViewers.tsx`
- Modify: `components/dashboard/KameraPanel.tsx` (tulis ulang sumber data + sisip komponen baru)

**Interfaces:**
- Consumes: `addCameraViewer`, `removeCameraViewer`, `subscribeMyCameras`, `subscribeAllCameras`, `cameraStatus`, `type Camera` (`lib/firestore.ts`)
- Produces: `CameraViewers` dengan props `{ camera: Camera; editable: boolean }`

Panel dashboard di luar pindaian `i18nHardcoded.check.ts`, jadi teks Indonesia ditulis langsung — sama seperti isi `KameraPanel` yang sudah ada. Jangan pakai `t()` di sini.

- [ ] **Step 1: Buat `components/dashboard/CameraViewers.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { addCameraViewer, removeCameraViewer, type Camera } from '@/lib/firestore';

/**
 * Daftar email yang boleh menonton satu kamera. Pengelola menambahkannya
 * setelah pembeli paket membayar — pemberian akses sengaja manual, bukan
 * otomatis dari booking, supaya pengelola yang memutuskan.
 *
 * `editable` false untuk admin: rule tulisnya bertumpu pada kepemilikan
 * (`ownerUid`), jadi tombolnya cuma akan menghasilkan permission-denied.
 */
export default function CameraViewers({
  camera,
  editable,
}: {
  camera: Camera;
  editable: boolean;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const viewers = camera.viewers ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    // Cukup cek ada "@" dan bukan di tepi: yang menentukan cocok atau tidak
    // adalah alamat email akun Firebase-nya, dan itu tidak bisa divalidasi
    // dari sini. Penyaring ini hanya menahan salah ketik yang kentara.
    if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await addCameraViewer(camera.id, email);
      setEmail('');
    } catch {
      setError('Gagal menambahkan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (target: string) => {
    setBusy(true);
    setError('');
    try {
      await removeCameraViewer(camera.id, target);
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-md border border-shore-200 bg-shore-50/60 p-4">
      <p className="text-2xs font-medium text-navy">Penonton kamera</p>
      <p className="text-2xs text-navy-soft mt-1 leading-relaxed">
        Email di daftar ini bisa melihat siaran langsung kamera di halaman
        destinasinya. Tambahkan setelah pembeli paket membayar.
      </p>

      {viewers.length === 0 ? (
        <p className="text-xs text-navy-soft mt-3">Belum ada penonton yang ditambahkan.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {viewers.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-2 rounded-sm border border-shore-200 bg-surface px-2.5 py-1 text-2xs text-navy"
            >
              {v}
              {editable && (
                <button
                  onClick={() => handleRemove(v)}
                  disabled={busy}
                  aria-label={`Hapus ${v}`}
                  className="text-navy-soft hover:text-danger transition-colors disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {editable && (
        <form onSubmit={handleAdd} className="mt-3 flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            placeholder="email@contoh.com"
            aria-label="Email penonton baru"
            className="flex-1 min-w-0 rounded-md border border-shore-200 bg-surface px-3 py-2 text-xs text-navy outline-none transition-colors focus:border-teal-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary shrink-0 px-4 py-2 text-xs disabled:opacity-50"
          >
            Tambah
          </button>
        </form>
      )}

      {error && <p className="text-2xs text-danger mt-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Tulis ulang `components/dashboard/KameraPanel.tsx`**

Kepemilikan kini jadi satu-satunya penentu kamera pengelola, jadi langganan `subscribeDestinations`, penyaring `managedLocations`, dan keadaan `noAssignment` semuanya ikut hilang.

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  cameraStatus,
  subscribeAllCameras,
  subscribeMyCameras,
  type Camera,
} from '@/lib/firestore';
import CameraLiveModal from '@/components/cameras/CameraLiveModal';
import ServerAddressCard from '@/components/cameras/ServerAddressCard';
import CameraViewers from './CameraViewers';

interface Props {
  role: string | null;
  uid: string;
}

/**
 * Panel Kamera dashboard. Admin melihat semua kamera; pengelola melihat kamera
 * miliknya lewat query berconstraint `ownerUid` — bukan seluruh koleksi lalu
 * disaring di klien. Rules bukan filter: query tanpa constraint hanya bisa
 * dipenuhi cabang admin, jadi versi lama panel ini selalu ditolak untuk
 * pengelola dan tidak pernah menampilkan apa pun.
 */
export default function KameraPanel({ role, uid }: Props) {
  const isPengelola = role === 'pengelola';

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveCamera, setLiveCamera] = useState<Camera | null>(null);

  useEffect(() => {
    const handle = (data: Camera[]) => {
      setCameras(data);
      setLoading(false);
    };
    const unsub = isPengelola ? subscribeMyCameras(uid, handle) : subscribeAllCameras(handle);
    return () => unsub();
  }, [isPengelola, uid]);

  return (
    <div className="animate-fade-in">
      {liveCamera && <CameraLiveModal camera={liveCamera} onClose={() => setLiveCamera(null)} />}

      <h1 className="font-serif text-2xl font-medium text-navy">Kamera</h1>
      <p className="mt-1 text-sm text-navy-soft">
        {isPengelola
          ? `${cameras.length} kamera milikmu`
          : `${cameras.length} kamera terdaftar`}
      </p>

      {/* Setelan server kamera hanya untuk admin (setelan global). */}
      {!isPengelola && (
        <div className="mt-6">
          <ServerAddressCard />
        </div>
      )}

      <div className={isPengelola ? 'mt-6 space-y-3' : 'mt-4 space-y-3'}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-shore-100" />
              <div className="h-3 w-1/2 rounded-full bg-shore-100" />
            </div>
          ))
        ) : cameras.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">
              {isPengelola
                ? 'Kamu belum mendaftarkan kamera. Daftarkan lewat menu Kamera di profil.'
                : 'Belum ada kamera terdaftar.'}
            </p>
          </div>
        ) : (
          cameras.map((c) => {
            const status = cameraStatus(c);
            return (
              <div key={c.id} className="card px-5 py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-navy truncate">{c.name}</p>
                      {status === 'pending' && (
                        <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-2xs font-medium text-warn shrink-0">Menunggu admin</span>
                      )}
                      {status === 'rejected' && (
                        <span className="rounded-sm bg-danger-soft px-2 py-0.5 text-2xs font-medium text-danger shrink-0">Ditolak</span>
                      )}
                    </div>
                    <p className="text-xs text-navy-soft truncate mt-0.5">
                      ID: {c.cameraId}
                      {c.location && ` — ${c.location}`}
                    </p>
                    <p className="text-xs text-navy-soft truncate mt-0.5">
                      Pemilik: {c.ownerName || 'Tanpa Nama'} ({c.ownerEmail})
                    </p>
                  </div>
                  {status === 'approved' ? (
                    <button
                      onClick={() => setLiveCamera(c)}
                      className="btn-primary px-4 py-2 text-xs shrink-0"
                    >
                      Lihat Live
                    </button>
                  ) : (
                    <span className="text-xs text-navy-soft shrink-0">Belum aktif</span>
                  )}
                </div>

                <CameraViewers camera={c} editable={c.ownerUid === uid} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Diharapkan: sukses tanpa error TypeScript.

- [ ] **Step 4: Uji manual sebagai pengelola**

`npm run dev`, masuk sebagai `anakgilegile@gmail.com` (role `pengelola`), buka `/dashboard` → menu Kamera.

Diharapkan:
1. Kamera "test" **muncul** — ini yang gagal sebelum perbaikan query.
2. Kartu penonton tampil di bawahnya dengan input email.
3. Tambahkan email berhuruf campur, misal `Amejingmeng@Gmail.com`. Chip yang muncul harus `amejingmeng@gmail.com` — huruf kecil semua. Kalau masih berhuruf besar, `normalizeViewerEmail` tidak terpanggil.
4. Konsol browser bersih dari permission-denied.
5. Klik × pada chip; chip-nya hilang.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/CameraViewers.tsx components/dashboard/KameraPanel.tsx
git commit -m "feat: kelola penonton kamera di dashboard pengelola"
```

---

## Task 5: Halaman destinasi baca `cameras/{docId}`

Yang membuat allowlist berarti. Sebelum tugas ini, id stream masih terbaca publik dari dokumen destinasi dan siapa pun bisa merakit URL siarannya.

**Files:**
- Modify: `lib/firestore.ts:66-74, 312-315`
- Modify: `components/destinations/LiveMonitorPanel.tsx:1-15, 43-80, 199-245`
- Modify: `app/destinations/[id]/page.tsx:362-370`
- Modify: `components/dashboard/DestinasiPanel.tsx:168-193`

**Interfaces:**
- Consumes: `cameraStatus`, `type Camera`, `db` (`lib/firestore.ts`)
- Produces: `LiveMonitorPanel` dengan props `{ cameraDocId?: string; sensorPath: string | null }`

- [ ] **Step 1: Cabut field denormalisasi dari tipe `Destination`**

`lib/firestore.ts` — hapus tiga baris di blok interface `Destination` (baris 72-74):

```ts
  cameraStreamId?: string; // = Camera.cameraId (id stream di server kamera)
  cameraName?: string;
  cameraStreamUrl?: string; // legacy: kamera lama dengan URL stream langsung
```

dan tiga baris padanannya di `AUTO_DEST_DEFAULTS` (baris 313-315):

```ts
  cameraStreamId: "",
  cameraName: "",
  cameraStreamUrl: "",
```

Perbarui komentar `cameraId` yang tersisa supaya alasannya terbaca:

```ts
  /** Tautan ke kamera pengelola — id dokumen koleksi 'cameras', bukan id
   *  stream. Aman ada di dokumen publik: tidak bisa dipakai menyusun URL
   *  siaran, dan dokumen kameranya sendiri dijaga rules. */
  cameraId?: string;
```

- [ ] **Step 2: Ubah `LiveMonitorPanel` jadi pembaca dokumen kamera**

Import dan props (baris 1-15):

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cameraStatus, subscribeCameraServerUrl, type Camera } from '@/lib/firestore';
import { subscribeMonitoring, type SensorReading } from '@/lib/realtime';
import { useLang } from '@/lib/useLang';

interface Props {
  /** Id dokumen kamera yang ditautkan ke destinasi ini. */
  cameraDocId?: string;
  /** Path RTDB paket sensor destinasi ini (dari stationPath); null = tanpa sensor. */
  sensorPath: string | null;
}
```

Komentar judul komponen (baris 37-42):

```tsx
/**
 * Panel "Pantau Langsung" gabungan: stream kamera + sensor IoT dalam satu card.
 *
 * Kameranya dibaca langsung dari dokumen `cameras/{docId}`, bukan dari field
 * yang didenormalisasi ke dokumen destinasi. Itu disengaja: dokumen destinasi
 * dibaca publik, jadi id stream yang menempel di sana bisa dipakai siapa pun
 * merakit URL siaran sendiri. Sekarang rules yang jadi satu-satunya gerbang —
 * pembaca tanpa hak kena permission-denied dan blok kameranya tidak dirender.
 * Tidak ada pengecekan role di komponen ini.
 *
 * Sensor dibaca dari cabang RTDB milik paket sensor destinasi ini (sensorPath).
 */
```

Pembuka fungsi dan blok kamera (baris 43-80):

```tsx
export default function LiveMonitorPanel({ cameraDocId, sensorPath }: Props) {
  const { t } = useLang();
  const hasMonitoring = !!sensorPath;

  // ── Kamera ──
  const [cam, setCam] = useState<Camera | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null); // null = loading
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false); // frame pertama sudah masuk

  useEffect(() => {
    if (!cameraDocId || !db) {
      setCam(null);
      return;
    }
    // Callback error wajib: pengunjung tanpa hak MEMANG kena permission-denied
    // di sini. Tanpa penanganan, listener-nya mati dan tiap kunjungan halaman
    // destinasi publik meninggalkan error di konsol.
    return onSnapshot(
      doc(db, 'cameras', cameraDocId),
      (snap) => setCam(snap.exists() ? ({ id: snap.id, ...snap.data() } as Camera) : null),
      () => setCam(null),
    );
  }, [cameraDocId]);

  // Kamera yang belum disetujui server VPS tidak punya siaran untuk ditampilkan.
  const hasCamera = !!cam && cameraStatus(cam) === 'approved';
  const cameraName = cam?.name;

  useEffect(() => {
    if (!hasCamera || cam?.streamUrl) return; // legacy tidak butuh server URL
    return subscribeCameraServerUrl(setServerUrl);
  }, [hasCamera, cam?.streamUrl]);

  const src = !hasCamera
    ? ''
    : cam!.streamUrl
      ? cam!.streamUrl
      : serverUrl === null
        ? null // masih memuat alamat server
        : serverUrl === ''
          ? '' // alamat server belum diatur
          : `${serverUrl.replace(/\/+$/, '')}/stream/${cam!.cameraId}`;
```

Sisa berkas tidak berubah: `cameraBlock` sudah memakai `hasCamera`, `src`, dan `cameraName` yang semuanya masih ada dengan nama yang sama.

- [ ] **Step 3: Sesuaikan pemanggilan di halaman destinasi**

`app/destinations/[id]/page.tsx:362-370`:

```tsx
            {/* Pantau langsung — kamera (kalau di-link & boleh ditonton) + sensor IoT */}
            {(dest.cameraId || stationPath(dest)) && (
              <LiveMonitorPanel cameraDocId={dest.cameraId} sensorPath={stationPath(dest)} />
            )}
```

- [ ] **Step 4: Hentikan denormalisasi di `DestinasiPanel`**

`components/dashboard/DestinasiPanel.tsx:168-193` — buang komentar denormalisasi, baris `linkedCam`, dan tiga field:

```tsx
  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim()) return;
    setSaving(true);
    // Koordinat ditulis berpasangan sebagai null saat kosong/tidak valid —
    // Firestore menolak undefined, dan null membersihkan nilai lama saat edit.
    const coords = parseCoords(coordInput);
    const data: DestinationInput = {
      ...form,
      tags: tagInput.split(',').map((t) => t.trim()).filter(Boolean),
      priceItems: (form.priceItems ?? []).filter((it) => it.label.trim() !== ''),
      images: imagesInput.split('\n').map((u) => u.trim()).filter(Boolean),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      whatsapp: (form.whatsapp ?? '').trim(),
      // Stasiun dimatikan → id paket sensor ikut dibersihkan, biar destinasi ini
      // tidak diam-diam masih menempel ke cabang RTDB paket lama.
      stationId: form.hasMonitoring ? (form.stationId ?? '') : '',
    };
```

Langganan `cameras` di panel ini tetap dipakai untuk dropdown pemilih `cameraId` — jangan dibuang.

- [ ] **Step 5: Build**

```bash
npm run build
```

Diharapkan: sukses. Kalau ada error "Property 'cameraStreamId' does not exist", masih ada pemakaian yang terlewat — cari dengan `grep -rn "cameraStreamId\|cameraStreamUrl\|cameraName" --include="*.tsx" --include="*.ts" app/ components/ lib/`. `cameraName` di dalam `LiveMonitorPanel` sendiri sah (variabel lokal dari `cam?.name`).

- [ ] **Step 6: Bersihkan dokumen destinasi yang masih membawa id stream**

Buat berkas sementara di scratchpad (jangan di repo), isi:

```js
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ROOT = '/Users/irhammohammad/Documents/Code/React/otaapp/OTA';
const require = createRequire(`${ROOT}/package.json`);
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const env = readFileSync(`${ROOT}/.env.local`, 'utf8');
const saPath = env.match(/^GOOGLE_APPLICATION_CREDENTIALS=(.+)$/m)[1].trim();
initializeApp({ credential: cert(`${ROOT}/${saPath.replace(/^\.\//, '')}`) });

const db = getFirestore();
const snap = await db.collection('destinations').get();
for (const d of snap.docs) {
  const data = d.data();
  if (data.cameraStreamId === undefined && data.cameraStreamUrl === undefined && data.cameraName === undefined) continue;
  await d.ref.update({
    cameraStreamId: FieldValue.delete(),
    cameraStreamUrl: FieldValue.delete(),
    cameraName: FieldValue.delete(),
  });
  console.log('dibersihkan:', d.id, data.name);
}
console.log('selesai');
```

Jalankan dengan `node <path-scratchpad>/clear-denorm.mjs`.

Diharapkan: minimal satu baris `dibersihkan: alGlcRJJQ0gb5y3vbo4S Desa Wisata Bahoi`, lalu `selesai`.

**Pakai `update()` dengan `FieldValue.delete()`, jangan `set()`** — `set()` tanpa `{ merge: true }` menimpa seluruh dokumen. Jangan pakai MCP `firestore_update_document` untuk ini: `updateMask`-nya tidak dihormati dan dokumennya ikut tertimpa.

- [ ] **Step 7: Buktikan id stream tidak lagi terbaca publik**

Buka `/destinations/alGlcRJJQ0gb5y3vbo4S` di jendela penyamaran (tanpa login), lalu DevTools → Network → cari respons Firestore untuk dokumen destinasi (filter `firestore.googleapis.com`).

Diharapkan: payload dokumennya tidak memuat `cameraStreamId`, `cameraStreamUrl`, `cameraName`, maupun nilai `dbskg4`. Yang boleh ada hanya `cameraId` berisi `OdSpu8wfFUaxv9OfJ1oZ` — itu doc id, bukan id stream.

- [ ] **Step 8: Commit**

```bash
git add lib/firestore.ts components/destinations/LiveMonitorPanel.tsx app/destinations/\[id\]/page.tsx components/dashboard/DestinasiPanel.tsx
git commit -m "feat: halaman destinasi baca dokumen kamera, bukan id stream publik"
```

---

## Task 6: Verifikasi menyeluruh

Tidak ada kode baru. Membuktikan gerbangnya benar-benar menutup dan membuka sesuai daftar penonton.

**Files:** tidak ada perubahan berkas.

**Interfaces:**
- Consumes: seluruh hasil Task 1-5
- Produces: —

- [ ] **Step 1: Jalankan seluruh penjaga regresi**

```bash
node lib/format.check.ts \
  && node lib/i18n.check.ts \
  && node lib/i18nHardcoded.check.ts \
  && node lib/loginCode.check.ts \
  && node lib/verification.check.ts \
  && node lib/destinationKeys.check.ts \
  && node lib/cameraViewers.check.ts \
  && npm run build
```

Diharapkan: semua LULUS, build sukses.

- [ ] **Step 2: Uji alur akses ujung ke ujung**

Butuh dua akun: `anakgilegile@gmail.com` (pengelola, pemilik kamera "test") dan satu akun user biasa. Kamera "test" tertaut ke destinasi Desa Wisata Bahoi (`/destinations/alGlcRJJQ0gb5y3vbo4S`).

1. **Tanpa login** (jendela penyamaran) → buka halaman Bahoi. Blok kamera **tidak ada**; blok sensor tetap tampil. Konsol **bersih** dari permission-denied.
2. **Login sebagai user biasa yang belum ditambahkan** → halaman Bahoi. Blok kamera masih tidak ada.
3. **Login sebagai pengelola** → `/dashboard` → Kamera → tambahkan email user biasa tadi, **ketik dengan huruf campur**. Chip yang muncul harus huruf kecil semua.
4. **Kembali sebagai user biasa** → muat ulang halaman Bahoi. Blok kamera **muncul**. (Kalau kameranya tidak sedang menyiarkan, yang tampil adalah keadaan "Tidak ada koneksi" — itu sudah bukti aksesnya terbuka; dokumen kameranya terbaca.)
5. **Pengelola hapus emailnya** → user biasa muat ulang. Blok kamera hilang lagi.
6. **Login sebagai admin** → `/dashboard` → Kamera. Semua kamera tampil, daftar penontonnya terbaca, tanpa tombol tambah/hapus.

- [ ] **Step 3: Pastikan pendaftaran kamera masih jalan**

Sebagai pengelola, buka `/kamera`. Form pendaftaran kamera masih ada. Daftarkan satu kamera baru; kartunya muncul berstatus "Menunggu admin", dan kamera itu juga muncul di dashboard Kamera dengan kartu penonton kosong.

Sebagai user biasa, buka `/kamera`. Yang tampil kartu keterangan, bukan form pengajuan.

- [ ] **Step 4: Commit apa pun yang perlu diperbaiki dari temuan**

Kalau semua langkah lulus tanpa perbaikan, tidak ada commit di tugas ini.

---

## Di Luar Rencana Ini

Server kamera VPS (repo Python terpisah) masih menyajikan `/stream/{cameraId}` tanpa autentikasi. Siapa pun yang sudah pernah melihat id stream sebuah kamera tetap bisa menontonnya langsung dari server. Rencana ini menutup jalur website — id stream berhenti disebarkan lewat dokumen publik, jadi tidak ada cara baru mendapatkannya. Menutup jalur server butuh pemeriksaan token di repo Python dan merupakan pekerjaan tersendiri.
