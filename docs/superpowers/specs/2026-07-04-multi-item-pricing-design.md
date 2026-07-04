# Sistem Harga Multi-Item Destinasi

**Tanggal:** 2026-07-04
**Status:** Disetujui

## Latar Belakang

Saat ini harga destinasi hanya satu angka (`priceStart`) yang tampil di depan card
(desktop & mobile), di halaman detail sebagai "Mulai dari Rp X /pax", dan dipakai
menghitung total booking (`priceStart × jumlah orang`). Destinasi butuh beberapa
jenis harga: tiket masuk, penginapan, penyewaan alat diving, dll.

## Keputusan Desain

1. **Peran harga:** item harga bisa dipilih saat booking; total dihitung dari pilihan.
2. **Bentuk item:** list dinamis bebas per destinasi (bukan kategori tetap).
3. **Qty booking:** tiap item punya stepper jumlah sendiri; "Jumlah Orang" tetap ada
   sebagai info rombongan tapi tidak dipakai menghitung total.
4. **Arsitektur data:** array `priceItems` embedded di dokumen `destinations`
   (bukan subcollection) — satu kali baca, tanpa perubahan security rules.
5. **Card depan:** harga dihapus total dari card; harga hanya tampil di dalam
   (halaman detail).

## Model Data (`lib/firestore.ts`)

```ts
export interface PriceItem {
  id: string;      // key React & edit admin — crypto.randomUUID()
  label: string;   // "Tiket Masuk", "Penginapan", "Sewa Alat Diving", ...
  price: number;   // rupiah, >= 0
  unit: string;    // "/pax", "/malam", "/set" — teks bebas
}
```

- `Destination.priceItems?: PriceItem[]` — field baru.
- `Destination.priceStart` — jadi opsional (legacy). Tidak dihapus dari interface
  agar dokumen lama tetap terbaca.
- Helper `getPriceItems(dest: Destination): PriceItem[]`:
  - jika field `priceItems` sudah ada (termasuk array kosong) → kembalikan
    apa adanya; array kosong berarti admin sengaja mengosongkan harga;
  - jika field belum ada (dokumen legacy) dan `priceStart > 0` → kembalikan
    satu item sintetis
    `{ id: 'legacy', label: 'Tiket Masuk', price: priceStart, unit: '/pax' }`;
  - selain itu → `[]`.
- `Booking.items?: { label: string; price: number; qty: number }[]` — snapshot
  rincian saat booking dibuat. `Booking.amount` tetap total keseluruhan sehingga
  PaymentModal & NotificationBell tidak berubah.
- `BookingInput` menyertakan `items`.

## Perubahan UI

### Card depan — `components/desktop/DesktopDestinationCard.tsx`, `components/mobile/DestinationCard.tsx`

- Hapus tampilan `Rp Xk /pax` beserta prop `priceStart` dari interface Props.
- Footer tinggal tombol **Booking** (posisi tetap di kanan). Call site aman karena
  card dipanggil via spread `{...dest}` (JSX spread mengizinkan prop berlebih).

### Halaman detail — `app/destinations/[id]/page.tsx`

- Card "Mulai dari … /pax" diganti card **"Daftar Harga"**: satu baris per item
  (`label — Rp harga /satuan`, format `Intl.NumberFormat id-ID`), tombol
  **Booking Sekarang** di bawah list.
- Sumber data: `getPriceItems(dest)` — destinasi legacy tetap tampil benar.
- `LiveMonitorSection` (monitoring) tidak disentuh.

### Halaman booking — `app/booking/page.tsx`

- Section baru **"Pilih Item"** setelah info destinasi: tiap item dari
  `getPriceItems(destination)` tampil dengan label, harga satuan, dan stepper qty
  (− / angka / +, clamp ≥ 0). Item pertama default qty 1, sisanya 0.
- **Estimasi total** = Σ (price × qty).
- Submit dinonaktifkan bila semua qty 0; `createBooking` menyimpan
  `items` (hanya yang qty ≥ 1) dan `amount` = total.
- "Jumlah Orang" tetap required dan disimpan di `guests`, tanpa efek ke total.
- Destinasi tanpa item harga sama sekali → tampilkan pesan
  "Destinasi ini belum punya daftar harga" dan submit dinonaktifkan.

### Panel admin — `components/dashboard/DestinasiPanel.tsx`

- Field "Harga Mulai (Rp)" diganti editor list dinamis: baris
  `[nama item] [harga] [satuan]`, tombol hapus per baris, tombol "Tambah Item".
  Harga di-clamp ≥ 0.
- `emptyForm` memakai `priceItems: []` (tanpa `priceStart`).
- Saat edit destinasi legacy (punya `priceStart`, `priceItems` kosong), editor
  terisi otomatis lewat `getPriceItems` — tersimpan sebagai `priceItems` saat
  disave (migrasi bertahap; `priceStart` tidak ditulis lagi).
- Baris list destinasi: "Lokasi — Rp X" menjadi "Lokasi — N item harga".

### Pembayaran — `components/notifications/PaymentModal.tsx`

- Jika `booking.items` ada, tampilkan rincian `label × qty — subtotal` di atas
  total. Booking lama tanpa `items` tampil seperti sekarang (total saja).

## Error Handling

- Qty stepper dan input harga admin di-clamp ke ≥ 0.
- Validasi submit booking: minimal satu item qty ≥ 1.
- Destinasi tanpa harga: booking diblokir dengan pesan jelas (bukan silent 0).

## Testing

Repo belum punya test infra; verifikasi manual via `npm run dev`:

1. Card beranda (desktop & mobile) tidak menampilkan harga.
2. Detail destinasi menampilkan daftar harga lengkap; destinasi legacy
   (hanya `priceStart`) menampilkan satu item "Tiket Masuk".
3. Booking end-to-end: pilih beberapa item, total benar, dokumen booking berisi
   `items` + `amount` benar; PaymentModal menampilkan rincian.
4. Admin: tambah/edit/hapus item harga; edit destinasi legacy memigrasi ke
   `priceItems`.
5. Booking lama (tanpa `items`) tetap tampil normal di riwayat & PaymentModal.

## Di Luar Scope

- Perubahan Firestore security rules (struktur koleksi tidak berubah).
- Perhitungan tanggal menginap (qty penginapan diisi manual, bukan dari rentang
  tanggal).
- Stok/kuota per item.
