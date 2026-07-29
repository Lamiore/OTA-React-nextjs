# Perjanjian Mitra & Pengelola — Desain

Tanggal: 30 Juli 2026
Dua dokumen dirancang di sini, keduanya **v1.0**, berlaku 30 Juli 2026:
Perjanjian Mitra dan Perjanjian Pengelola.

## Masalah

Form pengajuan naik role (`components/cameras/VerificationForm.tsx`) — dipakai
bersama oleh pengajuan mitra dan pengelola — hanya meminta nama, no. HP,
instansi, dan (untuk pengelola) pilihan destinasi. Tidak ada satu pun penjelasan
hak, kewajiban, maupun konsekuensi finansial, padahal kedua role membawa
kewajiban belanja yang nilainya nyata:

1. **Mitra membeli kamera dari Lautara**, dan pemasangannya dilakukan petugas
   Lautara.
2. **Pengelola membeli paket sensor IoT dari Lautara** untuk destinasi yang
   dikelolanya, juga dipasang petugas Lautara. Kamera bagi pengelola dianjurkan
   tetapi tidak diwajibkan; bila dipasang, ketentuan beli-dan-pasangnya sama.
3. Pengelola menerima pembayaran booking **langsung dari pengunjung**, di luar
   platform.

Tidak satu pun pernah dinyatakan di mana pun. Orang bisa jadi mitra atau
pengelola tanpa tahu dia harus beli alat, dan platform tidak punya bukti bahwa
dia pernah diberitahu.

## Kondisi kode saat ini

Fakta yang membentuk desain ini, hasil pembacaan kode per 30 Juli 2026:

- **Tidak ada logika bagi hasil.** Grep `komisi|commission|revenue|payout|fee`
  di seluruh source: nol hasil.
- **Uang tidak pernah melewati platform.** `app/booking/page.tsx` menghitung
  `total` hanya untuk ditampilkan; `createBooking` (`lib/firestore.ts:430`)
  langsung menulis `status: "confirmed"` tanpa menunggu pembayaran. Field
  `paymentStatus`/`paymentMethod`/`paidAt` ada di tipe `Booking` tapi di-`Omit`
  pada `BookingInput` — tidak pernah terisi. Metode bayar yang ditawarkan
  (transfer bank, e-wallet, tunai di lokasi) semuanya diselesaikan di luar
  aplikasi. Midtrans belum terpasang.
- **Paket sensor sudah nyata.** `Destination.hasMonitoring` dan
  `Destination.stationId` menentukan cabang RTDB `monitoring/<stationId>/latest`
  (`lib/realtime.ts`, `stationPath`). Firmware ada di `firmware/weather_station`
  dan `firmware/WeatherStation_RTDB`. Bacaan: suhu udara (DHT), kelembapan, suhu
  air (DS18B20), status & nilai hujan, kecepatan angin, debit air, plus GPS.
  `stationId` di-set admin dari `components/dashboard/DestinasiPanel.tsx` —
  provisioning lewat admin, bukan self-service.
- **Alur pengajuan** — `PengelolaRequest.tsx` → `VerificationForm.tsx` →
  `submitRoleRequest` menulis `users/{uid}.verification` dengan
  `requestedRole: "pengelola"` → admin menyetujui dari `PenggunaPanel` → role
  akun naik.

Konsekuensinya: perjanjian ini tidak boleh menjanjikan mekanisme finansial yang
mesinnya belum ada.

## Keputusan

| Hal | Keputusan |
|---|---|
| Komisi booking | **Belum ada potongan.** Platform mencadangkan hak memberlakukannya kemudian, dengan pemberitahuan minimal 30 hari dan hak pengelola berhenti tanpa penalti. |
| Kepemilikan perangkat | **Dibeli dari Platform**, dipasang petugas Platform, lalu menjadi hak milik penuh pembelinya setelah lunas. Berlaku untuk paket IoT maupun kamera. |
| Perangkat wajib — mitra | **Kamera.** Satu-satunya perangkat yang relevan bagi mitra. |
| Perangkat wajib — pengelola | **Paket IoT wajib; kamera dianjurkan tapi tidak wajib.** Status pengelola tidak bergantung pada ada-tidaknya kamera. |
| Penegakan asal perangkat | Lewat gerbang persetujuan admin yang sudah ada — `addCamera` menulis `status: "pending"` dan admin menolak kamera yang bukan pasangan Platform. Dokumen menyatakan ini eksplisit supaya bukan janji kosong. |
| Waktu pembelian alat | **Setelah pengajuan disetujui admin.** Tidak ada pembayaran di muka sebelum diterima. |
| Garansi alat | **3 bulan** untuk cacat produksi, sama untuk kamera dan paket IoT. |
| Penempatan dokumen | Dua halaman terpisah, `/syarat-mitra` dan `/syarat-pengelola`, masing-masing di-link dari checkbox di form sesuai role. |
| Kenapa dua dokumen | Isinya beda jauh — mitra tidak mengurus destinasi, harga, pesanan, maupun bagi hasil. Yang disetujui harus persis dokumen yang berlaku baginya. |
| Cakupan persetujuan | Hanya pengajuan baru. Mitra dan pengelola yang sudah disetujui tidak diminta menyetujui ulang. |
| Role yang terdampak | Keduanya, `mitra` dan `pengelola`. Checkbox selalu muncul; tautan, label, dan versinya mengikuti role. |

## Komponen

Empat berkas baru (`lib/verification.ts`, dua halaman perjanjian, dan
`lib/verification.check.ts`) dan empat berkas diubah (`lib/firestore.ts`,
`VerificationForm.tsx`, `PenggunaPanel.tsx`, serta `lib/format.ts` beserta
berkas ceknya).

### `app/syarat-mitra/page.tsx` dan `app/syarat-pengelola/page.tsx` (baru)

Dua halaman statis berisi teks perjanjian masing-masing. Server component, tanpa
state dan tanpa data fetching. Kepala halaman menampilkan nomor versi — dibaca
dari `AGREEMENT[role].version`, sumber yang sama dengan yang disimpan saat
persetujuan, supaya versi yang dibaca dan versi yang tercatat tidak pernah
berbeda — serta tanggal berlaku, yang ditulis langsung di teks halaman karena
hanya dipakai di satu tempat.

Keduanya memakai susunan yang sama: array `PASAL` berisi `{ judul, ayat[] }`,
dirender jadi `<section>` dengan `<ol>`. Teksnya data, bukan JSX bersarang —
mengubah pasal berarti mengubah string, bukan markup.

### `lib/verification.ts` (baru)

Modul murni **tanpa satu pun import**, mengikuti pola `lib/format.ts`. Berisi
tabel perjanjian per role dan fungsi validasi form:

```ts
export const AGREEMENT = {
  mitra:     { version: "1.0", path: "/syarat-mitra",     label: "Perjanjian Mitra" },
  pengelola: { version: "1.0", path: "/syarat-pengelola", label: "Perjanjian Pengelola" },
} as const;

export function validateRoleRequest(input): string | null;
```

Satu tabel, bukan enam konstanta lepas: versi, tautan, dan label dipakai
bersama-sama oleh form, halaman perjanjian, dan pesan kesalahan — memisahkannya
hanya mengundang ketiganya menyebut nilai yang berbeda. Versi dinaikkan per role
saat dokumen yang bersangkutan berubah.

Kenapa berkas terpisah, bukan ditaruh di `lib/firestore.ts`: berkas cek berbasis
`node` dijalankan tanpa bundler (`node lib/verification.check.ts`). `format.ts`
bisa diuji begitu justru karena nol import — kalau validasi ditaruh di
`firestore.ts`, berkas cek akan menarik seluruh SDK Firebase dan gagal jalan.
Konstanta versi ikut di sini supaya halaman perjanjian bisa mengimpornya tanpa
menyeret SDK Firebase ke dalam server component.

### `lib/firestore.ts`

`MitraVerification` mendapat dua field opsional, dan parameter `data` pada
`submitRoleRequest` diperluas dengan keduanya:

```ts
/** Versi Perjanjian Pengelola yang disetujui. Kosong pada pengajuan mitra
 *  dan pengajuan pengelola sebelum v1.0 terbit. */
agreementVersion?: string;
/** Waktu checkbox persetujuan dicentang (serverTimestamp). */
agreedAt?: unknown;
```

`unknown`, bukan `Timestamp` — mengikuti `submittedAt` dan `reviewedAt` yang
sudah ada di antarmuka yang sama (`lib/firestore.ts:150-151`).

Opsional, bukan wajib: dokumen pengajuan `mitra` dan pengajuan pengelola lama
tidak punya field ini dan tidak boleh dianggap rusak.

### `components/cameras/VerificationForm.tsx`

- State `agreed`, selalu diinisialisasi `false`.
- Checkbox dirender hanya bila `isPengelola`, di bawah pilihan destinasi.
  Label memuat tautan ke `/syarat-pengelola` dengan
  `target="_blank" rel="noopener"`.
- Validasi menolak submit bila `isPengelola && !agreed`.
- `agreementVersion` dan `agreedAt` ikut dikirim, hanya saat `isPengelola`.

### `components/dashboard/PenggunaPanel.tsx`

Satu baris pada kartu pengajuan pengelola: `Setuju Perjanjian v1.0 · 30 Jul 2026`.
Bila `agreementVersion` kosong, baris tidak dirender.

`lib/format.ts` belum punya pemformat tanggal, jadi ditambahkan `formatTimestamp`
di sana — Firestore `Timestamp` masuk sebagai `unknown`, fungsi ini menyempitkan
tipenya lewat `.toDate?.()` dan mengembalikan `null` bila bentuknya bukan
timestamp. Uji kasusnya menyusul di `lib/format.check.ts` yang sudah ada.

Tanpa ini, bukti persetujuan tersimpan di Firestore tapi tidak pernah terlihat
oleh siapa pun — audit trail yang tidak bisa dibaca sama saja dengan tidak ada.

## Isi dokumen — Perjanjian Pengelola

Sepuluh pasal. Untuk tiap pasal dicatat substansi yang wajib ada, bukan
kalimat finalnya.

**1. Ruang lingkup.** Definisi pengelola; destinasi yang dikelola ditetapkan
admin, bukan dipilih bebas; hubungan ini bukan hubungan kerja — pengelola bukan
karyawan platform dan tidak menerima upah.

**2. Hak pengelola.** Mengelola data destinasi dan daftar harganya; melihat dan
mengonfirmasi booking di destinasinya; mendaftarkan kamera; mengakses statistik
dan bacaan sensor wilayahnya.

**3. Kewajiban pengelola.** Menjaga akurasi data (harga, ketersediaan, jadwal);
merespons booking dalam waktu wajar; menjaga kerahasiaan akun; mematuhi
peraturan yang berlaku dan menjaga keselamatan pengunjung.

**4. Paket pemantauan IoT.** Pasal terpanjang, sepuluh ayat:

1. Destinasi yang dikelola wajib terpasang paket sensor. Dinyatakan tegas
   sebagai **satu-satunya perangkat yang diwajibkan** — pembeda dari kamera di
   Pasal 5.
2. Paket **dibeli dari platform dan dipasang oleh petugas platform**. Perangkat
   sejenis yang dibeli atau dipasang sendiri tidak dihubungkan ke sistem.
3. Setelah lunas, paket menjadi hak milik pengelola sepenuhnya.
4. Pembelian dan pemasangan dikoordinasikan **setelah** pengajuan disetujui.
   Tidak ada pembayaran apa pun sebelum pengajuan diterima.
5. Isi paket dan harganya mengacu pada daftar yang berlaku, diinformasikan
   terpisah sebelum pembelian. Angka **tidak** dicantumkan di perjanjian —
   perubahan harga tidak boleh memaksa penerbitan versi perjanjian baru.
6. Garansi 3 bulan sejak pemasangan untuk cacat produksi.
7. Kerusakan akibat bencana alam, kelalaian, vandalisme, pencurian, petir, atau
   modifikasi sendiri di luar garansi.
8. Pengelola menyediakan sumber listrik dan koneksi internet di titik pemasangan,
   serta akses bagi petugas platform.
9. Alat milik pengelola, namun pengelola memberi lisensi kepada platform untuk
   menampilkan bacaan sensornya di halaman publik destinasi selama ia menjabat.
10. Bila berhenti jadi pengelola: alat tetap miliknya; platform berhenti
    menampilkan datanya dan mengosongkan `stationId` pada dokumen destinasi.
    Ini tindakan administratif oleh admin lewat `DestinasiPanel` yang sudah ada —
    tidak ada otomatisasi yang perlu dibangun untuk pasal ini.

**5. Kamera pemantau (tidak wajib).** Lima ayat:

1. Kamera dianjurkan, bukan kewajiban. Status pengelola tidak bergantung padanya.
2. Bila dipasang untuk ditayangkan di Lautara, kamera dibeli dari platform dan
   dipasang petugas platform.
3. Setiap kamera melewati persetujuan admin sebelum tayang; yang bukan pasangan
   platform tidak akan disetujui. Ini bukan klausul kosong — `addCamera` memang
   menulis `status: "pending"` dan admin yang meloloskannya.
4. Ketentuan kepemilikan, garansi, listrik/internet, dan pengakhiran pada Pasal 4
   berlaku sama bagi kamera.
5. Tanpa kamera, halaman destinasi tetap tayang; hanya blok tayangan langsung
   yang tidak muncul — persis perilaku `LiveMonitorPanel` yang sudah ada.

**6. Booking dan pembayaran.** Pengunjung membayar langsung kepada pengelola di
luar platform. Platform hanya mencatat pesanan dan menerbitkan tiket. **Platform
bukan pihak dalam transaksi antara pengunjung dan pengelola.**

Pasal ini bukan formalitas. Karena uang tidak melewati platform, dokumen harus
tegas memposisikan platform sebagai pencatat, bukan penjual — tanpa itu platform
berisiko ditarik sebagai pelaku usaha yang ikut bertanggung jawab atas layanan di
destinasi yang tidak dikendalikannya (UU No. 8/1999 tentang Perlindungan
Konsumen).

**7. Bagi hasil.** Saat ini platform tidak memungut potongan apa pun dari
pendapatan destinasi. Bila kemudian diberlakukan, pengelola diberitahu minimal 30
hari sebelumnya dan berhak berhenti tanpa penalti.

**8. Tanggung jawab.** Pengelola bertanggung jawab atas layanan dan keselamatan
di destinasinya. Batas tanggung jawab platform dinyatakan tegas.

**9. Data pribadi pengunjung.** Data pengunjung yang terlihat di dashboard hanya
boleh dipakai untuk keperluan booking; dilarang untuk tujuan lain.

**10. Penangguhan, pengakhiran, dan perubahan.** Admin dapat mencabut role bila
terjadi pelanggaran; pengelola dapat mundur kapan saja; perubahan perjanjian
ditandai dengan kenaikan nomor versi dan diberitahukan kepada pengelola aktif.

## Isi dokumen — Perjanjian Mitra

Delapan pasal. Sengaja lebih pendek: mitra tidak mengurus destinasi, harga,
pesanan, maupun bagi hasil, jadi pasal-pasal itu tidak ada di sini sama sekali.

**1. Ruang lingkup.** Definisi mitra kamera; mitra mendaftarkan dan
mengoperasikan kamera yang tayangannya bisa muncul di halaman destinasi;
dinyatakan tegas bahwa mitra **tidak** mengelola data destinasi, harga, atau
pesanan; bukan hubungan kerja.

**2. Hak mitra.** Mendaftarkan kamera lewat halaman Kamera; melihat tayangan,
riwayat, dan statistik deteksi kameranya sendiri; mengetahui status tiap kamera
(menunggu, disetujui, ditolak).

**3. Kewajiban mitra.** Data pendaftaran benar; kamera menyala dan terhubung
sepanjang jam operasional; menjaga kerahasiaan akun dan ID siaran; mematuhi
peraturan termasuk soal perekaman di ruang publik.

**4. Perangkat kamera.** Pasal terpanjang, sepuluh ayat, bercermin pada Pasal 4
pengelola: dibeli dari platform dan dipasang petugas platform; melewati
persetujuan admin dan yang bukan pasangan platform tidak disetujui; jadi hak
milik mitra setelah lunas; pembelian setelah pengajuan disetujui; harga terpisah
dari dokumen; garansi 3 bulan dengan pengecualian yang sama; listrik dan internet
disediakan mitra; lisensi penayangan selama berstatus mitra; berhenti berarti
kamera tetap miliknya dan ID siarannya diputus.

**5. Isi tayangan dan privasi.** Kamera diarahkan ke area publik; dilarang ke
kamar, kamar mandi, atau ruang ganti; mitra memasang pemberitahuan terlihat di
lokasi; platform dapat menghentikan penayangan bila melanggar privasi,
kesusilaan, atau peraturan.

Pasal ini tidak punya padanan di dokumen pengelola dan justru yang paling
berisiko bagi platform — kamera publik yang salah arah menyeret Lautara sebagai
penayang, bukan sekadar pencatat.

**6. Biaya.** Tidak ada biaya langganan atau penayangan; satu-satunya biaya
adalah pembelian perangkat di Pasal 4. Bila kelak diberlakukan, berlaku
pemberitahuan 30 hari dan hak berhenti tanpa penalti — sejajar dengan pasal bagi
hasil di dokumen pengelola.

**7. Tanggung jawab.** Mitra bertanggung jawab atas pemasangan, keamanan, dan isi
tayangan; batas tanggung jawab platform atas gangguan listrik/jaringan;
**hasil deteksi otomatis dinyatakan sebagai perkiraan, tidak dijamin akurat.**

**8. Penangguhan, pengakhiran, dan perubahan.** Sama polanya dengan Pasal 10
dokumen pengelola.

## Alur data

```
user centang + submit
  → validateRoleRequest() menolak bila !agreed, apa pun rolenya
  → submitRoleRequest(uid, { ..., agreementVersion: AGREEMENT[role].version })
  → agreedAt distempel di dalam submitRoleRequest dengan serverTimestamp()
  → users/{uid}.verification
  → PenggunaPanel menampilkan bukti persetujuan ke admin
  → admin approve → role = mitra | pengelola
  → [di luar aplikasi] koordinasi pembelian & pemasangan perangkat
  → mitra    : daftarkan kamera → status "pending" → admin approve → stream tayang
  → pengelola: admin set stationId di DestinasiPanel → sensor tampil di halaman publik
```

Dokumen mana yang disetujui tidak perlu field sendiri: pasangan
(`requestedRole`, `agreementVersion`) sudah menentukannya secara unik, dan
`requestedRole` memang sudah tersimpan di dokumen yang sama.

## Penanganan kesalahan

- Belum mencentang → pesan kesalahan inline lewat `setError` yang sudah ada;
  submit diblokir.
- `agreed` selalu dimulai `false`, termasuk pada "Ajukan Ulang" setelah ditolak.
  Sengaja tidak diwarisi dari prop `initial`: persetujuan harus baru pada tiap
  pengajuan, karena isi perjanjian bisa sudah berubah sejak pengajuan pertama.
- Tautan dibuka di tab baru (`target="_blank" rel="noopener"`) supaya isian form
  yang belum dikirim tidak hilang.
- Firestore menolak nilai `undefined`. `agreementVersion` selalu terisi (kedua
  role punya dokumennya), sedangkan `destination` tetap hanya di-spread saat
  `isPengelola`, mengikuti pola yang sudah ada di `VerificationForm.tsx`.

## Pengujian

Rantai `if` di `handleSubmit` diekstrak menjadi fungsi murni di
`lib/verification.ts`:

```ts
validateRoleRequest(input): string | null
```

Mengembalikan pesan kesalahan atau `null` bila lolos. `handleSubmit` memanggilnya
alih-alih memeriksa sendiri — jumlah baris kira-kira tetap, logikanya berpindah,
bukan bertambah.

Berkas `lib/verification.check.ts` mengikuti pola `lib/format.check.ts` yang sudah
ada: berbasis `assert`, tanpa framework, dijalankan dengan
`node lib/verification.check.ts` (Node 26 menanggalkan tipe secara bawaan). Kasus
yang diuji:

1. Field wajib kosong → pesan kesalahan, untuk kedua role, termasuk isian yang
   hanya berisi spasi.
2. Pengelola tanpa memilih destinasi → pesan kesalahan.
3. Belum menyetujui → pesan kesalahan yang **menyebut dokumen sesuai rolenya**
   ("Perjanjian Mitra" vs "Perjanjian Pengelola").
4. `agreed` tidak diisi sama sekali → diperlakukan sama dengan belum dicentang.
5. Urutan pemeriksaan: field kosong dan destinasi didahulukan atas persetujuan,
   supaya orang tidak disuruh menyetujui perjanjian untuk form yang belum
   lengkap.
6. Lengkap dan sudah menyetujui → lolos, untuk kedua role.
7. Tabel `AGREEMENT`: tiap role punya versi terisi, tautan diawali `/`, label
   terisi, dan tautan maupun label kedua role berbeda satu sama lain.

## Di luar cakupan

- Mesin komisi, payout, saldo, dan rekonsiliasi — tidak ada uang yang melewati
  platform, jadi tidak ada yang bisa dipotong.
- Katalog dan harga perangkat (kamera maupun paket IoT) di Firestore — pembelian
  dikoordinasikan manual.
- Permintaan persetujuan ulang bagi mitra dan pengelola yang sudah disetujui.
- Pemeriksaan versi otomatis dan alur re-consent saat versi naik. Nomor versi
  tetap disimpan sekarang supaya ini bisa ditambahkan kelak tanpa migrasi data.
- Penegakan asal-usul perangkat di dalam kode. Pembatasan bahwa kamera harus
  pasangan platform ditegakkan lewat gerbang approve admin yang sudah ada
  (`addCamera` → `status: "pending"`), bukan lewat validasi baru. `source: "push"`
  tetap menerima kamera HP mana pun; admin yang menolaknya. Kalau kelak ini terasa
  terlalu longgar, batasi pilihan `source` di UI — bukan di dokumen.
- Unduh PDF perjanjian.
