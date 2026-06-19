# Notifikasi & Pembayaran Pasca-Scan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setelah operator scan tiket (check-in), pengunjung menerima notifikasi di lonceng app-nya dan dapat memilih metode pembayaran (mock) untuk melunasi.

**Architecture:** Pendekatan B — notifikasi **diturunkan dari data booking**, bukan koleksi terpisah. "Notif bayar" = booking milik user dengan `status === "used" && paymentStatus === "unpaid"`. Lonceng subscribe booking milik user sendiri (real-time) dan memfilter di klien. Pembayaran mengubah `paymentStatus` jadi `"paid"`.

**Tech Stack:** Next.js (App Router) + React, Firebase Firestore (`onSnapshot`, `updateDoc`, `addDoc`), TypeScript, Tailwind, `clsx`, `qrcode.react` (sudah ada). Modal pakai `createPortal` (react-dom).

## Global Constraints

- Tidak ada dependensi baru. (clsx ^2.1.1 & react-dom sudah ada.)
- TypeScript `strict: true` — kode harus lolos `npx tsc --noEmit` (exit 0).
- Tidak ada test runner di app ini; verifikasi tiap task = `npx tsc --noEmit` + commit. Task akhir + `npm run build` + verifikasi manual.
- Pendekatan B: **tanpa** koleksi `notifications`, **tanpa** cross-owner write, **tanpa** aturan/indeks Firestore baru.
- Pembayaran mock saja: memilih metode hanya mengubah status booking; tidak ada gateway/server.
- Modal baru WAJIB pakai pola portal yang sudah dipakai `components/booking/TicketModal.tsx`: `createPortal(..., document.body)` + guard `mounted` + `overflow-y-auto` + wrapper `flex min-h-full items-center justify-center p-4`.
- Booking lama tanpa `paymentStatus` tidak boleh memunculkan notif (hanya `status==="used" && paymentStatus==="unpaid"`).

## File Structure

- `lib/firestore.ts` (modify) — field pembayaran di `Booking`, `BookingInput`, `createBooking`, fungsi baru `payBooking`.
- `app/booking/page.tsx` (modify) — kirim `amount` saat `createBooking`.
- `components/notifications/PaymentModal.tsx` (create) — modal pilih metode + konfirmasi → `payBooking`.
- `components/notifications/NotificationBell.tsx` (create) — lonceng + badge + dropdown + buka PaymentModal.
- `components/desktop/TopNav.tsx` (modify) — pakai `<NotificationBell variant="light" />`.
- `components/mobile/MobileHeader.tsx` (modify) — pakai `<NotificationBell variant="dark" />`.

---

### Task 1: Data layer pembayaran (`lib/firestore.ts` + booking page)

**Files:**
- Modify: `lib/firestore.ts` (interface `Booking` ~100-113, `BookingInput` ~115, `createBooking` ~117-124, tambah `payBooking`)
- Modify: `app/booking/page.tsx` (panggilan `createBooking` ~78-87)

**Interfaces:**
- Produces:
  - `Booking` bertambah field opsional: `amount?: number`, `paymentStatus?: "unpaid" | "paid"`, `paymentMethod?: string`, `paidAt?: unknown`.
  - `BookingInput` (untuk `createBooking`) menyertakan `amount` (opsional dari Omit).
  - `payBooking(id: string, method: string): Promise<void>`.

- [ ] **Step 1: Perbarui interface `Booking`**

Ganti blok `export interface Booking { ... }` di `lib/firestore.ts` menjadi:

```ts
export interface Booking {
  id: string;
  userId: string;
  destinationId: string;
  destinationName: string;
  date: string;
  guests: number;
  name: string;
  phone: string;
  notes: string;
  status: "pending" | "confirmed" | "cancelled" | "used";
  createdAt: unknown;
  checkedInAt?: unknown;
  amount?: number;
  paymentStatus?: "unpaid" | "paid";
  paymentMethod?: string;
  paidAt?: unknown;
}
```

- [ ] **Step 2: Perbarui `BookingInput` (jangan izinkan field sistem dari caller)**

Ganti:

```ts
export type BookingInput = Omit<Booking, "id" | "status" | "createdAt" | "checkedInAt">;
```

menjadi:

```ts
export type BookingInput = Omit<
  Booking,
  "id" | "status" | "createdAt" | "checkedInAt" | "paymentStatus" | "paymentMethod" | "paidAt"
>;
```

- [ ] **Step 3: `createBooking` set `paymentStatus` + `amount` default**

Ganti fungsi `createBooking` menjadi:

```ts
export async function createBooking(data: BookingInput) {
  if (!db) return;
  await addDoc(collection(db, "bookings"), {
    ...data,
    amount: data.amount ?? 0,
    status: "confirmed",
    paymentStatus: "unpaid",
    createdAt: serverTimestamp(),
  });
}
```

- [ ] **Step 4: Tambah fungsi `payBooking`**

Tambahkan tepat setelah `checkInBooking` (sebelum komentar `// ── Monitoring ──`):

```ts
/** Tandai booking sebagai lunas (mock — tanpa gateway). Dijalankan oleh pemilik booking. */
export async function payBooking(id: string, method: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "bookings", id), {
    paymentStatus: "paid",
    paymentMethod: method,
    paidAt: serverTimestamp(),
  });
}
```

(`updateDoc`, `doc`, `serverTimestamp`, `collection`, `addDoc` sudah di-import di file ini.)

- [ ] **Step 5: Kirim `amount` dari halaman booking**

Di `app/booking/page.tsx`, pada `handleSubmit`, panggilan `createBooking({...})` (`destination` sudah dipastikan non-null sebelumnya). Tambah baris `amount`:

```ts
      await createBooking({
        userId: user.uid,
        destinationId: destination.id,
        destinationName: destination.name,
        date: form.date,
        guests: form.guests,
        name: form.name,
        phone: form.phone,
        notes: form.notes,
        amount: destination.priceStart * form.guests,
      });
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, tanpa error.

- [ ] **Step 7: Commit**

```bash
git add lib/firestore.ts app/booking/page.tsx
git commit -m "feat: field pembayaran booking + payBooking (pay-on-arrival data layer)"
```

---

### Task 2: PaymentModal (`components/notifications/PaymentModal.tsx`)

**Files:**
- Create: `components/notifications/PaymentModal.tsx`

**Interfaces:**
- Consumes: `payBooking(id, method)` dan tipe `Booking` dari `@/lib/firestore`.
- Produces: `export default function PaymentModal({ booking, onClose }: { booking: Booking; onClose: () => void })`.

- [ ] **Step 1: Buat file PaymentModal**

Buat `components/notifications/PaymentModal.tsx` dengan isi:

```tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { payBooking, type Booking } from '@/lib/firestore';

const METHODS = [
  { id: 'transfer', label: 'Transfer Bank', desc: 'BCA / Mandiri / BNI' },
  { id: 'ewallet', label: 'E-wallet', desc: 'GoPay / OVO / DANA' },
  { id: 'cash', label: 'Tunai di lokasi', desc: 'Bayar langsung ke petugas' },
];

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

interface PaymentModalProps {
  booking: Booking;
  onClose: () => void;
}

export default function PaymentModal({ booking, onClose }: PaymentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const handlePay = async () => {
    if (!method) return;
    setError(null);
    setPaying(true);
    try {
      await payBooking(booking.id, method);
      setPaid(true);
    } catch {
      setError('Gagal memproses pembayaran. Coba lagi.');
    } finally {
      setPaying(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-ink/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-sm animate-fade-up" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-navy-soft shadow-md ring-1 ring-shore-200 hover:text-navy transition-colors"
          >
            <CloseIcon />
          </button>

          <div className="card p-6">
            {paid ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="font-serif text-xl font-medium text-navy">Pembayaran Berhasil</h2>
                <p className="mt-2 text-[13px] text-navy-soft">
                  Terima kasih. Pembayaran untuk {booking.destinationName} sudah tercatat.
                </p>
                <button onClick={onClose} className="btn-primary mt-5 w-full rounded-xl px-4 py-2.5 text-[13px]">
                  Selesai
                </button>
              </div>
            ) : (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-600">
                  Pembayaran
                </span>
                <h2 className="mt-2 font-serif text-xl font-medium text-navy">{booking.destinationName}</h2>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-shore-50 px-4 py-3">
                  <span className="text-[13px] text-navy-soft">Total</span>
                  <span className="text-lg font-semibold text-navy">{formatIDR(booking.amount ?? 0)}</span>
                </div>

                <p className="mt-5 text-[11px] font-medium uppercase tracking-wider text-navy-soft">
                  Metode Pembayaran
                </p>
                <div className="mt-2 space-y-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={clsx(
                        'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                        method === m.id ? 'border-teal-400 bg-teal-50/60' : 'border-shore-200 hover:border-shore-300',
                      )}
                    >
                      <p className="text-[13px] font-medium text-navy">{m.label}</p>
                      <p className="text-[11px] text-navy-soft">{m.desc}</p>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 rounded-xl bg-red-100 px-3 py-2 text-[13px] font-medium text-red-600">
                    {error}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={!method || paying}
                  className="btn-primary mt-5 w-full rounded-xl px-4 py-2.5 text-[13px] disabled:opacity-50"
                >
                  {paying ? 'Memproses…' : 'Konfirmasi Pembayaran'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/notifications/PaymentModal.tsx
git commit -m "feat: PaymentModal (pilih metode pembayaran mock, pola portal)"
```

---

### Task 3: NotificationBell (`components/notifications/NotificationBell.tsx`)

**Files:**
- Create: `components/notifications/NotificationBell.tsx`

**Interfaces:**
- Consumes: `useAuthState()` dari `@/lib/useAuth`; `db` dari `@/lib/firebase`; `Booking` dari `@/lib/firestore`; `PaymentModal` dari `@/components/notifications/PaymentModal`.
- Produces: `export default function NotificationBell({ variant }: { variant: "light" | "dark" })`.

- [ ] **Step 1: Buat file NotificationBell**

Buat `components/notifications/NotificationBell.tsx` dengan isi:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import type { Booking } from '@/lib/firestore';
import PaymentModal from '@/components/notifications/PaymentModal';

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

interface NotificationBellProps {
  variant: 'light' | 'dark';
}

export default function NotificationBell({ variant }: NotificationBellProps) {
  const { user } = useAuthState();
  const [unpaid, setUnpaid] = useState<Booking[]>([]);
  const [open, setOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Booking | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !db) {
      setUnpaid([]);
      return;
    }
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Booking))
        .filter((b) => b.status === 'used' && b.paymentStatus === 'unpaid');
      setUnpaid(list);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user) return null;

  const count = unpaid.length;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifikasi"
        className={clsx(
          'relative',
          variant === 'light'
            ? 'rounded-full border border-shore-200 bg-surface/70 p-2 text-navy-soft transition-all duration-200 hover:border-shore-300 hover:text-navy'
            : 'text-white',
        )}
      >
        <BellIcon />
        {count > 0 && (
          <span
            className={clsx(
              'absolute flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white bg-teal-500',
              variant === 'light' ? '-right-1 -top-1 border-2 border-white' : '-right-1.5 -top-1.5 border-2 border-navy',
            )}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-shore-200 bg-surface p-2 shadow-soft">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-navy-soft">
            Notifikasi
          </p>
          {count === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-navy-soft">Tidak ada notifikasi.</p>
          ) : (
            <div className="space-y-1">
              {unpaid.map((b) => (
                <div key={b.id} className="rounded-xl px-3 py-2.5 hover:bg-shore-50">
                  <p className="text-[13px] font-medium text-navy">Check-in berhasil</p>
                  <p className="mt-0.5 text-[12px] text-navy-soft">
                    Silakan selesaikan pembayaran untuk {b.destinationName}.
                  </p>
                  <button
                    onClick={() => {
                      setPayTarget(b);
                      setOpen(false);
                    }}
                    className="btn-primary mt-2 rounded-lg px-3 py-1.5 text-[12px]"
                  >
                    Bayar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {payTarget && <PaymentModal booking={payTarget} onClose={() => setPayTarget(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/notifications/NotificationBell.tsx
git commit -m "feat: NotificationBell (badge + dropdown notif bayar, derive dari booking)"
```

---

### Task 4: Pasang NotificationBell di TopNav & MobileHeader

**Files:**
- Modify: `components/desktop/TopNav.tsx` (import + hapus `BellIcon` lokal ~23-31 + ganti tombol bell ~88-95)
- Modify: `components/mobile/MobileHeader.tsx` (import + hapus `BellIcon` lokal ~14-22 + ganti tombol bell ~42-45)

**Interfaces:**
- Consumes: `NotificationBell` dari `@/components/notifications/NotificationBell`.

- [ ] **Step 1: TopNav — tambah import**

Di `components/desktop/TopNav.tsx`, setelah baris `import { useAuthState } from '@/lib/useAuth';` tambahkan:

```ts
import NotificationBell from '@/components/notifications/NotificationBell';
```

- [ ] **Step 2: TopNav — hapus `BellIcon` lokal (jadi tak terpakai)**

Hapus seluruh blok fungsi ini:

```tsx
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
```

- [ ] **Step 3: TopNav — ganti tombol bell statis**

Ganti blok:

```tsx
                {/* Notification */}
                <button
                  className="relative rounded-full border border-shore-200 bg-surface/70 p-2 text-navy-soft transition-all duration-200 hover:border-shore-300 hover:text-navy"
                  aria-label="Notifikasi"
                >
                  <BellIcon />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-teal-400" />
                </button>
```

menjadi:

```tsx
                {/* Notification */}
                <NotificationBell variant="light" />
```

- [ ] **Step 4: MobileHeader — tambah import**

Di `components/mobile/MobileHeader.tsx`, setelah baris `import { useAuthState } from '@/lib/useAuth';` tambahkan:

```ts
import NotificationBell from '@/components/notifications/NotificationBell';
```

- [ ] **Step 5: MobileHeader — hapus `BellIcon` lokal (jadi tak terpakai)**

Hapus seluruh blok fungsi ini:

```tsx
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-white">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
```

- [ ] **Step 6: MobileHeader — ganti tombol bell statis**

Ganti blok:

```tsx
            <button className="relative" aria-label="Notifikasi">
              <BellIcon />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-teal-400 border-2 border-navy" />
            </button>
```

menjadi:

```tsx
            <NotificationBell variant="dark" />
```

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run build`
Expected: build sukses tanpa error (termasuk eslint — `BellIcon` tak terpakai sudah dihapus).

- [ ] **Step 8: Verifikasi manual**

1. Jalankan `npm run dev`.
2. Login sebagai pengunjung, buat booking baru (cek booking tersimpan dengan `amount` & `paymentStatus: "unpaid"`).
3. Login akun `pengelola` (atau ubah role di dashboard), buka **Scan Tiket**, scan QR tiket pengunjung → check-in (`status: "used"`).
4. Kembali sebagai pengunjung: lonceng (TopNav desktop & MobileHeader mobile) menampilkan **badge angka**; buka dropdown → notif "Check-in berhasil · silakan bayar".
5. Klik **Bayar** → PaymentModal muncul (center, tidak ketutup nav, cek juga viewport mobile pendek), pilih metode → **Konfirmasi Pembayaran** → status sukses → tutup → badge hilang (real-time).

- [ ] **Step 9: Commit**

```bash
git add components/desktop/TopNav.tsx components/mobile/MobileHeader.tsx
git commit -m "feat: aktifkan lonceng notifikasi (NotificationBell) di TopNav & MobileHeader"
```

---

## Self-Review

**Spec coverage:**
- Model data (amount/paymentStatus/paymentMethod/paidAt, createBooking, payBooking) → Task 1. ✅
- `checkInBooking` tidak berubah → tidak ada task yang menyentuhnya. ✅
- PaymentModal (portal, metode, total, error) → Task 2. ✅
- NotificationBell (subscribe own bookings, filter used&unpaid, badge, dropdown, buka modal, variant) → Task 3. ✅
- Integrasi TopNav + MobileHeader + amount di booking page → Task 1 (amount) & Task 4 (bell). ✅
- Edge: tidak login/`db` null → `NotificationBell` return null & guard di effect (Task 3); booking lama tanpa paymentStatus tak muncul (filter `paymentStatus === "unpaid"`). ✅
- Out of scope (gateway, koleksi notif, halaman /notifikasi) → tidak ada task. ✅

**Placeholder scan:** Tidak ada TBD/TODO; semua step memuat kode lengkap. ✅

**Type consistency:** `payBooking(id, method)` dipakai konsisten (Task 1 definisi → Task 2 pemakaian). `Booking.amount/paymentStatus` konsisten antara Task 1, 2, 3. `NotificationBell` prop `variant: "light" | "dark"` konsisten (Task 3 definisi → Task 4 pemakaian `"light"`/`"dark"`). ✅
