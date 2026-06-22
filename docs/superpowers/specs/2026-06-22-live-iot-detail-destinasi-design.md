# Live IoT di Detail Destinasi — Design

**Tanggal:** 2026-06-22
**Branch:** coral-python-improvements

## Masalah

Beranda menampilkan banyak destinasi, tapi hanya **satu** lokasi yang punya hardware
sensor + kamera fisik (stasiun tunggal, data global di Firebase RTDB `monitoring/latest`).
Menampilkan IoT/kamera di semua card akan jadi data palsu dan merusak kepercayaan.

Tujuan: ketika user membuka detail destinasi yang **memang** punya stasiun, tampilkan
ringkasan **sensor IoT live** di dalam halaman detail itu. Kamera tetap di `/monitoring`
(tidak digandakan).

## Keputusan

- **Hanya 1 stasiun**, sekarang dan realistis ke depan → tidak perlu arsitektur multi-stasiun.
- **Sensor saja di detail; tanpa kamera.** Kamera tetap hidup di `/monitoring`.
- Tandai destinasi pemilik stasiun dengan satu field boolean.

## Lingkup

### 1. Data — field penanda
Tambah `hasMonitoring?: boolean` ke interface `Destination` (`lib/firestore.ts`).
Optional/back-compat: dokumen lama tanpa field diperlakukan sebagai `false`.
Hanya destinasi stasiun yang di-set `true`.

Toggle di admin `DestinasiPanel` (form tambah/edit destinasi) supaya flag bisa
dinyalakan/dimatikan tanpa membuka Firebase console. Disimpan via
`addDestination` / `updateDestination` yang sudah ada.

### 2. Komponen `LiveMonitorSection`
Lokasi: `components/destinations/LiveMonitorSection.tsx` (client component).

- Subscribe ke `subscribeMonitoring` dari `lib/realtime.ts` (sumber `monitoring/latest`).
- Tampilkan 4 chip sensor paling relevan untuk wisatawan:
  - **Suhu Air** — `tempDS18` (°C)
  - **Kondisi Cuaca** — `rainStatus` (+ `rainValue` bila ada)
  - **Kecepatan Angin** — `windSpeed` (km/h)
  - **Suhu Udara** — `tempDHT` (°C)
- Pill **Live / Offline / Menghubungkan…** berdasarkan umur data
  (`updatedAt`, live bila < 15 detik) — pola sama seperti `SensorPanel`.
- Tombol **"Lihat monitoring lengkap →"** menuju `/monitoring` (di sana ada kamera +
  sensor lengkap + stats).
- Format angka pakai helper `fmt` (nilai `--` saat data belum ada / NaN), konsisten
  dengan `SensorPanel`.

### 3. Halaman detail
`app/destinations/[id]/page.tsx`: render `<LiveMonitorSection />` **hanya bila**
`dest.hasMonitoring` true. Posisi: setelah kartu deskripsi, sebelum kartu harga.

## Di luar lingkup (sengaja)

- **Badge LIVE di card beranda** — tidak diminta, dan menyentuh wiring grid
  (`DesktopDestinationGrid` / list mobile) yang membawa risiko regresi tanpa nilai
  yang diminta. Perilaku badge `isLive` yang sekarang dibiarkan apa adanya.
- **Perubahan firmware** — tidak ada. Sensor sudah berjalan; ini murni website.
- **Multi-stasiun / mapping per-destinasi** — YAGNI, hanya 1 stasiun.

## Risiko & catatan

- Camera tidak tersentuh sama sekali (`CameraPanel`, `CAMERA_URL`) → tanpa regresi
  pada `/monitoring`.
- Data sensor global; karena cuma 1 stasiun, menampilkannya di 1 destinasi ber-flag
  tetap jujur. Jika kelak ada stasiun ke-2, field bisa berevolusi jadi
  `monitoringId` yang map ke path RTDB sendiri.
