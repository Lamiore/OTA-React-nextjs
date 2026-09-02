# Manual Teknis — Nusa

**Manual Book · Sistem OTA "Nusa"**
Pemasangan, arsitektur, referensi API, penerapan, dan pemeliharaan.

Cakupan: **aplikasi web `OTA/` (Next.js)** — pemasangan, arsitektur, dan
pemeliharaannya.

Sistem kamera AI (`Proyek_Karang/`) dan firmware stasiun sensor (`firmware/`)
adalah sub-sistem terpisah yang **dikerjakan rekan peneliti**. Keduanya
didokumentasikan di §15 dan §16 **sebatas antarmuka yang dipakai aplikasi web** —
alamat endpoint, cara menautkannya, dan bentuk data yang dikonsumsi. Pelatihan
model deteksi dan perakitan perangkat kerasnya berada di luar cakupan dokumen
ini.

> Untuk cara memakai aplikasinya dari sisi pengguna, lihat
> **[Panduan Pengguna](panduan-pengguna.md)**.

---

## Daftar Isi

1. [Ringkasan Arsitektur](#1-ringkasan-arsitektur)
2. [Tumpukan Teknologi](#2-tumpukan-teknologi)
3. [Prasyarat](#3-prasyarat)
4. [Pemasangan Lokal](#4-pemasangan-lokal)
5. [Variabel Lingkungan](#5-variabel-lingkungan)
6. [Struktur Direktori](#6-struktur-direktori)
7. [Pola Arsitektur](#7-pola-arsitektur)
8. [Model Data](#8-model-data)
9. [Keamanan](#9-keamanan)
10. [Referensi API](#10-referensi-api)
11. [Alur Pembayaran Midtrans](#11-alur-pembayaran-midtrans)
12. [Dua Bahasa (i18n)](#12-dua-bahasa-i18n)
13. [Tema dan Token Desain](#13-tema-dan-token-desain)
14. [PWA dan Service Worker](#14-pwa-dan-service-worker)
15. [Server Kamera dan Deteksi Karang](#15-server-kamera-dan-deteksi-karang)
16. [Firmware Stasiun Sensor](#16-firmware-stasiun-sensor)
17. [Penerapan (Deployment)](#17-penerapan-deployment)
18. [Pengujian](#18-pengujian)
19. [Pemeliharaan dan Pemecahan Masalah](#19-pemeliharaan-dan-pemecahan-masalah)

---

## 1. Ringkasan Arsitektur

Nusa terdiri dari tiga sub-sistem yang saling terhubung lewat Firebase.

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. WEB APP  (Next.js 14 App Router · TypeScript · Tailwind)         │
│     di-deploy ke Vercel                                              │
│     ├─ Publik   : /beranda, /destinations/[id], /booking, /monitoring│
│     ├─ Akun     : /profile                                           │
│     ├─ Operator : /dashboard  (admin & pengelola)                    │
│     └─ Backend  : /api/*      (Route Handler, runtime Node.js)       │
└───────────┬──────────────────────────────────┬───────────────────────┘
            │                                  │
   ┌────────▼──────────┐              ┌────────▼─────────────────┐
   │ 2. FIREBASE       │              │ 3. SERVER KAMERA + AI    │
   │  ├ Auth           │              │  Proyek_Karang/          │
   │  ├ Firestore      │              │  kamera_deteksi.py       │
   │  │  (transaksi)   │              │  Flask + YOLOv8 + OpenCV │
   │  ├ Realtime DB    │              │  /stream /stats /history │
   │  └ Storage (foto) │              │                          │
   └────────▲──────────┘              └──────────▲───────────────┘
            │ HTTPS PUT tiap 5 detik             │ sumber video
   ┌────────┴──────────┐              ┌──────────┴───────────────┐
   │ ESP32 Weather Stn │              │ webcam / IP camera / HP  │
   │ firmware/*.ino    │              │                          │
   └───────────────────┘              └──────────────────────────┘
```

Dari ketiganya, yang dibahas dokumen ini adalah **kotak 1 (aplikasi web)**
beserta seluruh integrasinya ke Firebase, server kamera, dan stasiun sensor.
Kotak 3 dan ESP32 dikerjakan rekan peneliti — lihat catatan di §15 dan §16.

Alur pihak luar tambahan:

- **Midtrans Snap** — pembayaran QRIS. Web membuat transaksi, browser membuka
  popup Snap, dan **webhook** Midtrans yang memutuskan status lunas.
- **SMTP** (Brevo/Resend/dll.) — kode masuk 6 digit dan email pemberitahuan.
- **Google Gemini** — asisten chat, dipanggil lewat proxy di `/api/chat`.

### Kenapa dua basis data Firebase

| | Firestore | Realtime Database |
|---|---|---|
| Dipakai untuk | user, destinasi, booking, kamera, ulasan, kode login, pengaturan | data sensor IoT |
| Alasan | butuh **query** (`where`), **transaksi** (anti check-in ganda dan anti bayar ganda), serta **security rules per-dokumen** | butuh **tulis frekuensi tinggi & murah**; ESP32 cukup HTTP `PUT` ke satu REST endpoint tanpa SDK berat |

Satu stasiun menulis tiap 5 detik — sekitar 17.280 tulisan per hari. Firestore
menagih per dokumen yang ditulis; RTDB menagih per bandwidth, dan muatannya
hanya ± 200 byte. ESP32 juga tidak punya SDK Firestore yang ringan, sedangkan
RTDB bisa diakses dengan `HTTPClient` biasa.

---

## 2. Tumpukan Teknologi

| Lapisan | Pilihan | Versi | Catatan |
|---|---|---|---|
| Framework | Next.js **App Router** | 14.2.35 | Routing berbasis folder; Route Handler untuk API — satu repo untuk frontend dan backend |
| Bahasa | TypeScript | ^5 | `strict: true` |
| UI | React | ^18 | |
| Styling | Tailwind CSS + token CSS sendiri | ^3.4.1 | `tokens.css` + `tailwind.config.ts`; mode gelap lewat kelas `.dark` |
| Basis data & auth | Firebase | `firebase` ^12.11.0, `firebase-admin` ^14.2.0 | Auth, Firestore, Realtime Database, Cloud Storage |
| Pembayaran | Midtrans Snap | REST | QRIS; status lunas ditentukan webhook |
| Email | Nodemailer + SMTP sendiri | ^9.0.3 | Email bawaan Firebase sering masuk spam |
| QR | `qrcode.react` ^4.2.0 (buat), `html5-qrcode` ^2.3.8 (pindai) | | |
| Utilitas kelas | `clsx` | ^2.1.1 | |
| Asisten chat | Google Gemini (Flash-Lite) | — | Masuk kuota gratis AI Studio |
| AI deteksi karang | YOLOv8n (Ultralytics) + OpenCV | — | Model nano, cukup ringan untuk CPU |
| Server AI | Flask | — | Melayani MJPEG + JSON |
| Firmware | Arduino/C++ (ESP32) | — | |
| Penerapan | Vercel (web) + laptop/VPS (server kamera) | | |

**Penyematan versi:** `jose` disematkan ke `^5.10.0` lewat blok `overrides` di
`package.json`. Versi 6 menyebabkan `verifyIdToken` gagal dengan galat 500 di
runtime Vercel — jangan dicabut tanpa pengujian ulang di produksi.

---

## 3. Prasyarat

### Perangkat lunak

| Kebutuhan | Versi | Untuk |
|---|---|---|
| Node.js | 18 LTS atau lebih baru | Menjalankan dan membangun aplikasi web |
| npm | Bawaan Node | Manajemen paket |
| Git | — | Mengambil kode |
| Python | 3.9+ | Server kamera (`Proyek_Karang/`) |
| Arduino IDE | 2.x | Mem-*flash* firmware ESP32 |
| Firebase CLI | — | Menerapkan security rules |

### Akun dan layanan

| Layanan | Untuk | Catatan |
|---|---|---|
| **Firebase** | Auth + Firestore + Realtime Database | Proyek bawaan repo ini: `ota-db` (lihat `.firebaserc`) |
| **Penyedia SMTP** | Email kode masuk & pemberitahuan | Brevo, Resend, atau SMTP lain |
| **Midtrans** | Pembayaran QRIS | Akun sandbox untuk pengembangan, akun produksi untuk rilis |
| **Google AI Studio** | Kunci API Gemini untuk asisten chat | Gratis, tanpa kartu kredit |
| **Vercel** | Menerapkan aplikasi web | |

---

## 4. Pemasangan Lokal

```bash
# 1. Ambil kode
git clone https://github.com/Lamiore/OTA-React-nextjs.git
cd OTA-React-nextjs

# 2. Pasang dependensi
npm install

# 3. Siapkan variabel lingkungan
cp .env.local.example .env.local
#    lalu isi setiap kolomnya — lihat bagian 5

# 4. Jalankan server pengembangan
npm run dev
```

Aplikasi terbuka di **http://localhost:3000**.

### Perintah npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan dengan *hot reload* |
| `npm run build` | Membangun berkas produksi |
| `npm start` | Menjalankan hasil `build` |
| `npm run lint` | Pemeriksaan ESLint |
| `npm run tunnel` | Terowongan publik ke port 3000 (subdomain `nusa-ota`) — dipakai untuk menguji webhook Midtrans dari mesin lokal |

### Menyiapkan kredensial Admin SDK

Route API di sisi server memakai Firebase Admin SDK. Kuncinya diambil dari
variabel `FIREBASE_ADMIN_SA_B64` — isinya berkas *service account* JSON yang
di-*encode* base64:

```bash
base64 -i ota-db-firebase-adminsdk-*.json | tr -d '\n'
```

Salin keluarannya ke `FIREBASE_ADMIN_SA_B64` di `.env.local`.

> **Jangan pernah** meng-*commit* berkas *service account* maupun `.env.local`.
> Keduanya sudah tercantum di `.gitignore`; biarkan tetap begitu.

### Menerapkan security rules

```bash
firebase deploy --only firestore:rules,database,storage
```

Berkas yang diterapkan tercantum di `firebase.json`: `firestore.rules`,
`firestore.indexes.json`, `database.rules.json`, dan `storage.rules`.

> **Jalankan dari terminal interaktif.** `storage.rules` memakai *cross-service
> Rules* (Storage membaca dokumen Firestore untuk mengecek peran). Pertama kali
> aturan semacam itu diterapkan, Firebase CLI **bertanya** apakah boleh memberi
> peran IAM yang dibutuhkan. Kalau perintahnya dijalankan tanpa TTY — lewat
> skrip, CI, atau sesi non-interaktif — pertanyaan itu dilewati diam-diam,
> penerapannya tetap dilaporkan berhasil, tetapi aturannya kemudian menolak
> **semua** pengunggah termasuk admin. Gejalanya tidak bisa dibedakan dari
> "belum masuk". Lihat bagian 19.

---

## 5. Variabel Lingkungan

Semua variabel disimpan di `.env.local` (lokal) dan di **Environment Variables**
proyek Vercel (produksi). Berkas contohnya: `.env.local.example`.

> **Aturan penamaan:** awalan `NEXT_PUBLIC_` membuat nilainya ikut terkirim ke
> browser. Rahasia apa pun **tidak boleh** memakai awalan itu.

### Firebase — klien (aman terekspos)

| Variabel | Isi |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Kunci API web dari Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domain autentikasi |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | URL Realtime Database |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID proyek |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket penyimpanan |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |

### Firebase — server (rahasia)

| Variabel | Isi |
|---|---|
| `FIREBASE_ADMIN_SA_B64` | *Service account* JSON dalam base64. Dipakai `lib/firebaseAdmin.ts` |
| `GOOGLE_APPLICATION_CREDENTIALS` | *Path* ke berkas *service account*. Dipakai skrip probe di `scripts/`, **dan** oleh `lib/firebaseAdmin.ts` sebagai cadangan kalau `FIREBASE_ADMIN_SA_B64` kosong |

### Aplikasi

| Variabel | Isi |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Alamat pangkal aplikasi. Dipakai menyusun tautan di email. Lokal: `http://localhost:3000` |
| `NEXT_PUBLIC_CAMERA_URL` | **Tidak terpakai.** Peninggalan; masih tercantum di `.env.local.example` tetapi nol rujukan di kode. Alamat server kamera selalu dibaca dari dokumen Firestore `settings/cameraServer`, baik lokal maupun produksi |

### Email (SMTP)

| Variabel | Isi |
|---|---|
| `SMTP_HOST` | Host SMTP penyedia |
| `SMTP_PORT` | Umumnya `587` |
| `SMTP_USER` | Nama pengguna SMTP |
| `SMTP_PASS` | Kata sandi SMTP |
| `SMTP_FROM` | Alamat pengirim, mis. `Nusa <no-reply@contoh.com>` |

> **Peringatan:** jangan bungkus nilai `SMTP_FROM` dengan tanda kutip tambahan
> di dasbor Vercel. Tanda kutip yang ikut tersimpan pernah membuat pengiriman
> kode masuk gagal total di produksi.

### Midtrans

| Variabel | Isi |
|---|---|
| `MIDTRANS_SERVER_KEY` | **Rahasia.** Server Key dari dasbor Midtrans. Juga dipakai memverifikasi tanda tangan webhook |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Client Key. Dipasang sebagai `data-client-key` pada skrip Snap |
| `MIDTRANS_IS_PRODUCTION` | `true` untuk lingkungan produksi. **Bawaannya sandbox** kalau tidak diisi |
| `MIDTRANS_NOTIFICATION_URL` | URL webhook yang dikirim bersama transaksi. Kosongkan untuk memakai turunan otomatis dari domain |

### Gemini (asisten chat)

| Variabel | Isi |
|---|---|
| `GEMINI_API_KEY` | **Rahasia, tanpa `NEXT_PUBLIC_`.** Ambil di https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | Opsional. Bawaan `gemini-3.5-flash-lite` |

Keduanya hanya dipakai asisten chat — fitur pendukung yang **tidak dibahas di
naskah skripsi**. Dikosongkan berarti widget chat menjawab `503 not-configured`;
sisa sistem tetap berjalan normal.

### Lain-lain

| Variabel | Isi |
|---|---|
| `PROBE_BASE` | Alamat pangkal untuk `scripts/bookings.probe.mjs`. Bawaan `http://localhost:3111` |
| `VERCEL_PROJECT_PRODUCTION_URL` | Diisi Vercel sendiri. Dipakai menurunkan URL webhook kalau `MIDTRANS_NOTIFICATION_URL` kosong |

---

## 6. Struktur Direktori

```
OTA/
├── app/                          ← ROUTING (App Router: folder = URL)
│   ├── fonts/*.woff              Sisa boilerplate Next.js — tidak dirujuk kode
│   ├── layout.tsx                Root layout: font, tema, bahasa, ChatWidget, SW
│   ├── page.tsx                  "/" → redirect ke /beranda
│   ├── beranda/page.tsx          Halaman utama (hero + katalog destinasi)
│   ├── destinations/[id]/page.tsx  Detail destinasi (dinamis)
│   ├── booking/page.tsx          Formulir pemesanan + daftar booking berjalan
│   ├── monitoring/page.tsx       Kamera khusus penonton + sensor stasiunnya
│   ├── profile/page.tsx          Akun, riwayat, pengaturan, pengajuan pengelola
│   ├── dashboard/page.tsx        Dashboard admin & pengelola
│   ├── syarat-pengelola/page.tsx Perjanjian Pengelola
│   ├── manifest.ts               Manifest PWA
│   ├── error.tsx / global-error.tsx / not-found.tsx
│   └── api/                      ← BACKEND (Route Handler, runtime Node.js)
│       ├── auth/request-code/    Kirim kode masuk 6 digit
│       ├── auth/verify-code/     Tukar kode dengan custom token
│       ├── bookings/             Satu-satunya pintu tulis koleksi bookings
│       ├── payments/midtrans/    Webhook Midtrans
│       ├── role-request/         Kirim formulir pengajuan pengelola
│       ├── notify-approval/      Email "pengajuan disetujui" (admin)
│       ├── send-verification/    Email verifikasi (sisa era kata sandi)
│       ├── delete-user/          Hapus Auth + dokumen (admin)
│       └── chat/                 Proxy Gemini + konteks katalog
│
├── lib/                          ← LOGIKA & AKSES DATA (tidak ada JSX di sini)
│   ├── firebase.ts               Inisialisasi SDK klien + cache persisten
│   ├── firebaseAdmin.ts          Admin SDK (server-only)
│   ├── firestore.ts              ★ Semua tipe data + operasi Firestore
│   ├── realtime.ts               Baca sensor dari RTDB (stationPath)
│   ├── destination.ts            Hitung stok, ketersediaan, baris & total booking
│   ├── midtrans.ts               Buat transaksi Snap, verifikasi tanda tangan
│   ├── pembayaran.ts             ★ Satu-satunya penulis paymentStatus 'paid'
│   ├── loginCode.ts              Pembuatan, hash, dan pemeriksaan kode masuk
│   ├── mailer.ts                 Transport Nodemailer
│   ├── sendVerification.ts       Kirim tautan verifikasi (sisa era kata sandi)
│   ├── verification.ts           Validasi formulir pengelola + versi perjanjian
│   ├── useAuth.ts                Hook: user login + peran (real-time)
│   ├── storage.ts                Unggah foto ke Cloud Storage + penjaga ukuran
│   ├── format.ts                 formatIDR, parseCoords, waLink, docId, str
│   ├── i18n.ts / useLang.tsx     Kamus & konteks dua bahasa (ID/EN)
│   ├── useTheme.ts               Terang/gelap
│   ├── useLocations.ts           Daftar wilayah unik
│   ├── useSaved.ts               Wishlist destinasi
│   ├── profile.ts                Operasi profil
│   ├── contact.ts                Kontak admin (email & WhatsApp)
│   └── *.check.ts                Uji mandiri, dijalankan dengan `node` polos
│
├── components/                   ← TAMPILAN
│   ├── desktop/  mobile/         Nav, hero, kartu, katalog, footer
│   ├── booking/                  BookingHistory, DateStrip, TicketModal (QR)
│   ├── dashboard/                Sidebar, Statistik, Scan, Destinasi, Pengguna
│   │   ├── Pengelola*Panel.tsx   Versi panel destinasi & statistik utk pengelola
│   │   ├── CameraViewers.tsx     Daftar email penonton kamera per destinasi
│   │   └── FotoUpload.tsx        Unggah foto destinasi (dipakai kedua panel)
│   ├── cameras/                  CameraManager, VerificationForm, CameraLiveModal,
│   │                             CameraHistory, CameraStats, ServerAddressCard
│   ├── destinations/             LiveMonitorPanel (kamera + sensor), Reviews
│   ├── notifications/            NotificationBell, PaymentModal
│   ├── profile/                  AuthForm, ProfileView, AccountSettings, dll.
│   └── chat/ChatWidget.tsx       Widget asisten
│
├── docs/                         ← DOKUMENTASI
│   ├── panduan-pengguna.md       Guide Book (dokumen pendamping)
│   ├── manual-teknis.md          Manual Book (dokumen ini)
│   ├── *-Nusa.docx               Versi Word kedua dokumen di atas
│   ├── panduan-semhas.md         Bahan seminar hasil (ditulis 7 Agustus 2026)
│   ├── audit-keamanan-*.md       Laporan audit keamanan
│   ├── firestore-rules-*.md      Catatan perubahan rules
│   ├── sumber-harga-destinasi.md Rujukan harga tiap item destinasi
│   ├── konten-maluku-utara.md    Bahan isi destinasi Maluku Utara
│   ├── Sistem-Kamera-*.pdf       Spesifikasi kamera Ezviz/DeepNorth
│   └── superpowers/              Rencana & spesifikasi desain tiap fitur
│
├── scripts/                      ← SKRIP UJI
│   ├── rules.probe.mjs           Uji firestore.rules sebagai pengguna asli
│   ├── storage.probe.mjs         Uji storage.rules sebagai pengguna asli
│   ├── bookings.probe.mjs        Uji /api/bookings sebagai pengguna asli
│   ├── latency.probe.mjs         Ukur latensi sinkronisasi real-time
│   └── seed-login-code.mjs       Tanam kode masuk akun uji tanpa lewat surel
│
├── firestore.rules               ★ Aturan keamanan Firestore
├── storage.rules                 ★ Aturan keamanan Cloud Storage
├── database.rules.json           ★ Aturan keamanan Realtime Database
├── firestore.indexes.json        Indeks Firestore (saat ini kosong)
├── firebase.json / .firebaserc   Konfigurasi Firebase CLI
├── tokens.css                    Token desain (warna, spasi, radius, gerak)
├── tailwind.config.ts            Konfigurasi Tailwind
├── next.config.mjs               Host gambar luar yang boleh dioptimasi
├── design.md                     Sistem desain (genre, tipografi, skala)
├── public/sw.js                  Service worker (mode luring)
│
├── Proyek_Karang/                ← SISTEM AI DETEKSI KARANG (Python, rekan peneliti)
│   ├── kamera_deteksi.py         ★ Server multi-kamera — sumber stream & statistik
│   ├── coral_logic.py            Logika murni: kesehatan HSV + CoralTracker
│   ├── app_web.py                Server kamera tunggal (versi lama/demo)
│   ├── app_karang.py             Aplikasi desktop standalone
│   ├── tests/                    Uji unit (pytest)
│   └── tools/, data.yaml, best.pt  Pelatihan model — di luar cakupan dokumen ini
│
└── firmware/                     ← ESP32 (rekan peneliti)
    └── WeatherStation_RTDB/*.ino Baca sensor → PUT ke RTDB tiap 5 detik
```

---

## 7. Pola Arsitektur

### Pemisahan lapisan

Lapisan data (`lib/`) terpisah dari lapisan tampilan (`components/`). **Tidak
ada satu pun komponen yang memanggil `addDoc`/`updateDoc` Firestore secara
langsung** — semuanya lewat fungsi bernama di `lib/firestore.ts`.

Pola yang dipakai:

- **Repository sederhana** — `lib/firestore.ts` sebagai satu-satunya pintu ke
  Firestore dari sisi klien.
- **Custom Hooks** untuk keadaan yang dipakai lintas halaman: `useAuth`,
  `useLocations`, `useSaved`, `useTheme`, `useLang`.

### Penjagaan di server, bukan di layar

Prinsip yang berlaku di seluruh kode ini: **layar boleh menolak lebih dulu demi
kenyamanan, tetapi keputusannya selalu diulang di server.**

Contoh konkretnya:

| Yang dijaga | Di layar | Di server |
|---|---|---|
| Stok item | Tombol `+` mati saat menyentuh sisa | Dihitung ulang dalam transaksi di cabang `pay` |
| Harga | Ringkasan menampilkan estimasi | Dihitung ulang dari dokumen destinasi; harga dari klien diabaikan |
| Email terverifikasi | Formulir menampilkan ajakan verifikasi | `/api/bookings` menolak token tanpa `email_verified` |
| Versi perjanjian | Ditampilkan di formulir | Diambil dari konstanta server, bukan dari badan permintaan |
| Peran pemanggil | Menu disembunyikan | Dibaca ulang dari Firestore lewat Admin SDK |

Koleksi `bookings` tertutup rapat untuk tulis dari klien — Admin SDK melewati
rules, jadi seluruh perubahan status tiket **harus** lewat `/api/bookings`.

### Gambar luar lewat `next/image`

Hero beranda memuat foto dari Wikimedia yang berkas aslinya **7,2 MB**. Sebagai
`<img>` polos, foto itu sendirian memakan 5,6 detik dan menahan LCP beranda di
7,9 detik. Sekarang hero melewati `next/image`: gambarnya dikecilkan dan
disajikan sebagai WebP/AVIF sesuai lebar layar, dan atribut `fill` memesan
ruang tata letaknya lebih dulu sehingga pergeseran isi halaman ikut hilang.

Host yang boleh dioptimasi didaftarkan **satu per satu** di `next.config.mjs`:

```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'upload.wikimedia.org' },
    { protocol: 'https', hostname: 'commons.wikimedia.org' },
  ],
}
```

Bukan wildcard `'**'`. Wildcard menjadikan situs ini **proksi gambar terbuka**:
siapa pun boleh menyuruhnya mengunduh dan mengecilkan gambar dari host mana
saja, atas biaya dan atas nama domain kita.

Yang melewati `next/image` sampai sekarang **hanya hero**. Enam belas `<img>`
lainnya — termasuk foto destinasi dari Cloud Storage — masih polos, dan itu
sebabnya `firebasestorage.googleapis.com` belum perlu ada di daftar. Kalau
salah satunya kelak dipindah ke `next/image`, **hostnya harus ditambahkan lebih
dulu**; kalau tidak, gambarnya gagal muat tanpa pesan yang menjelaskan kenapa.

---

## 8. Model Data

### Firestore

| Koleksi | ID dokumen | Isi penting |
|---|---|---|
| `users` | `uid` dari Auth | `name, email, role, phone, saved[], verification{}` |
| `destinations` | auto-id | `name, location, tags[], priceItems[], images[], lat/lng, whatsapp, hasMonitoring, stationId, managerUid, cameraStreamId, parentId` |
| `bookings` | auto-id (20 karakter) | `userId, destinationId, date, items[], amount, status, paymentStatus, orderId, snapToken, holdUntil, paidAt, checkedInAt`. Ditambah `guests` untuk booking lama — tidak pernah ditulis lagi, hanya cadangan tampilan kalau `items` belum ada |
| `cameras` | auto-id | `cameraId (6 karakter), name, location, ownerUid, source, status, isPublic, viewers[]` |
| `reviews` | **`{destinationId}_{userId}`** | `rating (1–5), comment, userName` |
| `settings` | `cameraServer` | `baseUrl` server kamera |
| `loginCodes` | kunci turunan email | `hash, createdAt, attempts` |
| `monitoring_data` | — | Peninggalan, tidak dipakai lagi |

**Catatan desain — foto disimpan sebagai URL.** `image` (foto utama),
`images[]` (galeri), dan `priceItems[].image` (foto item harga) berisi **string
URL**, bukan referensi berkas. Sejak foto diunggah lewat Cloud Storage, isinya
adalah URL unduhan hasil `getDownloadURL()`; sebelum itu isinya tautan luar yang
diketik manual. Kedua bentuk itu tetap berdampingan dan sama-sama tampil —
tidak ada migrasi skema, dan destinasi lama tidak perlu disentuh.

**Catatan desain — ID ulasan deterministik.** ID dokumen ulasan sengaja disusun
sebagai `${destinationId}_${userId}`. Akibatnya satu pengguna **secara
struktural** tidak mungkin punya dua ulasan untuk destinasi yang sama. Ini bukan
validasi yang bisa dilewati, melainkan konsekuensi dari desain kunci. Rules
menegakkan hal yang sama di sisi server.

### Status booking

Dua kolom status berjalan berdampingan:

| Kolom | Nilai | Ditulis oleh |
|---|---|---|
| `status` | `pending` → `confirmed` → `used`, atau `cancelled` | `/api/bookings` dan webhook |
| `paymentStatus` | `unpaid` → `pending` → `paid` | Cabang `pay` dan webhook Midtrans |

Booking lahir sebagai `pending` + `unpaid`. **Tiket QR hanya terbit kalau
`paymentStatus === 'paid'`**, dan satu-satunya yang boleh menulis `paid` adalah
webhook Midtrans.

Lencana status di layar tidak memetakan `status` satu lawan satu. Nilainya
diturunkan `kunciStatusBooking()` (`lib/format.ts`) dari kombinasi `status`,
`paymentStatus`, dan tanggal — termasuk **Kedaluwarsa** untuk booking yang
tanggalnya sudah lewat tanpa pernah lunas. Tidak ada nilai `expired` yang
tersimpan di Firestore; label itu murni turunan.

### Realtime Database

```
monitoring/
  └── <stationId>/          ← ID paket sensor, mis. "bahoi"
        └── latest          ← ESP32 PUT ke sini tiap 5 detik
              { tempDHT, humidity, tempDS18, rainStatus, rainValue,
                windSpeed, flowRate, updatedAt,
                latitude, longitude, altitude, speed, satellites, gpsValid }
```

Pemetaan destinasi ke cabang RTDB ada di `stationPath()` (`lib/realtime.ts`).
Ada penanganan kompatibilitas mundur: stasiun pertama yang firmware-nya belum
diberi ID tetap dibaca dari `monitoring/latest`.

### Peran pengguna

| Peran | Sumber | Cara naik |
|---|---|---|
| `user` | Bawaan saat dokumen dibuat | Otomatis |
| `pengelola` | `users/{uid}.role` | Tiket dibuka admin → formulir → disetujui admin |
| `admin` | `users/{uid}.role` | Diatur manual di basis data |

Peran dibaca real-time oleh `useUserRole()` (`lib/useAuth.ts`). Kalau admin
menurunkan peran seseorang, antarmuka orang itu berubah seketika tanpa perlu
keluar dan masuk lagi.

---

## 9. Keamanan

### Aturan Firestore

`firestore.rules` mengatur delapan blok: `loginCodes`, `users`, `destinations`,
`monitoring_data`, `bookings`, `cameras`, `reviews`, dan `settings`.

Prinsip yang berlaku:

- **`users`** — membuat dokumen sendiri hanya boleh dengan `role == 'user'`.
  Pemilik boleh memperbarui dokumennya **selama perannya tidak berubah**. Hanya
  admin yang boleh mengubah peran, wilayah pengelola, dan status pengajuan.
- **`bookings`** — tulis dari klien ditutup sepenuhnya. Semua lewat
  `/api/bookings`.
- **`cameras`** — penonton diizinkan lewat pemeriksaan `email in
  resource.data.viewers`. Karena itu bergantung pada isi tiap dokumen, **query
  koleksi tidak bisa dipakai** — Firestore menolak seluruh query alih-alih
  menyaringnya. Halaman monitoring karenanya berlangganan dokumen kamera satu
  per satu, dan yang ditolak rules jatuh menjadi `null` lalu tidak ditampilkan.
- **`reviews`** — satu ulasan per pengguna per destinasi, ditegakkan lewat ID
  deterministik.

### Aturan Realtime Database

`database.rules.json` menutup seluruh pohon secara bawaan dan hanya membuka
cabang `monitoring`:

- Baca `monitoring` terbuka — angka sensor memang tayang untuk pengunjung
  anonim di hero beranda dan halaman destinasi.
- Tulis hanya diizinkan di `monitoring/latest` dan `monitoring/<stationId>/latest`.
- Penghapusan dan penulisan di luar `monitoring` tertutup.

**Yang masih terbuka:** menulis ke `monitoring` belum menuntut identitas, jadi
pihak yang tahu URL basis data masih bisa menimpa angka sensornya. Menutupnya
menuntut firmware punya cara membuktikan diri (custom token / uid khusus).
Blok `.validate` untuk membatasi kewajaran nilai sudah disiapkan dalam bentuk
komentar di berkas yang sama, tinggal dihidupkan setelah bentuk tulisan
firmware dipastikan.

### Aturan Cloud Storage

`storage.rules` hanya membuka satu awalan, `destinasi/`, tempat seluruh foto
destinasi disimpan dengan nama acak (UUID). Awalan lain tertutup rapat.

| Operasi | Siapa | Syarat tambahan |
|---|---|---|
| `get` (buka satu foto) | Siapa saja, tanpa masuk | — foto memang tayang di halaman publik |
| `list` (telusuri isi) | **Tidak ada** | Membuka satu foto yang URL-nya sudah dipasang di dokumen berbeda dengan boleh menelusuri seluruh isi bucket |
| `create` (unggah) | `admin` dan `pengelola` | `image/*` dan di bawah 10 MB |
| `update` / `delete` | **Tidak ada** | Nama berkas selalu acak, jadi menimpa tidak pernah terjadi; penghapusan dilakukan dari sisi server |

Perannya dibaca dari `users/{uid}` di Firestore lewat `firestore.get()` —
*cross-service Rules*. Konsekuensinya ada di dua tempat:

1. Fitur itu menuntut peran IAM `roles/firebaserules.firestoreServiceAgent`
   pada *service agent* Firebase Rules. Firebase CLI memberikannya sendiri saat
   penerapan pertama, **asal dijalankan dari terminal interaktif** — lihat
   bagian 4 dan bagian 19.
2. `allow create` sengaja dipakai alih-alih `allow write`. `write` ikut
   mencakup `delete`, dan pada `delete` nilai `request.resource` adalah `null`,
   sehingga pemeriksaan ukuran dan tipe berkas berubah menjadi galat evaluasi,
   bukan penolakan yang bersih.

Batas 10 MB ditegakkan dua kali: di `storage.rules` dan di `MAX_FOTO_BYTES`
(`lib/storage.ts`). Yang di klien bukan pengganti yang di server — gunanya
supaya penolakan bisa dibaca pengguna, bukan muncul sebagai
`storage/unauthorized` setelah berkasnya terlanjur terkirim.
`lib/storage.check.ts` membaca kedua berkas itu dan menuntut angkanya sama.

### Pemeriksaan di route API

| Route | Gerbang |
|---|---|
| `/api/bookings` (POST) | ID token wajib + `email_verified` wajib + peran dibaca ulang dari Firestore |
| `/api/role-request` | ID token wajib + status pengajuan harus `invited` |
| `/api/notify-approval` | ID token wajib + peran pemanggil harus `admin` |
| `/api/delete-user` | ID token wajib + peran pemanggil harus `admin` + tidak boleh menghapus diri sendiri |
| `/api/payments/midtrans` | **Tanpa** ID token — tanda tangan SHA512 yang jadi autentikasi |
| `/api/auth/*` | Terbuka, dibatasi jeda kirim ulang 60 detik per email |
| `/api/chat` | Terbuka, dibatasi *throttle* per alamat IP |

**Sanitasi ID dokumen.** Semua identitas yang menyusun path dokumen melewati
`docId()` (`lib/format.ts`). Path Firestore bersegmen — tanpa penyaringan,
masukan seperti `abc/subkoleksi/xyz` akan menunjuk dokumen lain.

### Pengelolaan rahasia

- `.env.local` dan berkas *service account* JSON **tidak** masuk ke Git.
- Kunci Server Midtrans, kata sandi SMTP, dan kunci Gemini semuanya
  **server-only** — tidak boleh memakai awalan `NEXT_PUBLIC_`.
- Kredensial WiFi di firmware disimpan sebagai konstanta di berkas `.ino`
  (`ssid` dan `password` di bagian atas berkas). Ganti nilainya sesuai jaringan
  di lokasi, dan **jangan** membagikan berkas `.ino` yang sudah terisi.
- Berkas `.ino` sendiri tidak masuk repositori publik — lihat `.gitignore`.

---

## 10. Referensi API

Seluruh route berjalan dengan `runtime = 'nodejs'`.

Autentikasi memakai header:

```
Authorization: Bearer <Firebase ID token>
```

### `GET /api/bookings`

Sisa stok tiap item destinasi. **Tanpa autentikasi** — yang dikembalikan hanya
angka agregat, tanpa nama, telepon, atau ID booking siapa pun. Halaman booking
perlu menampilkan sisa kursi sebelum pengunjung masuk akun.

| Parameter | Wajib | Keterangan |
|---|---|---|
| `dest` | ya | ID destinasi |
| `date` | ya, kecuali `days=1` | Format `YYYY-MM-DD` |
| `days` | tidak | `1` untuk mengambil sisa banyak tanggal sekaligus |

**Balasan:**

```jsonc
// mode satu tanggal
{ "items": [ { "id": "...", "stock": 50, "booked": 12, "left": 38 } ] }

// mode banyak tanggal (days=1)
{ "items": [ /* ketersediaan penuh */ ],
  "days": { "2026-08-25": [ /* ... */ ] } }
```

Tanggal yang tidak disebut di `days` berarti belum ada penjualan sama sekali.

**Galat:** `400 bad-request`, `404 destination-notfound`.

### `POST /api/bookings`

Satu-satunya pintu tulis koleksi `bookings`. **Wajib** ID token dan
`email_verified`. Aksinya ditentukan kolom `action` di badan permintaan.

| Aksi | Badan | Fungsi |
|---|---|---|
| `create` | `destinationId, date, phone, notes, qty, hours` | Membuat booking berstatus `pending` + `unpaid`. Harga dihitung ulang server |
| `update` | `bookingId, date, phone, notes, qty, hours` | Mengubah booking yang belum dibayar |
| `pay` | `bookingId` | Membuat transaksi Snap. Balasannya `{ token, snapUrl }` |
| `sync` | `bookingId` | Menanyakan status tagihan ke Midtrans lalu menerapkannya. Jaring pengaman kalau webhook tidak sampai |
| `cancel` | `bookingId` | Membatalkan booking sendiri |
| `checkin` | `bookingId` | Menandai tiket terpakai. Hanya admin/pengelola |

**Kode galat yang perlu dikenali klien:**

| Kode | Arti |
|---|---|
| `unauthorized` (401) | Token tidak ada atau tidak sah |
| `email-not-verified` (403) | Email belum terverifikasi |
| `forbidden` (403) | Bukan pemilik booking, atau bukan admin/pengelola untuk check-in |
| `full` | Stok item keburu habis |
| `too-many-unpaid` | Sudah ada 3 booking belum dibayar |
| `already-paid` / `cancelled` | Booking tidak bisa diubah lagi |
| `already-used` | Tiket sudah dipindai |
| `payment-pending` (409) | Aksi ditolak karena booking belum lunas — dipakai `checkin`, `update`, dan `cancel` |
| `notfound` (404) | Booking tidak ada |
| `destination-notfound` (404) | Destinasi rujukan tidak ada |
| `no-items` / `bad-qty` / `bad-date` / `past-date` (400) | Item kosong, jumlah tidak masuk akal, tanggal salah bentuk, atau tanggal sudah lewat |
| `missing-field` / `bad-request` / `bad-action` (400) | Masukan tidak lengkap atau tidak dikenali |
| `bad-amount` (500) | Total hitungan ulang server tidak wajar — permintaan ditolak, bukan diteruskan ke Midtrans |
| `gateway-error` (502) | Midtrans tidak bisa dihubungi |

**Catatan penting:**

- **Harga tidak diterima dari klien.** Server membaca dokumen destinasinya
  sendiri dan menghitung ulang total dengan rumus yang sama seperti ringkasan
  di layar (`bookingLines`/`bookingTotal` di `lib/destination.ts`).
- **Nama pemesan dibaca dari Auth**, bukan dari badan permintaan.
- **Stok ditegakkan di cabang `pay`, bukan `create`.** Booking yang belum
  dibayar sengaja tidak menahan kursi.
- **Batas 3 booking menggantung** (`MAX_UNPAID`) adalah penjaga sampah, bukan
  penjaga uang. Membayar atau membatalkan langsung mengembalikan jatahnya.

### `POST /api/auth/request-code`

Mengirim kode masuk 6 digit ke email.

**Badan:** `{ "email": "..." }`
**Balasan:** `{ "ok": true }`

Balasan **selalu** `ok: true` untuk email berformat benar — terdaftar maupun
belum. Kalau endpoint ini membedakan keduanya, siapa pun bisa memakainya untuk
mengecek email mana yang punya akun.

**Galat:** `400 email-invalid`, `429 cooldown` (jeda 60 detik belum habis),
`500 send-failed`.

### `POST /api/auth/verify-code`

Menukar kode 6 digit dengan custom token Firebase. Akun dibuat di sini kalau
emailnya belum pernah masuk — pendaftaran dan masuk adalah satu jalur.

**Badan:** `{ "email": "...", "code": "123456" }`
**Balasan:** `{ "token": "<custom token>" }`

**Galat:** `400 wrong` (kode salah, jatah tebakan berkurang), `400 expired` /
`400 none` (kode hangus, minta baru), `400 locked` (jatah tebakan habis),
`400 bad-request`, `500 server`.

Kode bersifat **sekali pakai** dan dihapus sebelum token dibuat, sehingga kode
yang sama tidak bisa ditukar dua kali oleh dua permintaan yang datang bersamaan.

### `POST /api/payments/midtrans`

Webhook Midtrans. **Satu-satunya tempat booking boleh menjadi `paid`.**

Tidak memakai `verifyIdToken` — Midtrans tidak punya akun di sistem ini. Tanda
tangan **SHA512** pada badan permintaannya yang jadi autentikasi, dan tidak ada
satu pun jalan keluar yang melewatkan pemeriksaan itu.

Yang **tidak** dipercaya dari notifikasi:

- **Jumlahnya** — dicocokkan dengan `amount` booking saat itu juga (toleransi
  1 rupiah, karena Midtrans mengirim desimal sebagai string).
- **Nomor pesanannya** — `order_id` dicocokkan dengan yang tersimpan, supaya
  notifikasi tagihan lama yang kedaluwarsa tidak menganulir tagihan berjalan.

Format `order_id`: `<bookingId>-<nomor percobaan>`.

Balasan selalu `200` selama tanda tangannya sah — termasuk untuk hal yang tidak
diurus. Midtrans mengulang kiriman yang tidak dibalas `200`.

**Galat:** `400 bad-request`, `403 bad-signature`.

### `POST /api/role-request`

Satu-satunya pintu tulis `users/{uid}.verification` dari sisi pengaju. **Wajib**
ID token.

**Badan:** `fullName, phone, organization, destination, destinationLocation,
destinationDescription, landRights, declaredRights, agreed`

Pemeriksaan yang dilakukan:

- Status pengajuan harus `invited` — tiket hanya bisa dibuka admin.
- Validasi memakai fungsi yang **sama persis** dengan yang dipakai formulir
  (`validateRoleRequest`), sehingga server tidak pernah menerima apa yang layar
  tolak, maupun sebaliknya.
- `landRights` wajib salah satu dari daftar resmi — `<select>` di layar bukan
  penjaga, ia hanya tampilan.
- **`agreementVersion` diambil dari konstanta server**, bukan dari badan
  permintaan. Inilah inti penjagaannya: yang tercatat selalu versi perjanjian
  yang benar-benar berlaku saat pengajuan dikirim.

**Galat:** `401 unauthorized`, `403 not-invited`, `400` dengan kunci kamus
validasi (agar formulir bisa menampilkan pesan yang sama seperti validasi di
layar).

### `POST /api/notify-approval`

Mengirim email pemberitahuan saat admin menyetujui pengajuan pengelola.
**Hanya admin.**

**Badan:** `{ "uid": "..." }`
**Galat:** `401 unauthorized`, `403 forbidden`, `400 bad-request`,
`404 no-email`, `500 send-failed`.

### `DELETE /api/delete-user`

Menghapus akun sekaligus: Auth **dan** dokumen `users/{uid}`. **Hanya admin.**

**Parameter:** `?uid=<uid>`

Menghapus lewat Firebase Console hanya menghapus data di Auth dan meninggalkan
dokumen Firestore yang menumpuk di daftar pengguna. Route ini sekaligus
membersihkan sisa akun yang terlanjur dihapus dari Console.

**Galat:** `401 unauthorized`, `403 forbidden`, `400 bad-request`,
`400 self-delete`, `500 delete-failed`.

### `POST /api/send-verification`

Mengirim email verifikasi lewat SMTP sendiri. Peninggalan era kata sandi —
akun baru sudah otomatis terverifikasi lewat jalur kode masuk.

**Badan:** `{ "email": "..." }`

Membalas `ok: true` juga untuk email yang tidak terdaftar, agar tidak
membocorkan email mana yang punya akun.

**Galat:** `400 email-required`, `500 link-failed`, `500 send-failed`.

### `POST /api/chat`

> **Di luar pembahasan skripsi.** Asisten chat adalah fitur pendukung yang ada
> di sistem tetapi tidak dibahas dalam naskah skripsi. Didokumentasikan di sini
> supaya manual mencerminkan sistem yang benar-benar berjalan.

Proxy ke Google Gemini, dilengkapi konteks katalog destinasi.

**Badan:** `{ "messages": [ { "role": "user"|"assistant", "text": "..." } ] }`

Riwayat dipangkas ke sejumlah giliran terakhir, dan panjang tiap pesan dibatasi.
Percakapan dikirim dengan `store: false` sehingga tidak disimpan di sisi Google.
Kalau pembacaan katalog gagal, bot tetap menjawab — hanya tidak bisa menyebut
harga.

**Galat:** `503 not-configured` (kunci API belum diset), `429 too-many-requests`
(batas laju sendiri), `400 bad-request`, `429 quota` (kuota Gemini habis),
`502 upstream-unreachable` (Gemini tidak bisa dihubungi), `502 upstream-error`
(Gemini menjawab dengan galat), `502 empty-reply` (balasan Gemini kosong).

---

## 11. Alur Pembayaran Midtrans

### Urutan lengkap

```
1. Pengguna menekan tombol bayar
      │
2. Klien → POST /api/bookings { action: 'pay', bookingId }
      │
3. Server (dalam satu transaksi Firestore):
      ├─ periksa kepemilikan booking
      ├─ periksa belum dibayar & belum dibatalkan
      ├─ periksa stok tiap item pada tanggal itu
      ├─ kalau ada tagihan hidup → kembalikan token LAMA yang sama
      └─ kalau belum → buat transaksi Snap, simpan orderId + holdUntil (15 menit)
      │
4. Balasan { token, snapUrl } → klien
      │
5. Klien memuat snap.js DARI snapUrl yang dikirim server, buka popup
      │
6. Pengguna memindai QRIS dan membayar
      │
7. Midtrans → POST /api/payments/midtrans (webhook)
      ├─ verifikasi tanda tangan SHA512
      └─ terapkanStatus() ─ cocokkan order_id & jumlah,
                            tulis paymentStatus: 'paid', status: 'confirmed'
      │
8. Listener onSnapshot di PaymentModal melihat perubahan → layar "Lunas"
```

### Jalur cadangan: menarik status sendiri

Langkah 7 mengandaikan webhooknya sampai. Kalau tidak — terowongan mati saat
pengembangan, penerapan baru berjalan tepat di detik itu, atau alamat
notifikasi di dasbor Midtrans salah — uangnya sudah masuk sementara bookingnya
tinggal di `pending` selamanya, tanpa tiket dan tanpa jejak.

Karena itu ada jalur kedua yang arahnya terbalik:

```
Daftar booking dimuat (BookingHistory)
      │
      ├─ untuk tiap booking berstatus 'pending' (sekali saja per sesi)
      │
      └─ POST /api/bookings { action: 'sync', bookingId }
            ├─ periksa kepemilikan booking
            ├─ cekStatus(orderId) — panggilan keluar ke Midtrans
            └─ terapkanStatus() ← fungsi yang sama dengan langkah 7
```

**Klien hanya menyebut `bookingId`.** Status pembayaran tidak pernah datang
dari badan permintaan klien; yang dipercaya cuma jawaban panggilan keluar kita
sendiri ke Midtrans.

Hasilnya sengaja tidak ditunggu dan kegagalannya tidak ditampilkan — yang
menyalakan tiket tetap `onSnapshot` di langkah 8. Pemanggilannya diletakkan di
`BookingHistory`, **bukan** di lonceng notifikasi: lonceng ikut ter-render di
setiap halaman, jadi di sana artinya satu panggilan keluar tiap pindah halaman.
Di tempatnya sekarang, jumlahnya dibatasi kuota tiga booking belum-bayar.

### Keputusan desain yang penting

**Dorong dan tarik memakai satu fungsi yang sama.** Keduanya bermuara di
`terapkanStatus()` pada `lib/pembayaran.ts` — satu-satunya tempat di seluruh
kode yang boleh menulis `paymentStatus: 'paid'`. Salinan kedua dari aturan ini
adalah salinan yang kelak longgar, dan yang longgar itu pintu masuk tiket
gratis. Fungsinya idempoten: notifikasi yang sama boleh datang berkali-kali,
dan webhook yang kebetulan tiba bersamaan dengan `sync` tidak menulis dua kali.

**Dua keadaan yang sengaja tidak diselesaikan sendiri.** Pembayaran untuk
`orderId` yang sudah basi (`order-basi`) dan jumlah yang tidak cocok dengan
tagihan (`jumlah-beda`) sama-sama berarti uang sudah diterima untuk sesuatu
yang tidak bisa dipetakan ke tiket. Keduanya tidak boleh diam-diam jadi tiket,
dan tidak boleh diam-diam hilang — jadi ditulis ke `console.error` untuk
ditangani manual, bukan ditebak.

**Alamat skrip Snap dikirim server bersama tokennya**, bukan diambil dari
variabel lingkungan di sisi klien. Kalau alamat skrip dan token berasal dari dua
sumber, popup produksi bisa termuat untuk token sandbox, dan kegagalannya baru
terlihat sebagai "token tidak dikenal".

**Layar "Lunas" ditentukan dokumen booking, bukan callback Snap.** Callback
`onSuccess` berjalan di browser pembeli dan bisa dipanggil siapa saja dari
konsol. Yang menulis `paid` hanya webhook, jadi di situlah kabarnya ditunggu —
lewat `onSnapshot`, tanpa polling sama sekali.

**Penahanan kursi 15 menit** (`HOLD_MENIT`). Selama jendela itu, booking
dihitung sebagai pemakai stok meski belum lunas — uang bisa diambil sebelum
webhook memberi tahu kita. Kalau pembayaran gagal atau kedaluwarsa,
`paymentStatus` kembali ke `unpaid` dan penahanannya lepas.

**Menekan bayar dua kali mengembalikan token yang sama.** Menerbitkan token
baru akan menahan kursi dua kali untuk satu orang, sementara tagihan lama tetap
hidup di sisi Midtrans sampai kedaluwarsa.

### Menguji webhook dari mesin lokal

Webhook memerlukan alamat publik. Untuk pengembangan:

```bash
npm run tunnel        # membuka terowongan ke port 3000
```

Daftarkan URL terowongan + `/api/payments/midtrans` sebagai **Payment
Notification URL** di dasbor Midtrans sandbox, atau setel
`MIDTRANS_NOTIFICATION_URL` ke alamat itu.

### Beralih ke produksi

1. Ganti `MIDTRANS_SERVER_KEY` dan `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` dengan
   kunci produksi.
2. Setel `MIDTRANS_IS_PRODUCTION=true`. **Satu saklar ini** yang menentukan
   host (`app.midtrans.com` vs `app.sandbox.midtrans.com`) sekaligus alamat
   `snap.js`, sehingga keduanya tidak mungkin berselisih.
3. Daftarkan URL webhook produksi di dasbor Midtrans.
4. Uji satu transaksi nyata bernilai kecil sebelum diumumkan.

---

## 12. Dua Bahasa (i18n)

Kamus terpusat di `lib/i18n.ts` dalam bentuk objek `DICT`:

```ts
"nav.home": { id: "Beranda", en: "Home" },
```

Komponen mengambilnya lewat hook `useLang()`:

```tsx
const { t, lang, setLang, locale } = useLang();
<span>{t('nav.home')}</span>
<span>{t('booking.remaining', { n: '5' })}</span>   // dengan interpolasi
```

**Menambah teks baru:**

1. Tambahkan pasangan kunci beserta `id` dan `en` di `DICT`.
2. Panggil dengan `t('kunci.baru')` di komponen.
3. Jalankan pemeriksaannya:

```bash
node lib/i18n.check.ts            # kelengkapan kamus
node lib/i18nHardcoded.check.ts   # mendeteksi teks yang lupa dimasukkan kamus
```

**Konvensi penting:** simpan **kunci kamus** di state, bukan kalimat jadi.
Kalau bahasa diganti saat pesan galat sedang tampil, pesannya ikut berganti.
Lihat `AuthForm.tsx` sebagai contoh — `error` dan `notice` menyimpan kunci.

Pilihan bahasa tersimpan di `localStorage` dan disamakan ke atribut `lang` pada
elemen `<html>` sebelum paint pertama, supaya pembaca layar tidak salah
menyebut bahasa halaman.

---

## 13. Tema dan Token Desain

- **`tokens.css`** — sumber tunggal warna, spasi, radius, dan durasi gerak.
- **`tailwind.config.ts`** — memetakan token itu ke kelas Tailwind
  (`bg-shore-50`, `text-navy`, `duration-micro`, dsb.).
- **`design.md`** — sistem desain lengkap: genre, makrostruktur, skala
  tipografi, dan aturan per halaman.

**Mode gelap** memakai strategi kelas `.dark` pada elemen `<html>`. Tema
tersimpan diterapkan lewat skrip inline di `<head>` **sebelum paint pertama**,
supaya tidak ada kedipan terang-ke-gelap. Preferensi sistem operasi **sengaja
diabaikan** — gelap hanya menyala kalau pengunjung memilihnya di Pengaturan.

**Font:** Figtree (sans) dan Cormorant (serif), dimuat lewat `next/font/google`
sebagai variabel CSS `--font-sans` dan `--font-serif`.

---

## 14. PWA dan Service Worker

- **`app/manifest.ts`** — manifest PWA (nama, ikon, warna tema `#1B8A8F`).
- **`public/sw.js`** — service worker untuk mode luring.
- **iOS** mengabaikan `display: standalone` di manifest, jadi padanannya
  dipasang lewat `metadata.appleWebApp` di `app/layout.tsx`.

**Service worker hanya didaftarkan di produksi** (`NODE_ENV === 'production'`).
Di lingkungan pengembangan, shell yang ter-cache akan menutupi hasil edit dan
membuat *hot reload* tampak rusak.

---

## 15. Server Kamera dan Deteksi Karang

> **Sistem eksternal.** Server kamera dan model deteksinya dikerjakan rekan
> peneliti. Bab ini mendokumentasikan **antarmuka yang dipakai aplikasi web** —
> cara menyalakan server saat demo, endpoint yang dikonsumsi, dan cara
> menautkannya. Pelatihan model, dataset, dan bobotnya di luar cakupan.

Sub-sistem terpisah di `Proyek_Karang/`. Berjalan di laptop atau VPS, **bukan**
di Vercel.

### Menjalankan

```bash
cd Proyek_Karang
source venv_mac/bin/activate          # macOS

# Server multi-kamera + deteksi (yang dipakai website)
python kamera_deteksi.py                        # port bawaan 5001
python kamera_deteksi.py --port 5002            # kalau 5001 sudah terpakai
python kamera_deteksi.py --password rahasiaku   # kata sandi halaman kelola
```

Tanpa `--password`, kata sandi acak dicetak di terminal saat server menyala
(nama pengguna bebas). Halaman kelola dilindungi Basic Auth; stream sendiri
tetap terbuka karena ID kamera bersifat acak dan `<img>` MJPEG tidak bisa
mengirim header autentikasi.

### Endpoint per kamera

| Endpoint | Isi |
|---|---|
| `/stream/<id>` | Aliran MJPEG dengan anotasi YOLO |
| `/snapshot/<id>` | Satu bingkai JPEG |
| `/stats/<id>` | Statistik deteksi (JSON) |
| `/history/<id>` | Riwayat deteksi (JSON) |

### Menghubungkan ke website

1. Buka `http://<alamat-server>:<port>` dan daftarkan kamera. Server memberikan
   **ID pendek**.
2. Di website, buka **Dashboard › Kamera**, isi **Alamat Server Kamera** —
   tersimpan di dokumen Firestore `settings/cameraServer`.
3. Tambahkan kamera dengan ID pendek tadi, tautkan ke destinasi yang sesuai.

### Perilaku deteksi

Deteksi **hanya berjalan saat kamera sedang ditonton**. Model YOLO dimuat per
kamera saat penonton pertama datang, dan dilepas kira-kira 30 detik setelah
penonton terakhir pergi. Statistik dan riwayat terkumpul selama sesi menonton.

Logika murni (klasifikasi kesehatan berbasis HSV dan `CoralTracker`) dipisahkan
ke `coral_logic.py` supaya bisa diuji tanpa kamera — lihat `Proyek_Karang/tests/`.

### Berkas lain

| Berkas | Fungsi |
|---|---|
| `app_web.py` | Server kamera tunggal, versi lama/demo |
| `app_karang.py` | Aplikasi desktop GUI standalone |

Berkas pelatihan model (`tools/`, `data.yaml`, `best.pt`) tidak dirinci di sini —
lihat `Proyek_Karang/README.md` milik rekan peneliti.

---

## 16. Firmware Stasiun Sensor

> **Sistem eksternal.** Perakitan perangkat keras dan firmware stasiun sensor
> dikerjakan rekan peneliti. Bab ini dirangkum di sini karena aplikasi web
> membaca datanya — yang menjadi bagian aplikasi web adalah **jalur datanya**
> (RTDB) dan kecocokan `STATION_ID` dengan kolom **ID stasiun** di dokumen
> destinasi. Rincian pin, pustaka, kalibrasi, dan cara flash disertakan sebagai
> rujukan operasional, bukan sebagai kontribusi penulis.

Berkas: `firmware/WeatherStation_RTDB/WeatherStation_RTDB.ino`
Papan: **ESP32**

### Sensor dan pin

| Sensor | Pin | Mengukur |
|---|---|---|
| DHT22 | GPIO 4 | Suhu udara + kelembapan |
| DS18B20 (OneWire) | GPIO 5 | Suhu air |
| Sensor hujan | GPIO 35 | Status & nilai curah hujan |
| Sensor aliran air | GPIO 14 | Laju aliran (interupsi pulsa) |
| Anemometer | GPIO 15 | Kecepatan angin (interupsi pulsa) |
| GPS (TinyGPS++) | `HardwareSerial(2)` | Koordinat, ketinggian, satelit |

### Pustaka Arduino yang dibutuhkan

`DHT.h` · `DallasTemperature.h` · `OneWire.h` · `TinyGPS++.h` · `WiFi.h` ·
`WiFiClientSecure.h` · `HTTPClient.h` · `WebServer.h` · `HardwareSerial.h`

### Konfigurasi sebelum flash

Buka berkas `.ino` dan sesuaikan konstanta di bagian atas:

| Konstanta | Isi |
|---|---|
| `ssid`, `password` | Kredensial WiFi di lokasi |
| `STATION_ID` | Penanda paket sensor. **Harus sama** dengan kolom **ID stasiun** di dokumen destinasi. Dikosongkan berarti menulis ke path lama `monitoring/latest` |
| `RTDB_HOST` | URL Realtime Database |
| `RTDB_INTERVAL` | Jeda kirim, bawaan `5000` ms |

### Faktor kalibrasi

Dua nilai berikut menyesuaikan pembacaan dengan perangkat keras yang
sebenarnya. Sensor nyata tidak pernah sepersis lembar data — sesuaikan setelah
pengukuran pembanding di lapangan:

| Konstanta | Bawaan | Untuk |
|---|---|---|
| `calibrationFactor` | `7.5` | Sensor aliran air — pulsa per liter/menit |
| `WIND_FACTOR` | `0.5` | Anemometer — pulsa ke m/s |

### Cara flash

1. Buka berkas `.ino` di Arduino IDE.
2. Pilih papan **ESP32 Dev Module** dan port yang sesuai.
3. Pasang seluruh pustaka di daftar di atas lewat Library Manager.
4. Sesuaikan konstanta konfigurasi.
5. Upload, lalu buka Serial Monitor untuk memastikan WiFi tersambung dan
   pengiriman ke RTDB berhasil.

### Jalur data

Firmware mengirim `PUT` ke `monitoring/<STATION_ID>/latest` setiap 5 detik.
Karena rules RTDB membuka cabang itu tanpa autentikasi, tidak ada token yang
perlu dipasang di firmware. Firmware juga menjalankan web server lokal kecil
untuk memeriksa pembacaan sensor langsung dari jaringan yang sama.

---

## 17. Penerapan (Deployment)

### Aplikasi web ke Vercel

1. Hubungkan repositori `OTA-React-nextjs` ke proyek Vercel. Akar repositori
   sudah berisi `package.json`, jadi **Root Directory** dibiarkan bawaan.
2. Masukkan seluruh variabel lingkungan dari [bagian 5](#5-variabel-lingkungan)
   ke **Settings › Environment Variables**.
3. Deploy. Vercel mendeteksi Next.js dan memakai `npm run build` sendiri.

**Kalau deploy lewat CLI** (`vercel deploy`), perhatikan `.vercelignore`. Deploy
lewat integrasi Git memakai isi repositori sehingga `.gitignore` sudah cukup;
CLI mengunggah isi direktori kerja apa adanya, sehingga berkas yang hanya
dijaga `.gitignore` bisa ikut terbawa. `.vercelignore` menahan kunci privat
Admin SDK, `.env*.local`, `Proyek_Karang/`, `firmware/`, dokumen, dan skrip uji
— tidak satu pun dari itu di-*import* aplikasi.

**Yang perlu diperiksa setelah deploy pertama:**

- [ ] Kirim kode masuk ke satu email dan pastikan sampai (periksa juga spam).
- [ ] `SMTP_FROM` tidak terbungkus tanda kutip tambahan.
- [ ] Buat satu booking uji dan selesaikan pembayarannya. Selama
      `MIDTRANS_IS_PRODUCTION` belum dinyalakan, transaksinya memakai Sandbox
      dan tidak memindahkan uang; setelah beralih ke produksi, ulangi dengan
      nominal kecil sungguhan.
- [ ] URL webhook Midtrans mengarah ke domain produksi.
- [ ] Halaman destinasi menampilkan angka sensor.
- [ ] Scan tiket berjalan dari perangkat lapangan.

### Security rules ke Firebase

```bash
firebase deploy --only firestore:rules,database,storage
```

Jalankan **setiap kali** `firestore.rules`, `database.rules.json`, atau
`storage.rules` berubah. Berkasnya ada di repositori, tetapi yang berlaku adalah
yang sudah diterapkan ke proyek — keduanya bisa berbeda tanpa ada yang gagal.

Kalau hanya satu yang berubah, terapkan hanya yang itu:
`--only storage` saja, misalnya. Menjalankan `firebase deploy` polos akan ikut
mendorong berkas rules lain yang mungkin belum siap.

Aturan yang baru diterapkan **butuh waktu menyebar**, kira-kira sampai dua
menit. Probe yang dijalankan beberapa detik setelah penerapan bisa memberi
hasil aturan yang lama — tunggu dulu, lalu ulangi sampai hasilnya sama dua kali.

### Lokasi bucket Cloud Storage

Bucket proyek ini berada di `US-EAST1`, sedangkan Firestore-nya di
`asia-southeast1`. Selisihnya terasa sebagai waktu unggah yang sedikit lebih
lama dari Indonesia. Lokasi bucket **tidak bisa dipindah setelah dibuat** —
mengubahnya berarti membuat bucket baru dan memindahkan seluruh isinya beserta
URL yang sudah tersimpan di dokumen.

### Server kamera

Server kamera perlu berjalan di mesin yang bisa dijangkau dari internet —
laptop dengan terowongan, atau VPS. Setelah alamatnya tetap, isikan ke
**Dashboard › Kamera › Alamat Server Kamera**.

### Urutan penerapan yang disarankan

1. Terapkan security rules.
2. Deploy aplikasi web.
3. Perbarui URL webhook Midtrans.
4. Nyalakan server kamera dan perbarui alamatnya di dashboard.
5. Nyalakan stasiun sensor dan pastikan datanya masuk.

---

## 18. Pengujian

### Uji mandiri logika (`*.check.ts`)

Berkas `*.check.ts` di `lib/` adalah uji berbasis `assert` yang bisa dijalankan
dengan `node` polos, tanpa kerangka uji dan tanpa konfigurasi:

```bash
node lib/format.check.ts
node lib/destination.check.ts
node lib/loginCode.check.ts
node lib/verification.check.ts
node lib/i18n.check.ts
node lib/i18nHardcoded.check.ts
node lib/mailer.check.ts
node lib/profile.check.ts
node lib/roleRequest.check.ts
node lib/destinationKeys.check.ts
node lib/storage.check.ts
node lib/midtrans.check.ts
```

Menjalankan semuanya sekaligus, dengan ringkasan lulus/gagal:

```bash
for f in lib/*.check.ts; do printf "%-32s " "$f"; node "$f" >/dev/null 2>&1 && echo ok || echo GAGAL; done
```

> **Kenapa sebagian import memakai akhiran `.ts`.** ESM Node menuntut akhiran
> yang eksplisit, sedangkan bundler Next.js menerima bentuk tanpa akhiran.
> Modul yang punya berkas uji dan meng-*import* modul lain karena itu ditulis
> dengan akhiran — `lib/midtrans.ts` → `'./destination.ts'`, `lib/storage.ts` →
> `'./firebase.ts'` — supaya `node` polos bisa memuatnya. Itu dimungkinkan oleh
> `"allowImportingTsExtensions": true` di `tsconfig.json`, yang aman dipakai
> karena `noEmit` sudah `true`. Tanpa itu berkas ujinya jatuh dengan
> `ERR_MODULE_NOT_FOUND`.

### Probe rules dan API

Dua skrip di `scripts/` menguji penjagaan **sebagai pengguna asli**, lewat Web
SDK dan ID token sungguhan — bukan lewat Admin SDK yang melewati semua
pemeriksaan. Keduanya membaca `.env.local` dari direktori kerja, jadi
jalankan dari akar `OTA/`:

```bash
node scripts/rules.probe.mjs                       # menguji firestore.rules
node scripts/storage.probe.mjs                     # menguji storage.rules

npm run dev                                        # di terminal lain
PROBE_BASE=http://localhost:3000 node scripts/bookings.probe.mjs
```

`bookings.probe.mjs` membuktikan bahwa harga tidak bisa dikarang klien, status
dan pembayaran tidak bisa ditulis sendiri, satu QR hanya bisa dipakai sekali,
dan tiket yang belum dibayar ditolak di gerbang check-in.

`storage.probe.mjs` memakai satu boneka per peran, lalu memastikan pengunjung
anonim dan pengguna biasa ditolak mengunggah sementara `pengelola` dan `admin`
diizinkan — beserta penolakan berkas bukan gambar, berkas di atas 10 MB,
awalan selain `destinasi/`, penelusuran isi bucket, dan penghapusan dari klien.
Karena aturannya butuh waktu menyebar, skrip ini berjalan dua putaran berjarak;
hasil yang sama dua kali baru bisa dipercaya.

Ketiga skrip membuat data boneka lalu menghapusnya di blok `finally`.

### Uji server kamera

```bash
cd Proyek_Karang
source venv_mac/bin/activate
pytest tests/
```

Yang diuji adalah logika murni (`coral_logic.py`), bukan kamera.

### Lint dan build

```bash
npm run lint
npm run build
```

---

## 19. Pemeliharaan dan Pemecahan Masalah

### Kode masuk tidak terkirim di produksi

1. Periksa log fungsi di Vercel — cari `[request-code] sendMail`.
2. Pastikan `SMTP_FROM` **tanpa** tanda kutip tambahan. Ini pernah menjadi
   penyebab kegagalan total di produksi.
3. Pastikan kredensial SMTP masih berlaku dan kuota penyedia belum habis.

### `verifyIdToken` mengembalikan galat 500 di Vercel

Periksa apakah `overrides` untuk `jose` di `package.json` masih ada. Versi 6
tidak kompatibel dengan runtime Vercel di konfigurasi ini.

### Booking macet di "Belum Dibayar" padahal sudah dibayar

1. Periksa log webhook — cari `[midtrans]` di log fungsi.
2. `bad-signature` berarti `MIDTRANS_SERVER_KEY` tidak cocok dengan lingkungan
   yang aktif (sandbox vs produksi).
3. `order-basi` berarti pembayaran masuk untuk tagihan yang sudah kedaluwarsa.
   Kalau statusnya lunas, log mencatatnya sebagai `pembayaran untuk tagihan
   lama` — perlu penyelesaian manual.
4. `jumlah-beda` berarti nominal yang diterima tidak cocok dengan tagihan
   booking. Sengaja **tidak** diproses otomatis; log mencatat `jumlah tidak
   cocok, ditahan manual`.

### Kamera tidak tampil

1. Pastikan server kamera menyala dan alamatnya terjangkau dari internet.
2. Periksa dokumen `settings/cameraServer` di Firestore.
3. Untuk kamera khusus, periksa apakah email penonton tercantum **persis** di
   daftar `viewers` kamera tersebut.
4. `permission-denied` di konsol browser adalah **jalur normal** untuk penonton
   yang tidak berhak — bukan pertanda kerusakan.

### Sensor menampilkan "--" atau berlabel "Offline"

1. Periksa Realtime Database di Firebase Console, cabang
   `monitoring/<stationId>/latest` dan kolom `updatedAt`.
2. Pastikan `stationId` di dokumen destinasi **sama persis** dengan
   `STATION_ID` di firmware.
3. Periksa Serial Monitor ESP32 untuk memastikan WiFi tersambung.

### Scanner QR melempar galat di iOS

`html5-qrcode` melempar galat **sinkron** kalau `stop()` dipanggil saat kamera
tidak sedang berjalan. Karena sinkron, `.stop().catch()` tidak menangkapnya dan
galatnya bocor ke error boundary sebagai "Application error". Penanganannya
sudah ada di `stopScanner()` (`components/dashboard/ScanPanel.tsx`) —
`try/catch` sinkron. Jangan menyederhanakannya kembali menjadi rantai promise.

### Unggah foto destinasi ditolak

Urutkan dugaan dari yang paling sering:

1. **Peran akunnya bukan `admin` atau `pengelola`.** Ini penolakan yang benar.
2. **Berkasnya bukan `image/*` atau di atas 10 MB.** Pesannya muncul di bawah
   tombol unggah, sebelum berkasnya dikirim.
3. **Aturannya baru diterapkan.** Tunggu sampai dua menit, lalu coba lagi.
4. **Peran IAM untuk cross-service Rules belum diberikan.** Ini yang paling
   menyesatkan: `firestore.get()` di dalam `storage.rules` gagal untuk **semua**
   pemanggil, admin sekalipun, dan gejalanya persis sama dengan "belum masuk".
   Cirinya: `node scripts/storage.probe.mjs` menolak baris `admin` maupun
   `pengelola` sekaligus, padahal `request.auth != null` polos lolos.

   Perbaikannya — jalankan dari **terminal interaktif**, bukan lewat skrip:

   ```bash
   firebase deploy --only storage
   ```

   CLI akan bertanya *"Cloud Storage for Firebase needs an IAM Role to use
   cross-service rules. Grant the new role?"* — jawab **Yes**. Kalau
   pertanyaannya tidak muncul, berikan manual lewat Google Cloud Console ›
   IAM: centang **Include Google-provided role grants**, lalu beri peran
   **Firebase Rules Firestore Service Agent**
   (`roles/firebaserules.firestoreServiceAgent`) kepada
   `service-<PROJECT_NUMBER>@gcp-sa-firebaserules.iam.gserviceaccount.com`.

*Service account* Admin SDK tidak bisa dipakai untuk memeriksa hal ini —
`getIamPolicy` membalas 403, dan memang tidak seharusnya punya akses IAM.

### Pemeliharaan berkala

| Berkala | Yang dikerjakan |
|---|---|
| Mingguan | Periksa log galat di Vercel |
| Bulanan | Periksa kuota SMTP, kuota Gemini, dan penggunaan Firebase |
| Setiap perubahan rules | Deploy, tunggu ~2 menit, lalu jalankan `node scripts/rules.probe.mjs` dan `node scripts/storage.probe.mjs` |
| Setiap rilis | `npm run lint`, `npm run build`, dan seluruh `*.check.ts` |
| Berkala | Perbarui dependensi, kecuali `jose` yang disematkan |

---

## Dokumen terkait

| Dokumen | Isi |
|---|---|
| **[panduan-pengguna.md](panduan-pengguna.md)** | Guide Book — cara memakai aplikasi untuk wisatawan, pengelola, dan admin |
| [audit-keamanan-2026-08-14.md](audit-keamanan-2026-08-14.md) | Laporan audit keamanan beserta status perbaikannya |
| [firestore-rules-kamera-mitra.md](firestore-rules-kamera-mitra.md) | Catatan perubahan aturan akses kamera |
| [design.md](../design.md) | Sistem desain: genre, tipografi, spasi, gerak |
| [Proyek_Karang/README.md](../Proyek_Karang/README.md) | Dokumentasi server kamera dan pelatihan model — sub-sistem rekan peneliti |

