# Tiket Instan + Scan Check-in — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus pembayaran sandbox sehingga booking langsung menghasilkan tiket valid, tambah halaman scan QR di dashboard untuk check-in, dan catat tiket yang discan sebagai "Tiket Terjual" di statistik.

**Architecture:** Status booking dibuat `confirmed` langsung saat dibuat. Tiket lama berstatus `pending` diperlakukan sama seperti `confirmed` di UI. Halaman scan (client component, library `html5-qrcode`) membaca QR `OTA-TICKET|{id}|...`, mengambil booking via `getDoc`, dan menandai `status: 'used'` lewat `checkInBooking`. Statistik menghitung booking berstatus `used` secara real-time lewat `onSnapshot` yang sudah ada.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18, TypeScript, Firebase/Firestore (`onSnapshot`/`getDoc`/`updateDoc`), Tailwind (token `navy`/`shore`/`teal`), `qrcode.react` (sudah ada), `html5-qrcode` (baru).

## Global Constraints

- Next.js 14.2.35 App Router; komponen yang memakai browser/DOM wajib `'use client'`.
- Tidak ada framework test. Gerbang verifikasi tiap task: `npx tsc --noEmit` harus keluar exit 0. Plus pengecekan manual yang disebut di task.
- Komponen client yang menjadi entry (di-import oleh client lain) tidak boleh menerima prop fungsi yang tak-serializable jika diberi `'use client'` sendiri (lint 71007). `ScanPanel` & `TicketModal` aman karena dirender langsung tanpa prop fungsi lintas-boundary bermasalah.
- Format payload QR (tetap, jangan diubah): `OTA-TICKET|{booking.id}|{booking.destinationName}|{booking.date}` (dihasilkan `components/booking/TicketModal.tsx`).
- Kode tiket tampilan: `'OTA-' + id.slice(0,8).toUpperCase()` (prefix, tidak reversible — lookup pakai `id` penuh dari payload).
- Token warna yang aman dipakai (sudah ada di kode): `navy`, `navy-soft`, `shore-50/100/200`, `teal-50/100/400/500/600/700`, `amber-100/600/700`, `red-100/500/600`, `blue-100/600`, `purple-100/600`. Jangan pakai warna di luar daftar ini.
- Kamera butuh `localhost` atau HTTPS.
- Commit per task dengan pesan yang diberikan.

---

## File Structure

- `lib/firestore.ts` — model data + helper Firestore. Tambah status `'used'`, `checkedInAt`, ubah `createBooking`, tambah `checkInBooking`.
- `components/booking/BookingHistory.tsx` — daftar booking user. Hapus alur bayar, sesuaikan badge/aksi.
- `app/booking/page.tsx` — layar sukses booking (copy + CTA).
- `components/dashboard/ScanPanel.tsx` — **baru**, halaman scan QR + check-in.
- `components/dashboard/DashboardSidebar.tsx` — tambah menu "Scan Tiket".
- `app/dashboard/page.tsx` — render `ScanPanel`.
- `components/dashboard/PengelolaStatistikPanel.tsx` — kartu "Tiket Terjual" + badge `used`.
- `components/dashboard/StatistikPanel.tsx` — subscription bookings + kartu "Tiket Terjual".
- `package.json` — dependency `html5-qrcode`.

---

## Task 1: Data layer — status `used`, tiket instan, `checkInBooking`

**Files:**
- Modify: `lib/firestore.ts`

**Interfaces:**
- Produces:
  - `Booking.status: "pending" | "confirmed" | "cancelled" | "used"`
  - `Booking.checkedInAt?: unknown`
  - `createBooking(data: BookingInput): Promise<void>` (sekarang menulis `status: "confirmed"`)
  - `checkInBooking(id: string): Promise<void>` (menulis `status: "used"`, `checkedInAt: serverTimestamp()`)

- [ ] **Step 1: Ubah interface `Booking`**

Di `lib/firestore.ts`, ganti blok interface `Booking` (saat ini baris ~99-111) menjadi:

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
}

export type BookingInput = Omit<Booking, "id" | "status" | "createdAt" | "checkedInAt">;
```

- [ ] **Step 2: `createBooking` set status `confirmed` + tambah `checkInBooking`**

Ganti blok `createBooking` dan `updateBookingStatus` (saat ini baris ~115-127) menjadi:

```ts
export async function createBooking(data: BookingInput) {
  if (!db) return;
  await addDoc(collection(db, "bookings"), {
    ...data,
    status: "confirmed",
    createdAt: serverTimestamp(),
  });
}

export async function updateBookingStatus(id: string, status: Booking["status"]) {
  if (!db) return;
  await updateDoc(doc(db, "bookings", id), { status });
}

/** Tandai tiket sebagai sudah dipakai (check-in di lokasi). */
export async function checkInBooking(id: string) {
  if (!db) return;
  await updateDoc(doc(db, "bookings", id), {
    status: "used",
    checkedInAt: serverTimestamp(),
  });
}
```

(`serverTimestamp`, `updateDoc`, `doc`, `addDoc`, `collection` sudah di-import di file ini.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (tidak ada error). Catatan: error pemakaian akan muncul di file lain yang belum diperbarui hanya jika mereka menyempitkan tipe status — tidak ada, jadi harus bersih.

- [ ] **Step 4: Commit**

```bash
git add lib/firestore.ts
git commit -m "feat: booking langsung confirmed + checkInBooking (status used)"
```

---

## Task 2: Sisi user — hapus pembayaran, tiket instan

**Files:**
- Modify: `components/booking/BookingHistory.tsx` (tulis ulang penuh)
- Modify: `app/booking/page.tsx` (blok `if (success)`)

**Interfaces:**
- Consumes: `updateBookingStatus`, `type Booking` dari `lib/firestore` (Task 1).

- [ ] **Step 1: Tulis ulang `components/booking/BookingHistory.tsx`**

Ganti seluruh isi file dengan:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import { updateBookingStatus, type Booking as BookingType } from '@/lib/firestore';
import TicketModal from '@/components/booking/TicketModal';
import clsx from 'clsx';

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

/** Booking dianggap "lewat" jika tanggalnya sebelum hari ini (waktu lokal). Hari ini masih berlangsung. */
function isPast(b: BookingType) {
  // en-CA menghasilkan format YYYY-MM-DD di zona waktu lokal, sehingga aman dibandingkan string.
  const todayStr = new Date().toLocaleDateString('en-CA');
  return b.date < todayStr;
}

interface BookingHistoryProps {
  /** 'all' shows every booking (riwayat lengkap); 'active' hides cancelled/used/past ones (booking berlangsung). */
  variant?: 'all' | 'active';
}

export default function BookingHistory({ variant = 'all' }: BookingHistoryProps) {
  const router = useRouter();
  const { user } = useAuthState();

  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [cancellingBooking, setCancellingBooking] = useState<BookingType | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [ticketBooking, setTicketBooking] = useState<BookingType | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setLoadingBookings(false);
      return;
    }
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookingType));
      data.sort((a, b) => (b.date > a.date ? 1 : -1));
      setBookings(data);
      setLoadingBookings(false);
    });
    return () => unsub();
  }, [user]);

  const handleCancel = async () => {
    if (!cancellingBooking) return;
    setCancelling(true);
    await updateBookingStatus(cancellingBooking.id, 'cancelled');
    setCancelling(false);
    setCancellingBooking(null);
  };

  // 'active' hanya menampilkan tiket yang masih berlangsung: belum dibatalkan, belum dipakai, & belum lewat tanggal.
  const visibleBookings =
    variant === 'active'
      ? bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'used' && !isPast(b))
      : bookings;

  return (
    <>
      {/* Ticket modal — di luar semua container */}
      {ticketBooking && (
        <TicketModal booking={ticketBooking} onClose={() => setTicketBooking(null)} />
      )}

      {/* Cancel modal — di luar semua container */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-shore-50/60 backdrop-blur-lg" onClick={() => !cancelling && setCancellingBooking(null)} />
          <div className="relative flex items-center justify-center h-full p-4">
            <div className="w-full max-w-sm card p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-red-100 mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </div>
              <h2 className="font-serif text-lg font-medium text-navy text-center">Batalkan Booking?</h2>
              <p className="text-[13px] text-navy-soft text-center mt-2">
                Booking untuk <span className="font-medium text-navy">{cancellingBooking.destinationName}</span> pada{' '}
                <span className="font-medium text-navy">
                  {new Date(cancellingBooking.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>{' '}
                akan dibatalkan dan tidak bisa dikembalikan.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setCancellingBooking(null)}
                  disabled={cancelling}
                  className="btn-ghost flex-1 rounded-xl px-4 py-2.5 text-[13px]"
                >
                  Kembali
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 rounded-xl px-4 py-2.5 text-[13px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                >
                  {cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h1 className="font-serif text-2xl font-medium text-navy sm:text-3xl">
        {variant === 'active' ? 'Booking Berlangsung' : 'Riwayat Booking'}
      </h1>
      <p className="mt-2 text-sm text-navy-soft">
        {variant === 'active'
          ? 'Tiket yang sudah dikonfirmasi dan belum dipakai'
          : 'Daftar booking yang pernah kamu buat'}
      </p>

      <div className="mt-6 space-y-3">
        {!user ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">
              <button onClick={() => router.push('/profile')} className="text-teal-600 font-medium hover:text-teal-700">Masuk</button> untuk melihat riwayat booking.
            </p>
          </div>
        ) : loadingBookings ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-shore-100" />
              <div className="h-3 w-1/2 rounded-full bg-shore-100" />
            </div>
          ))
        ) : visibleBookings.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="h-12 w-12 rounded-xl bg-shore-100 flex items-center justify-center mx-auto mb-3 text-navy-soft">
              <CalendarIcon />
            </div>
            <p className="text-sm text-navy-soft">
              {variant === 'active' ? 'Belum ada booking yang berlangsung.' : 'Belum ada booking.'}
            </p>
            <button onClick={() => router.push('/beranda')} className="btn-primary rounded-xl px-5 py-2.5 text-[13px] mt-4">
              Buat Booking
            </button>
          </div>
        ) : (
          <>
            {visibleBookings.map((b) => {
              const used = b.status === 'used';
              const cancelled = b.status === 'cancelled';
              const past = isPast(b);
              // 'pending' (data lama) diperlakukan sama seperti 'confirmed'.
              const activeConfirmed = (b.status === 'confirmed' || b.status === 'pending') && !past;
              return (
                <div key={b.id} className="card p-5 animate-fade-in">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-navy">{b.destinationName}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-navy-soft">
                        <span>{new Date(b.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span>{b.guests} orang</span>
                        <span>{b.phone}</span>
                      </div>
                      {b.notes && (
                        <p className="mt-2 text-[12px] text-navy-soft italic">{b.notes}</p>
                      )}
                    </div>
                    <span className={clsx(
                      'rounded-lg px-2.5 py-1 text-[11px] font-medium shrink-0',
                      used && 'bg-shore-100 text-navy-soft',
                      cancelled && 'bg-red-100 text-red-600',
                      !used && !cancelled && past && 'bg-shore-100 text-navy-soft',
                      !used && !cancelled && !past && 'bg-teal-100 text-teal-700',
                    )}>
                      {used ? 'Sudah Digunakan' : cancelled ? 'Dibatalkan' : past ? 'Selesai' : 'Dikonfirmasi'}
                    </span>
                  </div>

                  {activeConfirmed && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-shore-200">
                      <button
                        onClick={() => setTicketBooking(b)}
                        className="btn-primary flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[12px]"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                          <path d="M13 5v2" />
                          <path d="M13 17v2" />
                          <path d="M13 11v2" />
                        </svg>
                        Lihat Tiket
                      </button>
                      <button
                        onClick={() => setCancellingBooking(b)}
                        className="btn-ghost flex-1 rounded-xl px-4 py-2 text-[12px] hover:border-red-200 hover:text-red-500"
                      >
                        Batalkan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Perbarui layar sukses di `app/booking/page.tsx`**

Ganti blok `if (success) { ... }` (saat ini baris ~105-135) menjadi:

```tsx
  if (success) {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in text-center py-16">
        <div className="card p-8 sm:p-10 flex flex-col items-center gap-4">
          <CheckCircleIcon />
          <h2 className="font-serif text-xl font-medium text-navy">Booking Berhasil!</h2>
          <p className="text-[13px] text-navy-soft max-w-xs">
            Tiket untuk <span className="font-medium text-navy">{destination?.name}</span> pada
            tanggal <span className="font-medium text-navy">{new Date(form.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span> sudah siap. Buka untuk melihat QR check-in.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => router.push('/booking')}
              className="btn-primary rounded-xl px-5 py-2.5 text-[13px]"
            >
              Lihat Tiket
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setForm({ date: '', guests: 1, name: user?.displayName ?? '', phone: '', notes: '' });
              }}
              className="btn-ghost rounded-xl px-5 py-2.5 text-[13px]"
            >
              Booking Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Pengecekan manual (singkat)**

Jalankan `npm run dev`, buat 1 booking baru → harus langsung berstatus "Dikonfirmasi" di tab Booking Berlangsung dengan tombol "Lihat Tiket" + "Batalkan" (tanpa langkah bayar). (Boleh dilewati bila dev server tidak dijalankan; typecheck tetap gerbang utama.)

- [ ] **Step 5: Commit**

```bash
git add components/booking/BookingHistory.tsx app/booking/page.tsx
git commit -m "feat: hapus pembayaran sandbox, tiket langsung tampil setelah booking"
```

---

## Task 3: Halaman Scan — library, komponen, wiring dashboard

**Files:**
- Modify: `package.json` (dependency)
- Create: `components/dashboard/ScanPanel.tsx`
- Modify: `components/dashboard/DashboardSidebar.tsx`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `checkInBooking`, `type Booking` dari `lib/firestore` (Task 1).
- Produces: `DashboardPage` menyertakan `'scan'`; `ScanPanel` (default export, tanpa prop).

- [ ] **Step 1: Install `html5-qrcode`**

Run: `npm install html5-qrcode`
Expected: `package.json` `dependencies` bertambah entri `"html5-qrcode"`, `package-lock.json` terupdate, exit 0.

- [ ] **Step 2: Buat `components/dashboard/ScanPanel.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';
import { db } from '@/lib/firebase';
import { checkInBooking, type Booking } from '@/lib/firestore';

const READER_ID = 'qr-reader';

type ScanResult =
  | { kind: 'valid'; booking: Booking }
  | { kind: 'used'; booking: Booking }
  | { kind: 'cancelled'; booking: Booking }
  | { kind: 'notfound' }
  | { kind: 'invalid' };

/** Ambil booking id dari payload QR "OTA-TICKET|{id}|{name}|{date}". */
function parseTicketId(text: string): string | null {
  const parts = text.split('|');
  if (parts[0] !== 'OTA-TICKET' || !parts[1]) return null;
  return parts[1];
}

function dateLabel(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Format Firestore Timestamp dengan aman (tipe disimpan sebagai unknown). */
function checkedInLabel(v: unknown): string | null {
  const ts = v as { toDate?: () => Date } | undefined;
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return null;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-navy-soft">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-navy">{value}</p>
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className="rounded-2xl border border-shore-200 bg-surface p-4">
      <p className="font-serif text-lg font-medium text-navy">{booking.destinationName}</p>
      <p className="mt-0.5 text-[12px] text-navy-soft">{dateLabel(booking.date)}</p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Detail label="Pemesan" value={booking.name} />
        <Detail label="Jumlah" value={`${booking.guests} orang`} />
        <Detail label="Telepon" value={booking.phone} />
        <Detail label="Kode Tiket" value={'OTA-' + booking.id.slice(0, 8).toUpperCase()} />
      </div>
    </div>
  );
}

export default function ScanPanel() {
  const [scanning, setScanning] = useState(true);
  const [scanKey, setScanKey] = useState(0);
  const [camError, setCamError] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const busyRef = useRef(false); // cegah pemrosesan decode ganda

  const handleDecoded = useCallback(async (text: string) => {
    if (busyRef.current) return;
    busyRef.current = true;

    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* sudah berhenti */ }
    }
    setScanning(false);

    const id = parseTicketId(text);
    if (!id || !db) {
      setResult({ kind: 'invalid' });
      return;
    }
    const snap = await getDoc(doc(db, 'bookings', id));
    if (!snap.exists()) {
      setResult({ kind: 'notfound' });
      return;
    }
    const booking = { id: snap.id, ...snap.data() } as Booking;
    if (booking.status === 'cancelled') setResult({ kind: 'cancelled', booking });
    else if (booking.status === 'used') setResult({ kind: 'used', booking });
    else setResult({ kind: 'valid', booking });
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let instance: Html5QrcodeType | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        instance = new Html5Qrcode(READER_ID);
        scannerRef.current = instance;
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (decodedText: string) => { void handleDecoded(decodedText); },
          () => { /* abaikan error per-frame */ },
        );
      } catch {
        if (!cancelled) setCamError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (instance) {
        instance.stop().catch(() => { /* abaikan */ });
      }
    };
  }, [scanning, scanKey, handleDecoded]);

  const handleCheckIn = async () => {
    if (!result || result.kind !== 'valid') return;
    setCheckingIn(true);
    await checkInBooking(result.booking.id);
    setCheckingIn(false);
    setCheckedIn(true);
  };

  const reset = () => {
    busyRef.current = false;
    setResult(null);
    setCheckedIn(false);
    setCamError(false);
    setScanKey((k) => k + 1);
    setScanning(true);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-medium text-navy">Scan Tiket</h1>
      <p className="mt-1 text-sm text-navy-soft">Arahkan kamera ke QR tiket pengunjung untuk check-in</p>

      <div className="mt-6 max-w-md">
        {scanning ? (
          <div className="card p-5">
            <div id={READER_ID} className="overflow-hidden rounded-2xl border border-shore-200 bg-ink/5" />
            {camError ? (
              <div className="mt-4 text-center">
                <p className="text-[13px] text-red-600">Tidak bisa mengakses kamera. Pastikan izin kamera diberikan dan halaman dibuka via localhost/HTTPS.</p>
                <button onClick={reset} className="btn-primary rounded-xl px-5 py-2.5 text-[13px] mt-3">Coba Lagi</button>
              </div>
            ) : (
              <p className="mt-3 text-center text-[12px] text-navy-soft">Mencari QR tiket…</p>
            )}
          </div>
        ) : (
          <div className="card p-5 space-y-4">
            {result?.kind === 'invalid' && (
              <p className="text-[14px] font-medium text-red-600">QR tidak valid. Bukan tiket OTA.</p>
            )}
            {result?.kind === 'notfound' && (
              <p className="text-[14px] font-medium text-red-600">Tiket tidak ditemukan.</p>
            )}
            {result?.kind === 'cancelled' && (
              <>
                <div className="rounded-xl bg-red-100 px-3 py-2 text-[13px] font-medium text-red-600">Tiket ini sudah dibatalkan.</div>
                <BookingCard booking={result.booking} />
              </>
            )}
            {result?.kind === 'used' && (
              <>
                <div className="rounded-xl bg-amber-100 px-3 py-2 text-[13px] font-medium text-amber-700">
                  Tiket sudah digunakan{checkedInLabel(result.booking.checkedInAt) ? ` · ${checkedInLabel(result.booking.checkedInAt)}` : ''}.
                </div>
                <BookingCard booking={result.booking} />
              </>
            )}
            {result?.kind === 'valid' && !checkedIn && (
              <>
                <div className="rounded-xl bg-teal-100 px-3 py-2 text-[13px] font-medium text-teal-700">Tiket valid.</div>
                <BookingCard booking={result.booking} />
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="btn-primary w-full rounded-xl px-4 py-2.5 text-[13px] disabled:opacity-50"
                >
                  {checkingIn ? 'Memproses…' : 'Konfirmasi Check-in'}
                </button>
              </>
            )}
            {result?.kind === 'valid' && checkedIn && (
              <>
                <div className="rounded-xl bg-teal-100 px-3 py-2 text-[13px] font-medium text-teal-700">Check-in berhasil! Tiket dicatat sebagai terjual.</div>
                <BookingCard booking={result.booking} />
              </>
            )}

            <button onClick={reset} className="btn-ghost w-full rounded-xl px-4 py-2.5 text-[13px]">Scan Lagi</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tambah menu "Scan Tiket" di `components/dashboard/DashboardSidebar.tsx`**

Ubah tipe `DashboardPage` (baris ~6):

```tsx
export type DashboardPage = 'statistik' | 'scan' | 'destinasi' | 'pengguna';
```

Tambahkan komponen ikon ini tepat sebelum `const allMenuItems` (baris ~65):

```tsx
function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" x2="17" y1="12" y2="12" />
    </svg>
  );
}
```

Ganti array `allMenuItems` (baris ~65-69) menjadi:

```tsx
const allMenuItems: { key: DashboardPage; label: string; icon: React.ReactNode; roles: string[] }[] = [
  { key: 'statistik', label: 'Statistik', icon: <ChartIcon />, roles: ['admin', 'pengelola'] },
  { key: 'scan', label: 'Scan Tiket', icon: <ScanIcon />, roles: ['admin', 'pengelola'] },
  { key: 'destinasi', label: 'Destinasi', icon: <MapIcon />, roles: ['admin'] },
  { key: 'pengguna', label: 'Pengguna', icon: <UsersIcon />, roles: ['admin'] },
];
```

- [ ] **Step 4: Render `ScanPanel` di `app/dashboard/page.tsx`**

Tambah import setelah import `PengelolaStatistikPanel` (baris ~8):

```tsx
import ScanPanel from '@/components/dashboard/ScanPanel';
```

Tambah baris render di dalam `<div className="mx-auto ...">`, setelah baris `statistik` (baris ~42):

```tsx
          {page === 'scan' && <ScanPanel />}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/dashboard/ScanPanel.tsx components/dashboard/DashboardSidebar.tsx app/dashboard/page.tsx
git commit -m "feat: halaman Scan Tiket di dashboard (kamera html5-qrcode + check-in)"
```

---

## Task 4: Statistik "Tiket Terjual"

**Files:**
- Modify: `components/dashboard/PengelolaStatistikPanel.tsx`
- Modify: `components/dashboard/StatistikPanel.tsx`

**Interfaces:**
- Consumes: data `bookings` via `onSnapshot` (PengelolaStatistikPanel sudah punya; StatistikPanel ditambahkan).

- [ ] **Step 1: `PengelolaStatistikPanel.tsx` — ganti kartu "Menunggu Konfirmasi" → "Tiket Terjual"**

Ganti baris `const pendingBookings = ...` (baris ~37) menjadi:

```tsx
  const usedTickets = bookings.filter((b) => b.status === 'used').length;
```

Ganti objek stat "Menunggu Konfirmasi" (baris ~65-75) menjadi:

```tsx
    {
      label: 'Tiket Terjual',
      value: usedTickets,
      color: 'bg-teal-100 text-teal-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      ),
    },
```

Ganti badge status di "Booking Terbaru" (baris ~138-144) menjadi (menambah penanganan `used`):

```tsx
                <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                  b.status === 'used' ? 'bg-shore-100 text-navy-soft' :
                  b.status === 'confirmed' ? 'bg-teal-100 text-teal-700' :
                  b.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {b.status === 'used' ? 'Sudah Digunakan' : b.status === 'confirmed' ? 'Dikonfirmasi' : b.status === 'cancelled' ? 'Dibatalkan' : 'Menunggu'}
                </span>
```

- [ ] **Step 2: `StatistikPanel.tsx` — subscribe bookings + kartu "Tiket Terjual"**

Tambah import Firestore di bawah baris import yang ada (baris ~4):

```tsx
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
```

Tambah state setelah `const [users, setUsers] = useState<AppUser[]>([]);` (baris ~8):

```tsx
  const [bookings, setBookings] = useState<{ status: string }[]>([]);
```

Tambah effect setelah `useEffect` yang sudah ada (baris ~14), sebelum `const totalPengelola`:

```tsx
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'bookings'), (snap) => {
      setBookings(snap.docs.map((d) => ({ status: (d.data().status as string) ?? '' })));
    });
    return () => unsub();
  }, []);

  const usedTickets = bookings.filter((b) => b.status === 'used').length;
```

Tambah objek stat ini sebagai elemen terakhir array `stats` (setelah objek "Admin", baris ~65):

```tsx
    {
      label: 'Tiket Terjual',
      value: usedTickets,
      color: 'bg-teal-100 text-teal-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      ),
    },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/PengelolaStatistikPanel.tsx components/dashboard/StatistikPanel.tsx
git commit -m "feat: statistik 'Tiket Terjual' (jumlah tiket discan) di dashboard"
```

---

## Verifikasi akhir (manual, setelah semua task)

1. `npm run dev`, login sebagai user → booking → muncul "Dikonfirmasi" + "Lihat Tiket" tanpa langkah bayar. Buka tiket → QR tampil.
2. Login sebagai admin/pengelola → dashboard → "Scan Tiket" → izinkan kamera → scan QR dari layar tiket → "Tiket valid" → "Konfirmasi Check-in" → "Check-in berhasil".
3. Statistik → kartu "Tiket Terjual" bertambah 1. Scan ulang tiket sama → "Tiket sudah digunakan". Tiket itu kini di "Riwayat" user (badge "Sudah Digunakan"), hilang dari "Booking Berlangsung".
4. Jika check-in error karena izin Firestore → perlu update rules di Firebase console (izinkan admin/pengelola update status booking). Lihat catatan risiko di spec.
```
