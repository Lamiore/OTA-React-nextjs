# Tiket Instan + Scan Check-in — Design

**Tanggal:** 2026-06-19
**Status:** Disetujui (siap implementasi)

## Tujuan

1. Hapus tahap pembayaran sandbox. Booking langsung jadi tiket valid begitu dibuat.
2. Tambah halaman **Scan Tiket** di dashboard: petugas men-scan QR tiket via kamera untuk check-in.
3. Tiket yang discan tercatat sebagai **"Tiket Terjual"** di statistik (real-time).

**Di luar lingkup:** notifikasi pembayaran di ikon lonceng (menyusul / "nanti").

## Keputusan

- **Cara scan:** kamera saja (library `html5-qrcode`). Tidak ada input manual.
- **Hitungan "Tiket Terjual":** jumlah tiket/booking yang sudah discan (status `'used'`), bukan headcount. Berbeda dan tidak tumpang-tindih dengan kartu "Total Pengunjung" yang sudah ada.
- **Akses halaman scan:** role `admin` + `pengelola`.

## Model status & data (`lib/firestore.ts`)

- `createBooking` set `status: 'confirmed'` (sebelumnya `'pending'`). Tiket langsung valid.
- Union status jadi: `'pending' | 'confirmed' | 'cancelled' | 'used'`.
  - `'pending'` dipertahankan hanya untuk data lama; di UI diperlakukan sama seperti `'confirmed'`. Tidak ada migrasi.
- Tambah `checkInBooking(id)`: set `status: 'used'` + `checkedInAt: serverTimestamp()`.
- Tambah `checkedInAt?: unknown` ke interface `Booking`.

## Sisi user

### `BookingHistory.tsx`
- Hapus: modal pembayaran, tombol "Bayar Sekarang", `handlePay`, state `payingBooking`/`payingMethod`/`payProcessing`.
- Tiket `'confirmed'`/legacy `'pending'` yang belum lewat → tombol **"Lihat Tiket"** + **"Batalkan"** (cancel masih bisa karena tak ada lagi tahap pending).
- Tab "Booking Berlangsung" (`variant='active'`) menyembunyikan: `cancelled`, `used`, dan tanggal yang sudah lewat (`isPast`).
- Badge: `used` → **"Sudah Digunakan"** (abu); tampil di "Riwayat".

### `app/booking/page.tsx`
- Layar sukses: ganti teks "sedang diproses" → tiket sudah siap. CTA utama mengarah ke daftar booking aktif supaya user bisa langsung "Lihat Tiket".

## Halaman Scan (dashboard)

### `components/dashboard/ScanPanel.tsx` (baru)
- `'use client'`. Library `html5-qrcode` di-load via dynamic import (hindari masalah SSR Next 14).
- Mulai kamera → baca QR → parse payload `OTA-TICKET|{id}|{destinationName}|{date}` → ambil booking by `id`.
- Validasi & state hasil:
  - Parse gagal / bukan `OTA-TICKET` → "QR tidak valid."
  - Tiket tidak ditemukan → pesan error.
  - `cancelled` → "Tiket dibatalkan."
  - `used` → "Tiket sudah digunakan" (tampilkan `checkedInAt` bila ada).
  - Valid (`confirmed`/`pending`) → kartu detail (destinasi, nama, jumlah, tanggal) + tombol **"Konfirmasi Check-in"** → `checkInBooking(id)` → sukses → "Scan Lagi".
  - Izin kamera ditolak / kamera gagal → pesan error + tombol coba lagi.

### Wiring
- `DashboardSidebar.tsx`: tambah `DashboardPage` `'scan'` + menu "Scan Tiket" (roles `['admin','pengelola']`).
- `app/dashboard/page.tsx`: render `ScanPanel` untuk `page === 'scan'` (admin & pengelola).

## Statistik

- `PengelolaStatistikPanel.tsx`: kartu "Menunggu Konfirmasi" (kini selalu 0) → **"Tiket Terjual"** = `bookings.filter(b => b.status === 'used').length`. Sumber `onSnapshot` yang sudah ada.
- `StatistikPanel.tsx` (admin): tambah subscription `bookings` + kartu **"Tiket Terjual"** yang sama.

## Dependency

- Tambah `html5-qrcode` ke `package.json`.
- Kamera butuh `localhost` atau HTTPS (Vercel sudah HTTPS).

## Risiko

- Check-in menulis status ke booking milik user lain. Firestore rules dikelola di Firebase console (tidak ada di repo). Dashboard sudah membaca *semua* booking, jadi write kemungkinan diizinkan; jika check-in tertolak, rules di console perlu mengizinkan `admin`/`pengelola` meng-update status booking.

## Testing

- `npx tsc --noEmit` lolos.
- Manual: booking → tiket langsung muncul → buka dashboard "Scan Tiket" → scan QR → "Konfirmasi Check-in" → kartu "Tiket Terjual" bertambah; scan ulang tiket yang sama → "sudah digunakan".

## Touch points

`lib/firestore.ts`, `components/booking/BookingHistory.tsx`, `app/booking/page.tsx`,
`components/dashboard/DashboardSidebar.tsx`, `app/dashboard/page.tsx`,
`components/dashboard/ScanPanel.tsx` (baru), `components/dashboard/PengelolaStatistikPanel.tsx`,
`components/dashboard/StatistikPanel.tsx`, `package.json`.
