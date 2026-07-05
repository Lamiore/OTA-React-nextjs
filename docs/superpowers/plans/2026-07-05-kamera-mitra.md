# Kamera Mitra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Role baru `mitra` dengan alur verifikasi (form di profil → admin setujui/tolak), lalu mitra bisa mendaftarkan kamera (ID + URL stream) dan melihat live stream-nya; admin melihat semua kamera di dashboard.

**Architecture:** Field `verification` embedded di `users/{uid}`; kamera di koleksi Firestore top-level `cameras` dengan `ownerUid` + snapshot `ownerName`/`ownerEmail`. UI mitra hidup di view `'kamera'` ProfileView (komponen di `components/cameras/`), UI admin di PenggunaPanel (persetujuan) dan KameraPanel baru (semua kamera). Stream ditampilkan via `<img>` (MJPEG/HTTP), pola sama dengan `CameraPanel` monitoring lama.

**Tech Stack:** Next.js 14 App Router (client components), TypeScript 5, Tailwind CSS, Firebase Firestore SDK v12.

**Spec:** `docs/superpowers/specs/2026-07-05-kamera-mitra-design.md`

## Global Constraints

- Seluruh copy UI berbahasa Indonesia; string yang dikutip di task dipakai verbatim.
- Role strings persis: `'user' | 'mitra' | 'pengelola' | 'admin'` (hierarki user → mitra → pengelola → admin).
- Mitra TIDAK mendapat akses dashboard — guard `role !== 'admin' && role !== 'pengelola'` di `app/dashboard/page.tsx:23-30` tidak boleh diubah.
- JANGAN menyentuh `app/monitoring/`, `components/monitoring/`, koleksi `monitoring_data`, atau `NEXT_PUBLIC_CAMERA_URL` — sistem kamera mitra terpisah total.
- Firestore menolak `undefined` → `location` selalu string (boleh `''`), tidak pernah `undefined`.
- Repo tidak punya test infra. Gate verifikasi tiap task: `npx tsc --noEmit` (tanpa output) dan `npm run lint` (tidak ada warning BARU — kecuali satu warning `@next/next/no-img-element` di `components/cameras/CameraLiveModal.tsx` yang memang diharapkan: stream MJPEG tidak bisa lewat `next/image`, sama seperti `CameraPanel` lama).
- Modal di-portal ke `document.body` dengan guard `mounted` (pola `BookingHistory.tsx:47-50` — wrapper `.animate-fade-in` menyisakan `transform` yang merusak `position: fixed`).
- Ikuti idiom styling yang ada: `card`, `btn-primary`, `btn-ghost`, `section-label`, token warna `shore/teal/navy`, ukuran teks `text-[13px]`/`text-[12px]` dsb.

---

## File Structure

| File | Status | Tanggung jawab |
|---|---|---|
| `lib/useAuth.ts` | modify | `UserRole` + `'mitra'` |
| `lib/firestore.ts` | modify | `MitraVerification`, `Camera`, `AppUser.verification`, helper verifikasi + kamera |
| `components/cameras/CameraLiveModal.tsx` | create | Modal live stream (dipakai profil & dashboard) |
| `components/cameras/VerificationForm.tsx` | create | Form pengajuan verifikasi mitra |
| `components/cameras/CameraManager.tsx` | create | Daftar + tambah + hapus + live view kamera milik sendiri |
| `components/cameras/CameraSection.tsx` | create | Router kecil: manager / form / status pending / ditolak |
| `components/profile/ProfileView.tsx` | modify | Menu "Kamera" di atas "Riwayat Booking", view `'kamera'`, deep-link `?view=kamera` |
| `components/dashboard/PenggunaPanel.tsx` | modify | Role `mitra` + blok persetujuan verifikasi |
| `components/dashboard/DashboardSidebar.tsx` | modify | Item sidebar "Kamera" (admin) |
| `app/dashboard/page.tsx` | modify | Render `KameraPanel` |
| `components/dashboard/KameraPanel.tsx` | create | Semua kamera semua user (admin) |
| `docs/firestore-rules-kamera-mitra.md` | create | Delta rules Firestore untuk ditempel di console |

---

### Task 1: Model data & role mitra (`lib/`)

**Files:**
- Modify: `lib/useAuth.ts:8` (type `UserRole`)
- Modify: `lib/firestore.ts:99-122` (section Users) dan tambah section Cameras baru setelahnya

**Interfaces:**
- Consumes: — (task pertama)
- Produces (dipakai Task 2-5):
  - `type UserRole = 'user' | 'mitra' | 'pengelola' | 'admin'` (lib/useAuth)
  - `interface MitraVerification { fullName: string; phone: string; organization: string; status: 'pending' | 'approved' | 'rejected'; submittedAt: unknown; reviewedAt?: unknown }`
  - `interface Camera { id: string; cameraId: string; name: string; streamUrl: string; location: string; ownerUid: string; ownerName: string; ownerEmail: string; createdAt: unknown }`
  - `type CameraInput = Omit<Camera, 'id' | 'createdAt'>`
  - `canManageCameras(role: string | null | undefined): boolean`
  - `submitMitraVerification(uid: string, data: { fullName: string; phone: string; organization: string }): Promise<void>`
  - `approveMitra(uid: string): Promise<void>` / `rejectMitra(uid: string): Promise<void>`
  - `addCamera(data: CameraInput): Promise<void>` / `deleteCamera(id: string): Promise<void>`
  - `subscribeMyCameras(uid: string, cb: (c: Camera[]) => void): () => void`
  - `subscribeAllCameras(cb: (c: Camera[]) => void): () => void`

- [ ] **Step 1: Perlebar `UserRole` di `lib/useAuth.ts`**

Ganti baris 8:

```ts
export type UserRole = 'user' | 'pengelola' | 'admin';
```

menjadi:

```ts
export type UserRole = 'user' | 'mitra' | 'pengelola' | 'admin';
```

- [ ] **Step 2: Tambah tipe verifikasi + perlebar `AppUser` di `lib/firestore.ts`**

Ganti blok interface `AppUser` (baris 101-107):

```ts
export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: "user" | "pengelola" | "admin";
}
```

menjadi:

```ts
export interface MitraVerification {
  fullName: string; // nama lengkap penanggung jawab
  phone: string; // no. HP/WhatsApp aktif
  organization: string; // instansi/organisasi (operator dive, resort, ...)
  status: "pending" | "approved" | "rejected";
  submittedAt: unknown;
  reviewedAt?: unknown;
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: "user" | "mitra" | "pengelola" | "admin";
  /** Pengajuan verifikasi mitra; tidak ada berarti belum pernah mengajukan. */
  verification?: MitraVerification;
}
```

- [ ] **Step 3: Tambah helper verifikasi setelah `updateUserRole` (baris 119-122)**

Sisipkan tepat setelah fungsi `updateUserRole`:

```ts
export async function submitMitraVerification(
  uid: string,
  data: { fullName: string; phone: string; organization: string }
) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), {
    verification: { ...data, status: "pending", submittedAt: serverTimestamp() },
  });
}

export async function approveMitra(uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), {
    role: "mitra",
    "verification.status": "approved",
    "verification.reviewedAt": serverTimestamp(),
  });
}

export async function rejectMitra(uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), {
    "verification.status": "rejected",
    "verification.reviewedAt": serverTimestamp(),
  });
}
```

- [ ] **Step 4: Tambah section Cameras setelah section Users (sebelum `// ── Bookings ──`)**

```ts
// ── Cameras (kamera mitra — terpisah dari monitoring IoT) ──

export interface Camera {
  id: string; // Firestore doc id
  cameraId: string; // ID perangkat yang diisi user, unik per pemilik
  name: string; // nama tampilan, misal "Kamera Dermaga Bunaken"
  streamUrl: string; // URL stream langsung (MJPEG/HTTP), wajib http(s)://
  location: string; // lokasi pemasangan, boleh string kosong
  ownerUid: string;
  ownerName: string; // snapshot nama pemilik saat dibuat (untuk panel admin)
  ownerEmail: string; // snapshot email pemilik saat dibuat
  createdAt: unknown;
}

export type CameraInput = Omit<Camera, "id" | "createdAt">;

/** Mitra ke atas boleh mengelola kamera; pengelola & admin tanpa verifikasi. */
export function canManageCameras(role: string | null | undefined): boolean {
  return role === "mitra" || role === "pengelola" || role === "admin";
}

export async function addCamera(data: CameraInput) {
  if (!db) return;
  await addDoc(collection(db, "cameras"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function deleteCamera(id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "cameras", id));
}

export function subscribeMyCameras(
  uid: string,
  callback: (cameras: Camera[]) => void
) {
  if (!db) return () => {};
  const q = query(collection(db, "cameras"), where("ownerUid", "==", uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Camera)));
  });
}

export function subscribeAllCameras(callback: (cameras: Camera[]) => void) {
  if (!db) return () => {};
  return onSnapshot(collection(db, "cameras"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Camera)));
  });
}
```

Semua import yang dipakai (`collection`, `doc`, `addDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`, `query`, `where`, `serverTimestamp`) sudah ada di header file — tidak perlu import baru.

- [ ] **Step 5: Verifikasi**

Run: `npx tsc --noEmit`
Expected: tanpa output (exit 0).

Run: `npm run lint`
Expected: hanya warning lama (lihat Global Constraints), tidak ada error.

- [ ] **Step 6: Commit**

```bash
git add lib/useAuth.ts lib/firestore.ts
git commit -m "feat(mitra): role mitra + model verifikasi & kamera di lib"
```

---

### Task 2: Komponen daun — CameraLiveModal & VerificationForm

**Files:**
- Create: `components/cameras/CameraLiveModal.tsx`
- Create: `components/cameras/VerificationForm.tsx`

**Interfaces:**
- Consumes: `Camera`, `MitraVerification`, `submitMitraVerification` dari `@/lib/firestore` (Task 1).
- Produces (dipakai Task 3 & 5):
  - `CameraLiveModal({ camera, onClose }: { camera: Camera; onClose: () => void })` — default export.
  - `VerificationForm({ uid, initial }: { uid: string; initial?: MitraVerification })` — default export; setelah submit sukses TIDAK pindah view sendiri (CameraSection berpindah otomatis via onSnapshot).

- [ ] **Step 1: Buat `components/cameras/CameraLiveModal.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Camera } from '@/lib/firestore';

interface Props {
  camera: Camera;
  onClose: () => void;
}

/**
 * Live view stream MJPEG/HTTP via <img>, di-portal ke <body> agar lepas dari
 * container ber-transform (pola modal BookingHistory). next/image sengaja
 * tidak dipakai: stream MJPEG tidak bisa dioptimasi/di-proxy.
 */
export default function CameraLiveModal({ camera, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      <div className="absolute inset-0 bg-shore-50/60 backdrop-blur-lg" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-2xl card p-5 animate-fade-up" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-medium text-navy truncate">{camera.name}</h2>
              <p className="text-[12px] text-navy-soft mt-0.5 truncate">
                ID: {camera.cameraId}
                {camera.location && ` — ${camera.location}`}
              </p>
            </div>
            <button onClick={onClose} className="btn-ghost rounded-xl px-3 py-1.5 text-[12px] shrink-0">
              Tutup
            </button>
          </div>

          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-ink">
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
                <p className="text-sm">Tidak bisa terhubung ke kamera.</p>
                <p className="text-[12px] text-white/50">
                  Pastikan kamera online dan satu jaringan. Bila aplikasi dibuka lewat
                  HTTPS, stream http:// jaringan lokal akan diblokir browser.
                </p>
              </div>
            ) : (
              <img
                src={camera.streamUrl}
                alt={`Stream ${camera.name}`}
                className="w-full h-full object-contain"
                onError={() => setError(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Buat `components/cameras/VerificationForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { submitMitraVerification, type MitraVerification } from '@/lib/firestore';

interface Props {
  uid: string;
  /** Data pengajuan sebelumnya (prefill saat ajukan ulang setelah ditolak). */
  initial?: MitraVerification;
}

export default function VerificationForm({ uid, initial }: Props) {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [organization, setOrganization] = useState(initial?.organization ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !organization.trim()) {
      setError('Semua kolom wajib diisi.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await submitMitraVerification(uid, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        organization: organization.trim(),
      });
      // Tidak reset/pindah view di sini: CameraSection berpindah ke kartu
      // status pending begitu onSnapshot dokumen user menerima perubahan.
    } catch {
      setError('Gagal mengirim pengajuan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-shore-200 bg-surface px-4 py-2.5 text-[14px] text-navy outline-none transition-colors focus:border-teal-400';

  return (
    <div className="card p-6">
      <h2 className="font-serif text-lg font-medium text-navy">Verifikasi Akun Mitra</h2>
      <p className="text-[13px] text-navy-soft mt-2 leading-relaxed">
        Untuk mendaftarkan kamera, akunmu perlu diverifikasi admin terlebih dahulu.
        Lengkapi data di bawah — setelah disetujui, role akunmu naik menjadi mitra.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-[12px] font-medium text-navy mb-1.5">Nama Lengkap</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nama penanggung jawab"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-navy mb-1.5">No. HP</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium text-navy mb-1.5">Instansi/Organisasi</label>
          <input
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Operator dive, resort, komunitas, ..."
            className={inputClass}
          />
        </div>

        {error && <p className="text-[12px] text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full rounded-xl px-6 py-3 text-[14px] disabled:opacity-50"
        >
          {submitting ? 'Mengirim...' : 'Ajukan Verifikasi'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npx tsc --noEmit`
Expected: tanpa output.

Run: `npm run lint`
Expected: tepat SATU warning baru — `@next/next/no-img-element` di `components/cameras/CameraLiveModal.tsx` (diperbolehkan, lihat Global Constraints). Tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add components/cameras/CameraLiveModal.tsx components/cameras/VerificationForm.tsx
git commit -m "feat(mitra): modal live stream & form verifikasi mitra"
```

---

### Task 3: CameraManager + CameraSection + integrasi ProfileView

**Files:**
- Create: `components/cameras/CameraManager.tsx`
- Create: `components/cameras/CameraSection.tsx`
- Modify: `components/profile/ProfileView.tsx` (menuItems ~baris 83, state view ~baris 119-121, onClick mapping ~baris 314-320, blok view baru sebelum `if (view === 'riwayat')` ~baris 147)

**Interfaces:**
- Consumes: Task 1 (`Camera`, `CameraInput`, `canManageCameras`, `addCamera`, `deleteCamera`, `subscribeMyCameras`, `MitraVerification`) dan Task 2 (`CameraLiveModal`, `VerificationForm`).
- Produces: `CameraSection({ user, role }: { user: User; role: UserRole | null })` — default export; merender header + salah satu dari CameraManager / form / kartu status.

- [ ] **Step 1: Buat `components/cameras/CameraManager.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from 'firebase/auth';
import {
  addCamera,
  deleteCamera,
  subscribeMyCameras,
  type Camera,
} from '@/lib/firestore';
import CameraLiveModal from './CameraLiveModal';

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export default function CameraManager({ user }: { user: User }) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  // Form tambah kamera
  const [cameraId, setCameraId] = useState('');
  const [name, setName] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [liveCamera, setLiveCamera] = useState<Camera | null>(null);
  const [deletingCamera, setDeletingCamera] = useState<Camera | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Portal modal ke <body> (pola BookingHistory — lepas dari wrapper ber-transform).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const unsub = subscribeMyCameras(user.uid, (data) => {
      setCameras(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = cameraId.trim();
    const nm = name.trim();
    const url = streamUrl.trim();
    if (!id || !nm || !url) {
      setError('ID kamera, nama, dan URL stream wajib diisi.');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError('URL stream harus diawali http:// atau https://.');
      return;
    }
    if (cameras.some((c) => c.cameraId === id)) {
      setError('ID kamera sudah terdaftar.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await addCamera({
        cameraId: id,
        name: nm,
        streamUrl: url,
        location: location.trim(),
        ownerUid: user.uid,
        ownerName: user.displayName ?? '',
        ownerEmail: user.email ?? '',
      });
      setCameraId('');
      setName('');
      setStreamUrl('');
      setLocation('');
    } catch {
      setError('Gagal menyimpan kamera. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCamera) return;
    setDeleting(true);
    try {
      await deleteCamera(deletingCamera.id);
      setDeletingCamera(null);
    } finally {
      setDeleting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-shore-200 bg-surface px-4 py-2.5 text-[14px] text-navy outline-none transition-colors focus:border-teal-400';

  return (
    <>
      {liveCamera && <CameraLiveModal camera={liveCamera} onClose={() => setLiveCamera(null)} />}

      {/* Konfirmasi hapus — portal ke <body> */}
      {mounted && deletingCamera && createPortal(
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div className="absolute inset-0 bg-shore-50/60 backdrop-blur-lg" onClick={() => !deleting && setDeletingCamera(null)} />
          <div className="relative flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-sm card p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-serif text-lg font-medium text-navy text-center">Hapus Kamera?</h2>
              <p className="text-[13px] text-navy-soft text-center mt-2">
                Kamera <span className="font-medium text-navy">{deletingCamera.name}</span> akan
                dihapus dan tidak bisa dikembalikan.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeletingCamera(null)}
                  disabled={deleting}
                  className="btn-ghost flex-1 rounded-xl px-4 py-2.5 text-[13px]"
                >
                  Kembali
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl px-4 py-2.5 text-[13px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                >
                  {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Daftar kamera */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-shore-100" />
              <div className="h-3 w-1/2 rounded-full bg-shore-100" />
            </div>
          ))
        ) : cameras.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">Belum ada kamera. Tambahkan kamera pertamamu.</p>
          </div>
        ) : (
          cameras.map((c) => (
            <div key={c.id} className="card p-5 animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-navy truncate">{c.name}</p>
                  <p className="text-[12px] text-navy-soft mt-1 truncate">
                    ID: {c.cameraId}
                    {c.location && ` — ${c.location}`}
                  </p>
                </div>
                <button
                  onClick={() => setDeletingCamera(c)}
                  className="h-8 w-8 rounded-lg border border-shore-200 flex items-center justify-center text-navy-soft hover:border-red-200 hover:text-red-500 transition-colors shrink-0"
                  aria-label={`Hapus ${c.name}`}
                >
                  <TrashIcon />
                </button>
              </div>
              <button
                onClick={() => setLiveCamera(c)}
                className="btn-primary w-full rounded-xl px-4 py-2 text-[12px] mt-4"
              >
                Lihat Live
              </button>
            </div>
          ))
        )}
      </div>

      {/* Form tambah kamera */}
      <div className="card p-6 mt-4">
        <h2 className="font-serif text-lg font-medium text-navy">Tambah Kamera</h2>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-navy mb-1.5">ID Kamera</label>
            <input
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              placeholder="Misal: CAM-BUNAKEN-01"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-navy mb-1.5">Nama Kamera</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Misal: Kamera Dermaga Bunaken"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-navy mb-1.5">URL Stream</label>
            <input
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              inputMode="url"
              placeholder="http://192.168.1.20:8080/video"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-navy mb-1.5">
              Lokasi <span className="font-normal text-navy-soft">(opsional)</span>
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Misal: Dermaga utama, Bunaken"
              className={inputClass}
            />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full rounded-xl px-6 py-3 text-[14px] disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Tambah Kamera'}
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Buat `components/cameras/CameraSection.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';
import type { UserRole } from '@/lib/useAuth';
import { canManageCameras, type MitraVerification } from '@/lib/firestore';
import CameraManager from './CameraManager';
import VerificationForm from './VerificationForm';

interface Props {
  user: User;
  role: UserRole | null;
}

/**
 * Router kecil view Kamera di profil:
 * - mitra/pengelola/admin → CameraManager;
 * - verification pending → kartu status;
 * - rejected → kartu ditolak + ajukan ulang;
 * - selain itu (belum mengajukan, atau approved tapi role diturunkan
 *   kembali ke user) → VerificationForm.
 */
export default function CameraSection({ user, role }: Props) {
  const [verification, setVerification] = useState<MitraVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setVerification((snap.data()?.verification as MitraVerification | undefined) ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  const manager = canManageCameras(role);

  return (
    <>
      <h1 className="font-serif text-2xl font-medium text-navy sm:text-3xl">Kamera</h1>
      <p className="mt-2 text-sm text-navy-soft">
        {manager
          ? 'Daftarkan dan pantau kamera milikmu'
          : 'Verifikasi akun untuk mendaftarkan kamera'}
      </p>

      <div className="mt-6">
        {manager ? (
          <CameraManager user={user} />
        ) : loading ? (
          <div className="card p-5 animate-pulse space-y-3">
            <div className="h-4 w-2/3 rounded-full bg-shore-100" />
            <div className="h-3 w-1/2 rounded-full bg-shore-100" />
          </div>
        ) : verification?.status === 'pending' ? (
          <div className="card p-6">
            <span className="inline-flex rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              Menunggu Persetujuan
            </span>
            <p className="text-[13px] text-navy-soft mt-3 leading-relaxed">
              Pengajuan sedang ditinjau admin. Kamu akan bisa menambahkan kamera
              setelah pengajuan disetujui.
            </p>
            <div className="mt-4 space-y-1.5 text-[13px] text-navy">
              <p><span className="text-navy-soft">Nama:</span> {verification.fullName}</p>
              <p><span className="text-navy-soft">No. HP:</span> {verification.phone}</p>
              <p><span className="text-navy-soft">Instansi:</span> {verification.organization}</p>
            </div>
          </div>
        ) : verification?.status === 'rejected' && !resubmitting ? (
          <div className="card p-6">
            <span className="inline-flex rounded-lg bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-600">
              Pengajuan Ditolak
            </span>
            <p className="text-[13px] text-navy-soft mt-3 leading-relaxed">
              Pengajuan verifikasimu ditolak admin. Periksa kembali datamu lalu
              ajukan ulang.
            </p>
            <button
              onClick={() => setResubmitting(true)}
              className="btn-primary w-full rounded-xl px-6 py-3 text-[14px] mt-5"
            >
              Ajukan Ulang
            </button>
          </div>
        ) : (
          <VerificationForm uid={user.uid} initial={verification ?? undefined} />
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Integrasi di `components/profile/ProfileView.tsx`**

**3a.** Tambah import (setelah `import BookingHistory ...` baris 9):

```tsx
import CameraSection from '@/components/cameras/CameraSection';
```

**3b.** Tambah item menu di `menuItems` (baris 83) sebagai elemen PERTAMA array, di atas objek "Riwayat Booking":

```tsx
  {
    label: 'Kamera',
    description: 'Daftarkan & pantau kamera milikmu',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
  },
```

**3c.** Perlebar state view + deep-link (ganti baris 119-121):

```tsx
  const [view, setView] = useState<'menu' | 'riwayat' | 'pengaturan' | 'kamera'>(
    searchParams.get('view') === 'riwayat'
      ? 'riwayat'
      : searchParams.get('view') === 'kamera'
        ? 'kamera'
        : 'menu'
  );
```

**3d.** Tambah mapping onClick (ganti ekspresi onClick di baris 314-320):

```tsx
            onClick={
              item.label === 'Kamera'
                ? () => setView('kamera')
                : item.label === 'Riwayat Booking'
                  ? () => setView('riwayat')
                  : item.label === 'Pengaturan'
                    ? () => setView('pengaturan')
                    : undefined
            }
```

**3e.** Tambah blok view kamera TEPAT SEBELUM `if (view === 'riwayat') {` (baris 147):

```tsx
  if (view === 'kamera') {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in">
        <button
          onClick={() => setView('menu')}
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-navy-soft transition-colors hover:text-navy"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Kembali
        </button>
        <CameraSection user={user} role={role} />
      </div>
    );
  }
```

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit` → tanpa output.
Run: `npm run lint` → tidak ada warning baru selain yang sudah didokumentasikan (Task 2).

Manual (`npm run dev`):
1. Login sebagai user biasa → Profil → menu "Kamera" muncul DI ATAS "Riwayat Booking" → klik → form verifikasi tampil.
2. Isi ketiga kolom → "Ajukan Verifikasi" → kartu "Menunggu Persetujuan" muncul otomatis (tanpa reload) beserta data yang diajukan.
3. Buka `/profile?view=kamera` langsung → view kamera terbuka.
4. Login sebagai admin/pengelola → Profil → Kamera → langsung CameraManager (form tambah + daftar kosong: "Belum ada kamera. Tambahkan kamera pertamamu.").
5. Submit form dengan kolom kosong → "Semua kolom wajib diisi." tampil, tidak ada write.

- [ ] **Step 5: Commit**

```bash
git add components/cameras/CameraManager.tsx components/cameras/CameraSection.tsx components/profile/ProfileView.tsx
git commit -m "feat(mitra): kelola kamera & alur verifikasi di halaman profil"
```

---

### Task 4: Persetujuan verifikasi di PenggunaPanel

**Files:**
- Modify: `components/dashboard/PenggunaPanel.tsx` (seluruh file — file kecil, tulis ulang utuh)

**Interfaces:**
- Consumes: `approveMitra(uid)`, `rejectMitra(uid)`, `AppUser` (dengan `verification?`) dari Task 1.
- Produces: — (leaf UI).

- [ ] **Step 1: Ganti isi `components/dashboard/PenggunaPanel.tsx` menjadi:**

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  approveMitra,
  rejectMitra,
  subscribeUsers,
  updateUserRole,
  type AppUser,
} from '@/lib/firestore';

const roleColors: Record<AppUser['role'], string> = {
  user: 'bg-shore-100 text-navy-soft',
  mitra: 'bg-sky-100 text-sky-700',
  pengelola: 'bg-amber-100 text-amber-700',
  admin: 'bg-teal-100 text-teal-700',
};

export default function PenggunaPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [reviewingUid, setReviewingUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeUsers(setUsers);
    return () => unsub();
  }, []);

  const handleRoleChange = async (uid: string, role: AppUser['role']) => {
    setUpdatingUid(uid);
    await updateUserRole(uid, role);
    setUpdatingUid(null);
  };

  const handleReview = async (uid: string, approve: boolean) => {
    setReviewingUid(uid);
    try {
      if (approve) {
        await approveMitra(uid);
      } else {
        await rejectMitra(uid);
      }
    } finally {
      setReviewingUid(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-medium text-navy">Pengguna</h1>
      <p className="mt-1 text-sm text-navy-soft">{users.length} pengguna terdaftar</p>

      <div className="mt-6 space-y-3">
        {users.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">Belum ada pengguna terdaftar.</p>
          </div>
        )}
        {users.map((u) => (
          <div key={u.uid} className="card px-5 py-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              {u.photoURL ? (
                <img
                  src={u.photoURL}
                  alt={u.name}
                  className="h-10 w-10 rounded-full object-cover border border-shore-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center border border-shore-200 shrink-0">
                  <span className="text-sm font-semibold text-teal-700">
                    {u.name ? u.name[0].toUpperCase() : u.email?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-navy truncate">{u.name || 'Tanpa Nama'}</p>
                <p className="text-[12px] text-navy-soft truncate">{u.email}</p>
              </div>

              {/* Role selector */}
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.uid, e.target.value as AppUser['role'])}
                disabled={updatingUid === u.uid}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium border border-shore-200 outline-none cursor-pointer transition-colors focus:border-teal-400 disabled:opacity-50 ${roleColors[u.role]}`}
              >
                <option value="user">User</option>
                <option value="mitra">Mitra</option>
                <option value="pengelola">Pengelola</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Pengajuan verifikasi mitra */}
            {u.verification?.status === 'pending' && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <span className="inline-flex rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  Pengajuan Mitra
                </span>
                <div className="mt-3 space-y-1 text-[13px] text-navy">
                  <p><span className="text-navy-soft">Nama:</span> {u.verification.fullName}</p>
                  <p><span className="text-navy-soft">No. HP:</span> {u.verification.phone}</p>
                  <p><span className="text-navy-soft">Instansi:</span> {u.verification.organization}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleReview(u.uid, true)}
                    disabled={reviewingUid === u.uid}
                    className="btn-primary flex-1 rounded-xl px-4 py-2 text-[12px] disabled:opacity-50"
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => handleReview(u.uid, false)}
                    disabled={reviewingUid === u.uid}
                    className="btn-ghost flex-1 rounded-xl px-4 py-2 text-[12px] hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Catatan: struktur baris berubah dari `card flex ...` menjadi `card` dengan
`div.flex` di dalamnya agar blok pengajuan bisa berada di bawah baris —
tampilan baris user tanpa pengajuan tetap sama.

- [ ] **Step 2: Verifikasi**

Run: `npx tsc --noEmit` → tanpa output.
Run: `npm run lint` → tidak ada warning baru (warning `<img>` PenggunaPanel sudah ada sebelumnya).

Manual (`npm run dev`, login admin, Dashboard → Pengguna):
1. User yang mengajukan verifikasi (dari Task 3) menampilkan blok "Pengajuan Mitra" + data.
2. Klik **Setujui** → dropdown role user itu berubah "Mitra" (live), blok pengajuan hilang; di sesi user tsb, view Kamera berubah menjadi CameraManager tanpa reload.
3. Ajukan lagi dari akun lain → klik **Tolak** → blok hilang, role tetap User; user melihat kartu "Pengajuan Ditolak" + tombol "Ajukan Ulang" (prefill data lama).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/PenggunaPanel.tsx
git commit -m "feat(mitra): persetujuan verifikasi mitra di panel pengguna"
```

---

### Task 5: KameraPanel admin + sidebar + routing dashboard

**Files:**
- Create: `components/dashboard/KameraPanel.tsx`
- Modify: `components/dashboard/DashboardSidebar.tsx` (type baris 6, `allMenuItems` baris 77-82, tambah ikon)
- Modify: `app/dashboard/page.tsx` (import + render panel)

**Interfaces:**
- Consumes: `subscribeAllCameras`, `Camera` (Task 1); `CameraLiveModal` (Task 2).
- Produces: — (leaf UI).

- [ ] **Step 1: Buat `components/dashboard/KameraPanel.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { subscribeAllCameras, type Camera } from '@/lib/firestore';
import CameraLiveModal from '@/components/cameras/CameraLiveModal';

export default function KameraPanel() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveCamera, setLiveCamera] = useState<Camera | null>(null);

  useEffect(() => {
    const unsub = subscribeAllCameras((data) => {
      setCameras(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="animate-fade-in">
      {liveCamera && <CameraLiveModal camera={liveCamera} onClose={() => setLiveCamera(null)} />}

      <h1 className="font-serif text-2xl font-medium text-navy">Kamera</h1>
      <p className="mt-1 text-sm text-navy-soft">{cameras.length} kamera terdaftar</p>

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-shore-100" />
              <div className="h-3 w-1/2 rounded-full bg-shore-100" />
            </div>
          ))
        ) : cameras.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">Belum ada kamera terdaftar.</p>
          </div>
        ) : (
          cameras.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-navy truncate">{c.name}</p>
                <p className="text-[12px] text-navy-soft truncate mt-0.5">
                  ID: {c.cameraId}
                  {c.location && ` — ${c.location}`}
                </p>
                <p className="text-[12px] text-navy-soft truncate mt-0.5">
                  Pemilik: {c.ownerName || 'Tanpa Nama'} ({c.ownerEmail})
                </p>
              </div>
              <button
                onClick={() => setLiveCamera(c)}
                className="btn-primary rounded-xl px-4 py-2 text-[12px] shrink-0"
              >
                Lihat Live
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `components/dashboard/DashboardSidebar.tsx`**

**2a.** Ganti type (baris 6):

```tsx
export type DashboardPage = 'statistik' | 'scan' | 'destinasi' | 'pengguna' | 'kamera';
```

**2b.** Tambah ikon (setelah fungsi `UsersIcon`, baris 36):

```tsx
function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
```

**2c.** Tambah entri terakhir `allMenuItems` (baris 77-82):

```tsx
const allMenuItems: { key: DashboardPage; label: string; icon: React.ReactNode; roles: string[] }[] = [
  { key: 'statistik', label: 'Statistik', icon: <ChartIcon />, roles: ['admin', 'pengelola'] },
  { key: 'scan', label: 'Scan Tiket', icon: <ScanIcon />, roles: ['admin', 'pengelola'] },
  { key: 'destinasi', label: 'Destinasi', icon: <MapIcon />, roles: ['admin'] },
  { key: 'pengguna', label: 'Pengguna', icon: <UsersIcon />, roles: ['admin'] },
  { key: 'kamera', label: 'Kamera', icon: <CameraIcon />, roles: ['admin'] },
];
```

- [ ] **Step 3: Update `app/dashboard/page.tsx`**

**3a.** Tambah import (setelah baris 11):

```tsx
import KameraPanel from '@/components/dashboard/KameraPanel';
```

**3b.** Tambah render setelah baris `{page === 'pengguna' && ...}` (baris 46):

```tsx
          {page === 'kamera' && role === 'admin' && <KameraPanel />}
```

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit` → tanpa output.
Run: `npm run lint` → tidak ada warning baru.

Manual (`npm run dev`):
1. Login admin → Dashboard → sidebar menampilkan "Kamera" (paling bawah) → klik → daftar semua kamera semua user + pemiliknya; "Lihat Live" membuka modal stream.
2. Login pengelola → sidebar TIDAK menampilkan "Kamera".
3. Tanpa kamera → "Belum ada kamera terdaftar."

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/KameraPanel.tsx components/dashboard/DashboardSidebar.tsx app/dashboard/page.tsx
git commit -m "feat(mitra): panel kamera admin di dashboard"
```

---

### Task 6: Dokumen rules Firestore

**Files:**
- Create: `docs/firestore-rules-kamera-mitra.md`

**Interfaces:**
- Consumes: nama koleksi `cameras` + field `ownerUid` (Task 1), role `mitra`.
- Produces: dokumen instruksi; ruleset final digabung manual dengan ruleset aktif di Firebase console (repo tidak menyimpan file rules).

- [ ] **Step 1: Buat `docs/firestore-rules-kamera-mitra.md`**

````markdown
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
````

- [ ] **Step 2: Verifikasi**

Dokumen bisa dibaca dan kedua snippet lengkap (tidak ada placeholder).
`npx tsc --noEmit` tetap tanpa output (tidak ada perubahan kode).

- [ ] **Step 3: Commit**

```bash
git add docs/firestore-rules-kamera-mitra.md
git commit -m "docs(mitra): delta rules Firestore untuk koleksi cameras & verifikasi"
```

---

## Verifikasi Akhir (setelah semua task)

Checklist manual spec (`npm run dev` + dua akun: user biasa & admin):

1. User biasa: Profil → Kamera → form → submit → pending (data tampil).
2. Admin: Dashboard → Pengguna → blok "Pengajuan Mitra" → Setujui → role jadi mitra (live di kedua sisi).
3. Tolak (akun lain) → kartu ditolak → Ajukan Ulang terisi data lama.
4. Mitra: tambah kamera valid → muncul; duplikat ID → "ID kamera sudah terdaftar."; URL tanpa http → error URL.
5. Lihat Live: URL MJPEG hidup → stream tampil; URL mati → kartu error.
6. Hapus kamera → konfirmasi → hilang.
7. Admin: Dashboard → Kamera → semua kamera + pemilik + Lihat Live; pengelola tidak melihat menu Kamera di sidebar; mitra tidak bisa membuka /dashboard (redirect beranda).
8. Rules dipublish dari `docs/firestore-rules-kamera-mitra.md` dan uji cepatnya lolos.
