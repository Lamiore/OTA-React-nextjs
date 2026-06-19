# Spec: Notifikasi & Pembayaran Pasca-Scan (Pay-on-Arrival)

**Tanggal:** 2026-06-19
**Status:** Disetujui (siap rencana implementasi)

## Ringkasan

Setelah operator (`pengelola`) men-scan QR tiket pengunjung di lokasi (check-in),
pengunjung menerima **notifikasi di app-nya** (lewat ikon lonceng yang sudah ada)
dan dapat **memilih metode pembayaran** (mock/tampilan saja) untuk menyelesaikan
tagihan. Ini menambahkan model **pay-on-arrival**: pengunjung booking gratis, datang,
di-scan, lalu membayar.

## Keputusan (hasil brainstorming)

1. **Audiens:** pengunjung (`user`), di app-nya sendiri.
2. **Pembayaran:** mock / tampilan pilihan saja — tidak ada gateway nyata, tanpa
   server/API key. Memilih metode hanya mengubah status booking.
3. **Tampilan notif:** ikon lonceng (yang sudah ada) jadi berfungsi — badge jumlah +
   dropdown daftar; notif "silakan bayar" punya tombol **Bayar** yang membuka modal
   metode pembayaran (pakai pola portal modal yang sudah diperbaiki).
4. **Arsitektur (Pendekatan B):** notifikasi **diturunkan dari data booking**, bukan
   koleksi terpisah. Tidak ada koleksi `notifications`, tidak ada cross-owner write,
   tidak ada indeks/aturan Firestore baru.

## Model Data

Perubahan pada `lib/firestore.ts` interface `Booking`:

```ts
export interface Booking {
  // ...field lama...
  amount?: number;                          // total = priceStart × guests, disimpan saat booking
  paymentStatus?: "unpaid" | "paid";        // default "unpaid" untuk booking baru
  paymentMethod?: string;                   // diisi saat pengunjung memilih metode
  paidAt?: unknown;                         // serverTimestamp saat dibayar
}
```

- `BookingInput` ditambah `amount: number`.
- `createBooking` menyimpan `amount` + `paymentStatus: "unpaid"`.
- `checkInBooking` **tidak berubah** (tetap transaksional, set `status: "used"`).
- Fungsi baru `payBooking(id, method)`:
  ```ts
  await updateDoc(doc(db, "bookings", id), {
    paymentStatus: "paid",
    paymentMethod: method,
    paidAt: serverTimestamp(),
  });
  ```
  Dijalankan oleh pengunjung pada booking miliknya sendiri (izin sudah ada).

**Definisi "notifikasi bayar":** booking milik user di mana
`status === "used" && paymentStatus === "unpaid"`.

**Booking lama** (sebelum fitur) tidak punya `paymentStatus` → dianggap tidak
bertagihan (tidak memunculkan notif), agar tidak menyampah.

## Komponen

### `components/notifications/NotificationBell.tsx`
- Prop: `variant: "light" | "dark"` (light = TopNav, dark = MobileHeader).
- Subscribe `bookings where userId == currentUser.uid` (filter `used && unpaid`
  di klien — tanpa indeks komposit). Pakai `useAuthState()` untuk uid.
- Render: tombol lonceng + **badge angka** (jumlah notif), dropdown daftar notif.
  - Item notif: nama destinasi, teks "Check-in berhasil · silakan selesaikan
    pembayaran", total (`amount`), tombol **Bayar**.
  - Daftar kosong → "Tidak ada notifikasi".
- Klik **Bayar** → buka `PaymentModal` untuk booking tsb.
- Dropdown: panel `absolute` di bawah lonceng (bukan `fixed`, jadi aman dari isu
  containing-block); tutup saat klik di luar.

### `components/notifications/PaymentModal.tsx`
- Pakai **pola portal + scroll-safe** yang sama dengan `TicketModal`
  (`createPortal` ke `document.body`, `overflow-y-auto` + `min-h-full flex
  items-center`, guard `mounted`).
- Tampilkan: destinasi, total (`amount`), daftar opsi metode — **Transfer Bank**,
  **E-wallet**, **Tunai di lokasi** (radio/daftar pilih).
- Tombol **Konfirmasi Pembayaran** → `payBooking(id, method)` → state sukses singkat
  ("Pembayaran berhasil") → modal bisa ditutup; notif hilang otomatis (real-time).
- Tangani error (gagal update) dengan pesan terlihat, tidak silent.

### Integrasi
- `components/desktop/TopNav.tsx` — ganti `<button aria-label="Notifikasi">` statis
  dengan `<NotificationBell variant="light" />`.
- `components/mobile/MobileHeader.tsx` — ganti tombol lonceng statis dengan
  `<NotificationBell variant="dark" />`.
- `app/booking/page.tsx` — kirim `amount: destination.priceStart * form.guests` ke
  `createBooking`.

## Alur End-to-End

1. Pengunjung booking → `status: "confirmed"`, `paymentStatus: "unpaid"`, `amount` tersimpan.
2. Di lokasi, operator buka **Scan Tiket** → scan QR → `checkInBooking` → `status: "used"`.
3. Bell pengunjung (subscribe real-time) melihat booking jadi `used && unpaid`
   → badge muncul, notif "silakan bayar".
4. Pengunjung tap **Bayar** → PaymentModal → pilih metode → **Konfirmasi**.
5. `payBooking` set `paid` → notif hilang dari bell, badge berkurang.

## Penanganan Error & Edge Case

- Tidak login / `db` null → bell tidak menampilkan apa-apa (tanpa crash).
- `payBooking` gagal → pesan error di modal, status tetap `unpaid` (bisa diulang).
- Booking tanpa `amount` (data lama yang sudah `used`) → tidak memunculkan notif
  (tidak `paymentStatus: "unpaid"`).
- Klik metode ganda / saat memproses → tombol disabled selama proses.

## Out of Scope (YAGNI)

- Gateway pembayaran nyata, server, webhook.
- Koleksi `notifications` umum & jenis notif lain (hanya "payment-due").
- Read/unread terpisah (status bayar = aksi; lunas otomatis hilang dari badge).
- Halaman `/notifikasi` khusus.
- Notifikasi/riwayat "pembayaran berhasil" yang persisten.

## Testing / Verifikasi

- Typecheck `npx tsc --noEmit` bersih.
- Manual: booking → scan (akun pengelola) → cek bell pengunjung muncul badge →
  bayar → badge hilang. Cek di viewport mobile (MobileHeader) & desktop (TopNav).
