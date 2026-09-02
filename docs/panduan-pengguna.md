# Panduan Pengguna — Nusa

**Guide Book · Sistem OTA "Nusa"**
Platform pemesanan tiket destinasi selam & pesisir dengan pemantauan kondisi
perairan secara langsung.

Berlaku untuk aplikasi web Nusa (Next.js).

---

## Daftar Isi

1. [Tentang Nusa](#1-tentang-nusa)
2. [Sebelum Mulai](#2-sebelum-mulai)
3. [Mengenal Layar](#3-mengenal-layar)
4. [Peran Akun](#4-peran-akun)
5. [Panduan Wisatawan](#5-panduan-wisatawan)
6. [Panduan Pengelola](#6-panduan-pengelola)
7. [Panduan Admin](#7-panduan-admin)
8. [Masalah Umum](#8-masalah-umum)
9. [Daftar Istilah](#9-daftar-istilah)

---

## 1. Tentang Nusa

Nusa adalah platform **OTA (*Online Travel Agency*)** untuk destinasi selam dan
pesisir. Yang bisa dilakukan di sini:

- **Mencari destinasi** wisata bahari beserta daftar harga tiket dan sewa alatnya.
- **Memesan tiket** untuk tanggal tertentu, membayar lewat QRIS, dan menerima
  **tiket QR** yang dipindai petugas saat check-in.
- **Memantau kondisi perairan** secara langsung — kamera bawah air yang
  dianalisis AI untuk mengenali jenis dan kesehatan terumbu karang, ditambah
  data sensor lingkungan (suhu, kelembapan, curah hujan, kecepatan angin,
  arus air) dari stasiun IoT yang terpasang di lokasi.

Yang membedakan Nusa dari OTA biasa adalah poin ketiga: calon pengunjung bisa
melihat keadaan perairan sebelum memutuskan berangkat.

---

## 2. Sebelum Mulai

### Perangkat dan browser

| Kebutuhan | Keterangan |
|---|---|
| Perangkat | Ponsel, tablet, atau komputer — tampilannya menyesuaikan sendiri |
| Browser | Chrome, Safari, Edge, atau Firefox versi terbaru |
| Koneksi | Wajib untuk memesan dan membayar. Halaman yang pernah dibuka masih bisa dilihat sebagian saat sinyal hilang |
| Kamera perangkat | Hanya diperlukan petugas yang memindai tiket (menu **Scan Tiket**) |

### Memasang Nusa sebagai aplikasi (opsional)

Nusa adalah **PWA** — bisa dipasang ke layar utama supaya terbuka seperti
aplikasi biasa, tanpa bilah alamat browser.

- **Android (Chrome):** buka menu ⋮ → **Tambahkan ke layar utama**.
- **iPhone/iPad (Safari):** tombol Bagikan → **Tambahkan ke Layar Utama**.
- **Komputer (Chrome/Edge):** ikon pasang di ujung kanan bilah alamat.

### Bahasa dan tampilan

Nusa tersedia dalam **Bahasa Indonesia** dan **English**, serta punya **mode
terang dan mode gelap**. Keduanya diatur di **Profil › Pengaturan** dan
tersimpan di perangkat masing-masing. Bawaannya: Bahasa Indonesia, mode terang.

---

## 3. Mengenal Layar

Navigasi Nusa berisi empat tujuan yang sama, hanya tempatnya yang berbeda:

- **Di komputer** — bilah atas (kiri: logo Nusa; kanan: menu, lonceng
  notifikasi, dan avatar akun).
- **Di ponsel** — bilah melayang di bawah layar, dengan tombol **Booking**
  berbentuk lingkaran di tengah.

| Menu | Alamat | Isi |
|---|---|---|
| **Beranda** | `/beranda` | Pencarian, hero dengan angka sensor, dan katalog destinasi |
| **Monitoring** | `/monitoring` | Kamera khusus yang emailmu didaftarkan sebagai penonton, berikut sensornya |
| **Booking** | `/booking` | Booking yang sedang berjalan; juga formulir pemesanan |
| **Profil** | `/profile` | Akun, riwayat, tersimpan, pengaturan, bantuan |

Di sudut kanan bawah setiap halaman ada **widget asisten chat** — tanya apa saja
soal destinasi dan cara memakai situs.

Halaman lain yang bisa dijangkau lewat tautan, bukan lewat menu:

| Halaman | Alamat | Kapan muncul |
|---|---|---|
| Detail destinasi | `/destinations/{id}` | Saat kartu destinasi diklik |
| Dashboard | `/dashboard` | Hanya untuk pengelola dan admin |
| Perjanjian Pengelola | `/syarat-pengelola` | Tertaut dari formulir pendaftaran pengelola |

---

## 4. Peran Akun

Setiap akun punya satu peran. Peran menentukan menu apa yang terbuka.

| Peran | Bisa melakukan | Cara mendapatkannya |
|---|---|---|
| **Pengguna** (`user`) | Cari destinasi, pesan tiket, bayar, ulas, simpan wishlist, tonton kamera yang emailnya didaftarkan | Otomatis begitu akun dibuat |
| **Pengelola** (`pengelola`) | Semua di atas, ditambah **Dashboard**: statistik, scan tiket, kelola destinasi kelolaannya, kelola kamera dan daftar penontonnya | Diajukan lewat formulir yang **dibukakan admin**, lalu disetujui admin |
| **Admin** (`admin`) | Semua di atas, ditambah kelola seluruh destinasi, seluruh pengguna, dan pengubahan peran | Diatur langsung di basis data oleh pengelola sistem |

Perubahan peran berlaku **seketika** — tidak perlu keluar dan masuk lagi.
Lencana peran tampil di kartu profil.

---

## 5. Panduan Wisatawan

### 5.1 Masuk dan mendaftar

Nusa **tidak memakai kata sandi**. Tidak ada pula pemisahan "daftar" dan
"masuk" — keduanya satu jalur yang sama.

**Cara masuk dengan kode email:**

1. Buka **Profil**.
2. Isi alamat email di kolom **Email**, tekan **Kirim kode**.
3. Buka kotak masuk email. Ada pesan berisi **kode 6 digit** dari Nusa.
4. Kembali ke halaman Nusa yang masih terbuka, ketik kodenya. Begitu digit
   keenam masuk, verifikasi berjalan sendiri — tidak ada tombol yang perlu
   ditekan.
5. Kalau emailnya belum punya akun, akun dibuat otomatis saat kodenya benar.

**Hal yang perlu diketahui soal kode:**

- Kode berlaku terbatas waktu. Setelah lewat, minta yang baru.
- Tombol **Kirim ulang** baru bisa ditekan setelah hitungan mundur 60 detik habis.
- Salah kode beberapa kali membuat kode itu hangus — minta kode baru.
- Salah mengetik alamat email? Tekan **Ganti email** di bawah kolom kode.

**Alternatif:** tombol **Lanjut dengan Google** di layar yang sama. Satu klik,
tanpa kode.

> **Catatan:** Akun yang dibuat lewat kode email lahir **tanpa nama** — nama
> awalnya diambil dari bagian email sebelum tanda `@`. Isi nama aslimu di
> **Profil › Pengaturan**, karena nama itulah yang tercetak di tiket dan
> dicocokkan petugas di gerbang.

### 5.2 Melengkapi profil

Buka **Profil › Pengaturan**. Isi:

- **Nama** — dicetak di tiket.
- **No. Telepon** — jadi nomor kontak bawaan setiap kali memesan.

Melengkapi keduanya sekarang membuat pemesanan berikutnya jauh lebih cepat.

### 5.3 Mencari destinasi

Di **Beranda**:

- **Kotak pencarian** di bagian hero — ketik nama destinasi atau wilayah.
- **Chip wilayah** di atas katalog — **Semua**, **Terdekat**, lalu daftar
  wilayah yang terisi sendiri dari destinasi yang ada.
- **Katalog** di bawahnya, dikelompokkan per wilayah.

Hero di bagian atas juga memajang **angka sensor terkini** dari stasiun yang
sedang hidup — tautannya langsung ke destinasi yang bersangkutan.

### 5.4 Halaman destinasi

Klik satu kartu untuk membuka halamannya. Isinya:

| Bagian | Keterangan |
|---|---|
| **Foto utama & galeri** | Gambar destinasi |
| **Tentang** | Deskripsi lokasi |
| **Daftar harga** | Setiap item (tiket masuk, sewa alat, dsb.) dengan harganya dan satuannya. Item yang stoknya dibatasi menampilkan **sisa hari ini**, atau **Habis** kalau sudah nol |
| **Pantauan langsung** | Kamera publik dan angka sensor stasiun — kalau destinasinya memang punya |
| **Ulasan** | Penilaian bintang dan komentar pengunjung lain |

Centang item yang diinginkan di daftar harga, lalu tekan tombol pemesanan —
pilihanmu terbawa ke halaman booking.

### 5.5 Memesan tiket

Halaman **Booking** terbuka dengan destinasi yang sudah terisi.

1. **Pilih item** — tekan **+** dan **−** untuk mengatur jumlah tiap item.
   Tombol **+** mati sendiri kalau sudah menyentuh sisa stok.
2. **Lama sewa** — kolom ini hanya muncul kalau ada item yang dihitung per jam.
3. **Tanggal** — pilih dari strip tanggal. Setiap kartu tanggal menampilkan
   sisa kuotanya, jadi tanggal yang sudah penuh langsung terlihat. Tekan
   **Tanggal lain** untuk memilih tanggal di luar strip.
4. **Nama** — terisi otomatis dari akun, tidak bisa diubah di sini.
5. **No. Telepon** — wajib. Terisi otomatis dari profil kalau sudah pernah diisi.
6. **Catatan** — opsional.
7. Periksa **Ringkasan** di kanan (di ponsel: di bawah). Angkanya adalah
   **estimasi** — total yang ditagih dihitung ulang oleh server dari daftar
   harga resmi destinasi.
8. Tekan **Konfirmasi Booking**.

Muncul layar **Booking Dibuat**. Dari situ:

- **Lanjut Bayar** — menuju daftar booking untuk menyelesaikan pembayaran.
- **Booking Lagi** — mengosongkan formulir untuk pesanan berikutnya.

> **Booking belum menahan kursi.** Kuota baru benar-benar dipesan saat tombol
> bayar ditekan. Kalau destinasinya ramai, jangan menunda membayar.

**Batas 3 booking belum dibayar.** Satu akun hanya boleh punya **tiga** booking
yang menggantung tanpa pembayaran. Pesan **"Kamu punya 3 booking yang belum
dibayar"** berarti salah satunya harus dibayar atau dibatalkan dulu. Membayar
atau membatalkan langsung mengembalikan jatahnya.

### 5.6 Mengubah booking sebelum bayar

Selama **belum dibayar**, booking masih bisa diubah — tanggal, jumlah item,
lama sewa, nomor telepon, dan catatan.

1. Buka **Booking** (atau **Profil › Riwayat Booking**).
2. Pilih booking yang dituju, tekan tombol ubah.
3. Formulir yang sama terbuka dengan isi lama. Ubah seperlunya, tekan
   **Simpan Perubahan**, atau **Batal** untuk kembali tanpa menyimpan.

Booking yang **sudah dibayar** atau **dibatalkan** tidak bisa diubah lagi.

**Membatalkan booking.** Di kartu booking yang sama ada tombol batal. Muncul
jendela konfirmasi lebih dulu — pembatalan tidak bisa dibatalkan balik.

> Membatalkan booking yang **sudah dibayar** tidak mengembalikan uang secara
> otomatis. Belum ada jalur pengembalian dana di sistem; hubungi pengelola
> destinasi untuk pengembalian manual.

**Tombol yang tersedia di tiap kartu booking:**

| Tombol | Kapan muncul |
|---|---|
| **Bayar** | Selama belum dibayar |
| **Ubah** | Selama belum dibayar |
| **Batalkan** | Selama belum dipakai check-in |
| **Lihat Tiket** | Setelah lunas |
| **Pesan Lagi** | Untuk booking yang sudah selesai atau sudah dipindai |

### 5.7 Membayar dengan QRIS

1. Buka **Booking**, pilih booking yang statusnya **Belum Dibayar**, tekan
   tombol bayar.
2. Jendela pembayaran menampilkan rincian item dan total tagihan.
3. Tekan **Konfirmasi Pembayaran**. Jendela QRIS Midtrans terbuka.
4. Pindai QR-nya dengan **GoPay, DANA, OVO, ShopeePay, atau aplikasi bank apa
   pun** yang mendukung QRIS.
5. Setelah dibayar, layar berubah sendiri jadi **Pembayaran Berhasil** —
   biasanya dalam hitungan detik. Tidak perlu memuat ulang halaman.

**Yang perlu diperhatikan:**

- Tagihan QRIS berlaku **15 menit**. Lewat dari itu, QR-nya kedaluwarsa dan
  kursinya dilepas — tekan bayar lagi untuk membuat tagihan baru.
- Menutup jendela di tengah jalan tidak membatalkan apa pun. Selama masih
  dalam 15 menit, QR yang sama masih hidup.
- Pesan bahwa item **habis** berarti kuotanya keburu diambil orang lain di
  antara pemesanan dan pembayaran. Booking itu tidak bisa dilanjutkan — ubah
  tanggalnya atau buat pemesanan baru.
- Status **Lunas hanya ditentukan oleh konfirmasi resmi dari Midtrans**, bukan
  oleh tampilan di browser.

> **Catatan lingkungan uji.** Pada pemasangan saat ini Midtrans masih berjalan
> di mode **Sandbox**, yaitu lingkungan pengujian resmi Midtrans. Alur
> pembayarannya identik dengan yang sesungguhnya — QRIS terbit, webhook
> mengonfirmasi, status berubah jadi Lunas — tetapi **tidak ada uang yang
> berpindah**. Beralih ke transaksi sungguhan cukup dengan mengganti kunci
> Midtrans dan menyalakan `MIDTRANS_IS_PRODUCTION`; tidak ada perubahan kode.

### 5.8 Tiket dan check-in

Tiket terbit **hanya setelah pembayaran diterima**. Sebelum lunas, bagian QR
di kartu tiket masih terkunci dengan keterangan *"Tiket belum terbit — QR
check-in muncul setelah pembayaran diterima."*

Kartu tiket berisi:

| Kolom | Isi |
|---|---|
| Destinasi & tanggal | Tujuan dan hari kunjungan |
| Pemesan | Nama dari akun |
| Rincian | Item beserta jumlah dan lama sewanya. Untuk booking lama yang belum punya rincian item, kolom ini berganti nama jadi **Jumlah** dan menampilkan jumlah orang |
| Telepon | Nomor kontak |
| **Kode Tiket** | Format `OTA-XXXXXXXX` |
| **QR** | Dipindai petugas saat check-in |

**Saat tiba di lokasi:** buka **Booking** (atau **Profil › Riwayat Booking**),
buka tiketnya, tunjukkan QR-nya ke petugas. Petugas memindai, dan status
tiket berubah jadi **Sudah Digunakan**.

> Satu tiket hanya bisa dipakai **sekali**. Pemindaian kedua ditolak dengan
> keterangan bahwa tiketnya sudah digunakan.

**Saran praktis:** simpan tangkapan layar tiketnya. Sinyal di lokasi pesisir
tidak selalu bisa diandalkan.

### 5.9 Status booking

| Status | Arti |
|---|---|
| **Belum Dibayar** | Booking sudah tercatat, pembayaran belum masuk. Masih bisa diubah atau dibatalkan. QR belum terbit |
| **Dikonfirmasi** | Pembayaran diterima, tiket QR sudah terbit dan siap dipakai |
| **Sudah Digunakan** | Tiket sudah dipindai petugas di lokasi |
| **Selesai** | Tanggal kunjungan sudah lewat dan booking-nya lunas, tapi tiketnya tidak pernah dipindai |
| **Kedaluwarsa** | Tanggal kunjungan sudah lewat tanpa pembayaran. Tidak bisa dibayar maupun dipakai lagi — pesan ulang kalau masih mau berkunjung |
| **Dibatalkan** | Booking dibatalkan. Tidak bisa dipakai maupun diubah |

### 5.10 Menonton pantauan langsung

Ada dua macam kamera di Nusa:

- **Kamera publik** — tayang di halaman destinasinya masing-masing, bisa
  ditonton siapa saja.
- **Kamera khusus** — hanya untuk akun yang emailnya didaftarkan pengelola
  sebagai penonton. Kamera inilah yang berkumpul di halaman **Monitoring**,
  lengkap dengan angka sensor stasiunnya.

**Kalau halaman Monitoring kosong**, akunmu memang belum didaftarkan. Yang
perlu dilakukan:

1. Hubungi **pengelola destinasi** yang dituju.
2. Minta **alamat emailmu** — persis seperti yang dipakai masuk ke Nusa —
   didaftarkan sebagai penonton kameranya.
3. Setelah didaftarkan, kameranya muncul sendiri di halaman Monitoring.

> Pencocokan dilakukan **per alamat email**, bukan per akun. Salah satu huruf
> saja berarti kameranya tetap tidak muncul.

**Yang ditampilkan di kartu sensor:**

| Metrik | Isi |
|---|---|
| **Suhu Udara** | Dari sensor DHT22 |
| **Kelembapan Udara** | Persen |
| **Suhu Air** | Dari sensor suhu terendam |
| **Kondisi Cuaca** | Status dan nilai curah hujan |
| **Kecepatan Angin** | Dari anemometer |
| **Debit Air** | Laju aliran air |
| **Kartu GPS** | Koordinat, ketinggian, dan jumlah satelit |

Tanda **--** berarti angkanya belum pernah terkirim; label **Offline**
berarti stasiunnya sedang tidak mengirim data, sedangkan **Live** berarti
gambarnya benar-benar masuk. Kedua label ini memang tampil dalam bahasa
Inggris di kedua pilihan bahasa.

### 5.11 Menulis ulasan

Di halaman destinasi, bagian **Ulasan**: beri bintang 1–5 dan tulis komentar.

Satu akun hanya bisa punya **satu ulasan per destinasi** — mengirim lagi akan
memperbarui ulasan yang sudah ada, bukan menambah yang baru.

### 5.12 Daftar tersimpan

Setiap kartu destinasi di **Beranda** punya **ikon hati** di sudut kanan atas.
Tekan untuk menyimpan destinasi itu; tekan lagi untuk melepasnya.

Semua yang tersimpan berkumpul di **Profil › Tersimpan** — berguna untuk
membandingkan beberapa destinasi sebelum memutuskan.

### 5.13 Pengaturan akun

**Profil › Pengaturan** terdiri dari tiga kartu.

**a. Pengaturan Akun** — data diri, dengan **batang kelengkapan profil** di
atasnya:

| Kolom | Keterangan |
|---|---|
| **Nama** | Yang tercetak di tiket |
| **No. Telepon** | Nomor kontak bawaan saat memesan |
| **Kota** | Kota domisili |
| **NIK** | Opsional, 16 digit angka. Bentuknya diperiksa, bukan sekadar terisi. Nomornya **tidak dicek ke Dukcapil**, disimpan hanya untuk pendataan pengunjung, dan cuma terlihat olehmu dan admin |
| **Email terverifikasi** | Terpenuhi sendiri lewat jalur masuk dengan kode email |

Batang kelengkapan menghitung kelima syarat di atas. Kolom yang belum terisi
ditandai, jadi terlihat mana yang masih kurang. Tekan **Simpan** setelah
mengubah.

Di kartu yang sama ada **Hubungkan Google** — menghubungkan akun ini dengan akun
Google supaya bisa masuk dengan satu klik. Kalau sudah tertaut, statusnya
tampil sebagai keterangan.

**b. Jadi Pengelola** — kartu pendaftaran pengelola. Lihat
[bagian 6.1](#61-menjadi-pengelola).

**c. Pengaturan tampilan:**

| Pengaturan | Keterangan |
|---|---|
| **Mode Gelap** | Sakelar terang/gelap. Tersimpan per perangkat |
| **Bahasa** | ID / EN. Tersimpan per perangkat |

Tombol **Keluar** ada di bagian bawah halaman Profil, bukan di Pengaturan.

> **Menghapus akun** tidak bisa dilakukan sendiri dari aplikasi — hubungi admin
> lewat **Profil › Bantuan & Dukungan**.

### 5.14 Bantuan

**Profil › Bantuan & Dukungan** berisi tanya-jawab dan kontak admin (WhatsApp
atau email). Widget chat di sudut layar juga siap menjawab pertanyaan seputar
destinasi dan cara pakai.

---

## 6. Panduan Pengelola

Pengelola adalah pengurus satu atau beberapa destinasi: memeriksa tiket di
gerbang, memperbarui data destinasinya, dan mengatur kamera pantau.

### 6.1 Menjadi pengelola

Pendaftaran pengelola **tidak bisa dibuka sendiri** — admin yang membukanya.
Urutannya:

1. **Hubungi admin** lewat tombol WhatsApp di **Profil › Pengaturan › Jadi
   Pengelola**, minta tiket pendaftaran dibuka.
2. **Admin membuka tiket.** Kartu di halaman itu berubah menjadi formulir.
3. **Isi formulir:**
   - Nama lengkap, nomor telepon, organisasi/instansi.
   - Nama destinasi, lokasi, dan deskripsinya.
   - **Dasar hak kelola** — dipilih dari daftar resmi yang tersedia.
   - Centang pernyataan hak kelola.
   - Baca dan setujui **[Perjanjian Pengelola](/syarat-pengelola)**.
4. **Kirim.** Statusnya jadi *menunggu persetujuan*, dan isi pengajuanmu
   tampil di kartu itu.
5. **Admin meninjau.** Kalau disetujui, kamu menerima **email pemberitahuan**
   dan menu **Dashboard** langsung terbuka.

Kalau ditolak, kartunya menampilkan keterangan itu. Tidak ada tombol "ajukan
ulang" — tiket baru dibuka admin, sama seperti awal.

> Pengadaan dan pengiriman paket sensor IoT diurus terpisah lewat WhatsApp,
> bukan lewat formulir ini.

### 6.2 Membuka Dashboard

Setelah jadi pengelola, kartu **Dashboard** muncul di halaman Profil. Klik
untuk masuk, atau buka `/dashboard` langsung.

Menu di bilah sisi (di ponsel: tombol ☰ di kiri atas):

| Menu | Isi |
|---|---|
| **Statistik** | Ringkasan destinasi kelolaanmu |
| **Scan Tiket** | Pemindai QR untuk check-in |
| **Destinasi** | Data destinasi kelolaanmu |
| **Kamera** | Kamera dan daftar penontonnya |

Tautan **Kembali ke Profil** ada di bawah bilah sisi.

### 6.3 Statistik

Ringkasan angka untuk destinasi yang kamu kelola: jumlah booking, pendapatan,
dan tingkat kunjungan. Admin melihat panel yang berbeda — mencakup seluruh
sistem.

### 6.4 Scan Tiket (check-in)

Menu ini memindai QR di tiket pengunjung.

1. Buka **Dashboard › Scan Tiket**.
2. **Izinkan akses kamera** saat browser meminta. Tanpa izin ini pemindai
   tidak jalan.
3. Arahkan kamera ke QR di layar pengunjung. Kotak pemindai mengunci sendiri
   begitu terbaca.
4. Periksa kartu yang muncul — destinasi, tanggal, nama pemesan, rincian item,
   telepon, dan kode tiket. **Cocokkan dengan orang di depanmu.**
5. Tekan tombol check-in.

**Kemungkinan hasil pemindaian:**

| Hasil | Arti | Tindakan |
|---|---|---|
| **Valid** | Tiket sah dan sudah dibayar | Tekan check-in, persilakan masuk |
| **Belum dibayar** | Booking ada, pembayaran belum masuk | Tolak. Minta pengunjung menyelesaikan pembayaran di aplikasi |
| **Sudah digunakan** | Tiket pernah dipindai. Waktu pemakaiannya ikut tampil | Tolak — kecuali kamu memang tahu ini pemindaian ulang yang sah |
| **Dibatalkan** | Booking sudah dibatalkan | Tolak |
| **Tidak ditemukan** | Kode tidak terdaftar | Periksa apakah QR-nya memang dari Nusa |
| **QR tidak dikenali** | Bukan tiket Nusa | Minta pengunjung membuka tiket yang benar |

**Pesan galat saat check-in:**

- *"akun ini bukan admin/pengelola"* — akun yang dipakai tidak berhak. Masuk
  dengan akun petugas yang benar.
- *"Sesi habis. Masuk ulang lalu coba lagi."* — keluar lalu masuk kembali.
- *"Tiket sudah digunakan (mungkin oleh petugas lain)"* — dua petugas
  memindai tiket yang sama hampir bersamaan. Hanya yang pertama yang tercatat.

> **Saran lapangan:** pastikan baterai perangkat cukup dan sinyal ada.
> Check-in membutuhkan koneksi karena statusnya dicatat di server.

### 6.5 Destinasi

Menu **Destinasi** menampilkan destinasi yang kamu kelola saja. Kolom yang
boleh kamu ubah dibatasi pada yang dijanjikan **Pasal 3 Perjanjian Pengelola**:

| Kolom | Keterangan |
|---|---|
| **Deskripsi** | Cerita tentang destinasinya: apa yang bisa dilakukan, kondisi lokasi |
| **Foto utama** | Satu foto, diunggah langsung dari perangkatmu |
| **Galeri** | Foto tambahan yang tampil di bawah deskripsi. Boleh dipilih beberapa sekaligus |
| **Koordinat** | Lintang dan bujur, mis. `1.7241, 125.0631` |
| **WhatsApp** | Nomor kontak destinasi |
| **Daftar harga** | Nama item, harga, satuan (mis. `/pax`), kuota, dan deskripsi item. Kuota dikosongkan berarti tak terbatas. Tiap item boleh diberi fotonya sendiri |
| **Spot di dalam** | Menambahkan tempat di dalam kawasan yang kamu kelola |

Kolom di luar daftar ini — nama destinasi, wilayah, penetapan pengelola,
sakelar pantauan, dan ID stasiun — hanya bisa diubah admin.

**Cara mengunggah foto.** Tekan **Unggah foto**, pilih berkasnya, lalu tunggu
sampai gambar kecilnya muncul. Foto yang sudah naik bisa dibuang lewat tanda
**×** di pojoknya. Pada Foto Utama, mengunggah foto baru **menggantikan** yang
lama; pada Galeri, foto baru **ditambahkan** ke yang sudah ada.

Syaratnya: berkasnya harus gambar (JPG, PNG, HEIC, dan sejenisnya) dan di bawah
**10 MB**. Foto langsung dari kamera ponsel biasanya masih di bawah batas itu.
Perubahannya baru tersimpan setelah kamu menekan **Simpan** — mengunggah saja
belum cukup.

### 6.6 Kamera

Menu **Kamera** menampilkan kamera yang tertaut ke destinasimu, beserta
statusnya.

Yang bisa **kamu** lakukan:

- **Mengatur daftar penonton** kamera milikmu — alamat email yang boleh
  menonton kamera khusus. Tambahkan email tamu yang mengambil paket monitoring
  di sini, **persis** seperti yang mereka pakai masuk ke Nusa.
- **Melihat siaran, statistik, dan riwayat deteksi** kamera tersebut.

Yang **hanya bisa dilakukan admin**:

- **Mendaftarkan kamera baru** dan menautkannya ke destinasi.
- **Mengatur Alamat Server Kamera** — ini setelan global untuk seluruh sistem,
  bukan per destinasi.

Jadi kalau destinasimu perlu kamera baru, hubungi admin.

> Deteksi AI hanya berjalan **selama kamera sedang ditonton**. Kalau tidak ada
> penonton, model dilepas untuk menghemat sumber daya server.

---

## 7. Panduan Admin

Admin memegang seluruh sistem. Semua menu pengelola terbuka, ditambah dua yang
berikut.

### 7.1 Pengguna

**Dashboard › Pengguna** menampilkan seluruh akun terdaftar. Yang bisa
dilakukan:

| Tindakan | Keterangan |
|---|---|
| **Buka tiket pendaftaran pengelola** | Mengubah status pengajuan jadi *dibuka*, sehingga formulirnya muncul di halaman Pengaturan orang tersebut. Inilah satu-satunya cara formulir itu terbuka |
| **Tinjau pengajuan** | Membaca isi formulir: identitas, destinasi, dasar hak kelola, dan versi perjanjian yang disetujui |
| **Setujui** | Menaikkan peran jadi `pengelola`. **Destinasi yang diminta dibuatkan sekaligus** — kalau namanya sudah ada, destinasi itu yang ditetapkan sebagai kelolaannya. Kirim email pemberitahuan lewat tombol yang tersedia |
| **Tolak** | Menandai pengajuan ditolak. Yang bersangkutan melihat keterangannya di halaman Pengaturan |
| **Ubah peran** | Pilihan `User` / `Pengelola` / `Admin`. Berlaku seketika di layar orang tersebut |
| **Hapus akun** | Menghapus akun beserta dokumennya sekaligus. **Tidak bisa dibatalkan** |

Ada juga **kotak pencarian** untuk menyaring daftar berdasarkan nama atau
email, dan **tombol WhatsApp** pada pengajuan yang menunggu — langsung menuju
nomor yang dicantumkan pengaju.

> Hapus akun lewat menu ini, **jangan lewat Firebase Console**. Menghapus dari
> Console hanya membuang datanya di Auth dan meninggalkan dokumen yang
> menumpuk di daftar pengguna.

### 7.2 Destinasi

**Dashboard › Destinasi** memberi akses penuh ke seluruh destinasi — tambah,
ubah, hapus. Kolom yang tersedia:

| Kolom | Keterangan |
|---|---|
| Nama, lokasi, deskripsi | Identitas destinasi |
| Label/tag | Kategori yang tampil di kartu |
| Foto | Foto utama dan galeri, diunggah langsung dari perangkat. Foto per item harga juga diatur di sini |
| **Daftar harga** | Item, harga, satuan, dan kuota per item. Item per jam ditandai di sini |
| Koordinat | Lintang dan bujur untuk peta serta filter **Terdekat** |
| WhatsApp | Nomor kontak destinasi |
| **Pengelola** | Akun yang berhak mengurus destinasi ini |
| **Pantauan** | Sakelar monitoring dan **ID stasiun** sensor IoT |
| **Kamera** | Kamera yang tertaut ke destinasi ini |

Destinasi bisa disarangkan — sebuah kawasan boleh memuat beberapa spot di
dalamnya, dan kamera boleh ditautkan ke spot tertentu.

### 7.3 Kamera dan alamat server

**Dashboard › Kamera** memberi akses ke seluruh kamera. Di sinilah **alamat
server kamera** disetel — satu alamat untuk seluruh sistem. Setiap kamera
punya ID pendek yang dikeluarkan server kamera saat pendaftaran; ID itulah
yang dimasukkan di sini.

Kamera bisa ditandai **publik** (tayang di halaman destinasi, terbuka untuk
semua) atau dibiarkan **khusus** (hanya untuk email di daftar penonton).

### 7.4 Statistik global

Panel Statistik versi admin mencakup seluruh sistem, bukan satu wilayah.

---

## 8. Masalah Umum

### Masuk

**Kode tidak masuk ke email.**
Periksa folder spam/promosi. Pastikan alamatnya benar. Tunggu hitungan mundur
60 detik habis, lalu tekan **Kirim ulang**. Kalau tetap tidak datang, coba
tombol **Lanjut dengan Google**, atau hubungi admin.

**"Kode salah" padahal sudah benar.**
Kode berlaku terbatas waktu dan sekali pakai. Kalau sebelumnya sempat meminta
beberapa kali, yang berlaku hanya **yang terakhir**. Minta kode baru.

**Kode terkunci.**
Terlalu banyak percobaan salah. Minta kode baru.

### Pemesanan dan pembayaran

**"Kamu punya 3 booking yang belum dibayar."**
Batas booking menggantung. Buka **Booking**, selesaikan atau batalkan salah
satunya.

**Tombol + tidak bisa ditekan.**
Kuota item itu untuk tanggal tersebut sudah menyentuh batas. Pilih tanggal
lain — sisa tiap tanggal terlihat di strip tanggal.

**"Habis untuk tanggal ini".**
Kuota sudah nol. Pilih tanggal lain.

**Sudah bayar tapi masih "Belum Dibayar".**
Tunggu beberapa detik — statusnya berubah sendiri begitu konfirmasi resmi
masuk, tanpa perlu memuat ulang. Kalau lewat beberapa menit masih belum
berubah, **buka lagi halaman Booking**: tiap kali daftar pemesanan dimuat,
aplikasi menanyakan sendiri status tagihanmu ke penyedia pembayaran, dan
pemesanan yang ternyata sudah lunas diperbaiki saat itu juga. Baru kalau itu
pun tidak mengubah apa-apa, hubungi admin dengan menyertakan **kode tiket**
(`OTA-XXXXXXXX`) dan bukti pembayaranmu.

**QR pembayaran kedaluwarsa.**
Tagihan QRIS berlaku 15 menit. Tekan tombol bayar lagi untuk membuat tagihan
baru.

### Tiket

**QR tidak muncul di tiket.**
Tiket hanya terbit setelah lunas. Cek statusnya — kalau masih **Belum
Dibayar**, selesaikan pembayarannya dulu.

**Petugas bilang tiket sudah digunakan.**
Tiket hanya berlaku sekali. Kalau menurutmu ini keliru, tunjukkan kode
tiketnya ke petugas untuk diperiksa di dashboard.

### Pantauan

**Halaman Monitoring kosong.**
Berarti belum ada kamera khusus untuk akunmu. Hubungi pengelola destinasi dan
minta emailmu didaftarkan sebagai penonton — lihat [bagian 5.10](#510-menonton-pantauan-langsung).

**Kamera muncul tapi gambarnya tidak jalan.**
Server kamera sedang tidak menyala atau tidak terjangkau. Hubungi pengelola
destinasi.

**Angka sensor menampilkan "—" atau "tidak live".**
Stasiun IoT sedang tidak mengirim data — bisa karena mati listrik, sinyal
WiFi hilang, atau perangkatnya sedang diperbaiki. Hubungi pengelola destinasi.

### Pemindaian tiket (petugas)

**Kamera tidak menyala di menu Scan Tiket.**
Izin kamera belum diberikan. Periksa pengaturan izin situs di browser, lalu
muat ulang halaman. Di iPhone, pemindaian hanya jalan lewat Safari atau
aplikasi yang sudah dipasang ke layar utama.

**"Akun ini bukan admin/pengelola".**
Peran akunnya belum diatur. Hubungi admin.

### Mengelola destinasi (pengelola & admin)

**Foto gagal diunggah.**
Cek pesan yang muncul di bawah tombol unggah — biasanya berkasnya bukan gambar,
atau ukurannya lewat 10 MB. Perkecil dulu fotonya, atau pilih berkas lain.

**Semua foto ditolak, padahal berkasnya benar.**
Hanya akun ber-peran **pengelola** atau **admin** yang boleh mengunggah. Kalau
peranmu sudah benar dan penolakannya tetap terjadi untuk semua foto, itu bukan
masalah berkasmu — hubungi admin dan sebutkan bahwa unggahan ditolak
menyeluruh, supaya diperiksa dari sisi setelan sistem.

**Foto sudah diunggah tapi tidak muncul di halaman destinasi.**
Perubahan baru berlaku setelah menekan **Simpan**. Mengunggah foto saja belum
menyimpannya.

---

## 9. Daftar Istilah

| Istilah | Arti |
|---|---|
| **OTA** | *Online Travel Agency* — platform pemesanan perjalanan daring |
| **PWA** | *Progressive Web App* — situs yang bisa dipasang ke layar utama seperti aplikasi |
| **QRIS** | Standar kode QR pembayaran Indonesia, berlaku di semua dompet digital dan bank |
| **Kode Tiket** | Kode singkat berformat `OTA-XXXXXXXX` untuk merujuk satu booking |
| **Check-in** | Pemindaian tiket QR oleh petugas di lokasi |
| **Stasiun / ID stasiun** | Satu paket sensor IoT terpasang di sebuah destinasi, beserta penanda uniknya |
| **Kamera publik** | Kamera yang tayang di halaman destinasi untuk semua pengunjung |
| **Kamera khusus** | Kamera yang hanya bisa ditonton akun yang emailnya didaftarkan |
| **Penonton** | Alamat email yang diberi hak menonton kamera khusus |
| **Pengelola** | Peran pengurus destinasi — punya akses Dashboard |
| **Paket monitoring** | Layanan pantauan kamera + sensor yang ditawarkan pengelola destinasi |

---

## Dokumen terkait

- **[Manual Teknis](manual-teknis.md)** — pemasangan, arsitektur, referensi API,
  penerapan, dan pemeliharaan sistem.
- **[Perjanjian Pengelola](/syarat-pengelola)** — ketentuan hak dan kewajiban
  pengelola destinasi.
