# Panduan Semhas — Sistem OTA "Nusa"

Dokumen belajar untuk seminar hasil. Isinya: apa yang dibangun, di mana kodenya,
kenapa dibuat begitu, dan **titik-titik lemah yang harus kamu akui duluan
sebelum penguji yang menemukannya**.

Referensi kode ditulis `path:baris` supaya bisa langsung dibuka.

---

## 1. Ringkasan sistem dalam satu tarikan napas

> "Nusa adalah platform OTA (*Online Travel Agency*) untuk destinasi selam dan
> pesisir. Wisatawan bisa mencari destinasi, memesan tiket, dan mendapat tiket
> QR. Petugas di lapangan men-scan QR itu untuk check-in. Yang membedakannya
> dari OTA biasa: tiap destinasi bisa dipasangi **paket sensor IoT** (ESP32) dan
> **kamera bawah air** yang streamnya dianalisis **YOLOv8** untuk mendeteksi
> jenis dan kesehatan terumbu karang — jadi calon pengunjung bisa melihat kondisi
> perairan secara langsung sebelum memutuskan datang."

Kalimat itu hafalkan. Itu jawaban untuk "coba jelaskan sistem Anda secara singkat".

### Tiga sub-sistem yang saling terhubung

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. WEB APP  (Next.js 14 App Router · TypeScript · Tailwind)         │
│     di-deploy ke Vercel                                              │
│     ├─ Publik   : /beranda, /destinations/[id], /booking             │
│     ├─ Akun     : /profile, /kamera                                  │
│     └─ Operator : /dashboard  (admin & pengelola)                    │
└───────────┬──────────────────────────────────┬───────────────────────┘
            │                                  │
   ┌────────▼──────────┐              ┌────────▼─────────────────┐
   │ 2. FIREBASE       │              │ 3. SERVER KAMERA + AI    │
   │  ├ Auth          │              │  Proyek_Karang/          │
   │  ├ Firestore     │◄── listener ─┤  kamera_deteksi.py       │
   │  │  (transaksi)  │  on_snapshot │  Flask + YOLOv8 + OpenCV │
   │  └ Realtime DB   │              │  /stream /stats /history │
   └────────▲──────────┘              └──────────▲───────────────┘
            │ HTTPS PUT tiap 5 dtk               │ POST frame JPEG
   ┌────────┴──────────┐              ┌──────────┴───────────────┐
   │ ESP32 Weather Stn │              │ HP mitra (mode "push")   │
   │ firmware/*.ino    │              │ atau webcam / IP camera  │
   └───────────────────┘              └──────────────────────────┘
```

**Kenapa dua database Firebase?**
Ini pertanyaan favorit penguji. Jawabannya:

| | Firestore | Realtime Database |
|---|---|---|
| Dipakai untuk | user, destinasi, booking, kamera, ulasan | data sensor IoT |
| Alasan | butuh **query** (`where`), **transaksi** (anti double check-in), dan **security rules per-dokumen** | butuh **write frekuensi tinggi & murah**; ESP32 cukup HTTP `PUT` ke satu REST endpoint tanpa SDK berat |

Kalau ditanya "kenapa sensor tidak di Firestore saja?" → *Firestore menagih
per-dokumen-write. Sensor menulis tiap 5 detik × 24 jam = 17.280 write/hari/
stasiun. RTDB menagih per-bandwidth dan payload-nya cuma ~200 byte. Selain itu
ESP32 tidak punya Firestore SDK yang ringan — RTDB bisa diakses dengan
`HTTPClient` biasa (`firmware/WeatherStation_RTDB.ino:169-183`).*

---

## 2. Tumpukan teknologi (dan alasannya)

| Lapisan | Pilihan | Alasan singkat |
|---|---|---|
| Framework | Next.js 14 **App Router** | Routing berbasis folder, Server Component untuk halaman statis, Route Handler untuk API — satu repo untuk frontend + backend |
| Bahasa | TypeScript `strict: true` | `tsconfig.json:9` — semua bentuk data (Booking, Destination, Camera) punya `interface`, jadi salah ketik field ketahuan saat compile bukan saat demo |
| Styling | Tailwind + token CSS sendiri | `tokens.css` + `tailwind.config.ts` — warna/spasi dari satu sumber, dark mode via class `.dark` |
| Auth & DB | Firebase | Auth (email+password & Google), Firestore, RTDB, semuanya *managed* — tidak perlu urus server DB untuk skripsi |
| AI | YOLOv8n (Ultralytics) + OpenCV | Model nano cukup ringan untuk jalan real-time di CPU laptop |
| Server AI | Flask | Ringan, cukup untuk melayani MJPEG + JSON |
| Chatbot | Google Gemini (Flash-Lite) | Masuk kuota gratis AI Studio, tidak perlu kartu kredit |
| Email | Nodemailer + SMTP sendiri | Email bawaan Firebase sering masuk spam / di-drop |
| Deploy | Vercel (web) + laptop/VPS (server kamera) | |

**Total ± 11.000 baris TypeScript/TSX + ± 1.400 baris Python + ± 300 baris C++ (Arduino).**

---

## 3. Peta file — "di mana letaknya?"

```
OTA/
├── app/                          ← ROUTING (App Router: folder = URL)
│   ├── layout.tsx                Root layout: font, tema, bahasa, ChatWidget, SW
│   ├── page.tsx                  "/" → redirect ke /beranda
│   ├── beranda/page.tsx          Halaman utama (hero + grid destinasi)
│   ├── destinations/[id]/page.tsx  Detail destinasi (dinamis)
│   ├── booking/page.tsx          Form pemesanan + riwayat booking
│   ├── profile/page.tsx          Akun, tiket, pengaturan, pengajuan pengelola
│   ├── kamera/page.tsx           Kelola kamera mitra
│   ├── dashboard/page.tsx        Dashboard admin & pengelola
│   ├── syarat-mitra/page.tsx     Perjanjian Mitra v1.0
│   ├── syarat-pengelola/page.tsx Perjanjian Pengelola v1.0
│   ├── manifest.ts               Manifest PWA
│   └── api/                      ← BACKEND (Route Handler, Node.js runtime)
│       ├── chat/route.ts             Proxy Gemini + konteks katalog
│       ├── send-verification/route.ts Kirim email verifikasi via SMTP
│       ├── notify-approval/route.ts  Email "pengajuan disetujui" (admin only)
│       └── delete-user/route.ts      Hapus Auth + dokumen (admin only)
│
├── lib/                          ← LOGIKA & AKSES DATA (tidak ada JSX di sini)
│   ├── firebase.ts               Inisialisasi SDK klien + cache persisten
│   ├── firebaseAdmin.ts          Admin SDK (server-only)
│   ├── firestore.ts       (614)  ★ SEMUA tipe data + operasi Firestore
│   ├── realtime.ts               Baca sensor dari RTDB
│   ├── useAuth.ts                Hook: user login + role
│   ├── verification.ts           Aturan form pengajuan role + versi perjanjian
│   ├── format.ts                 formatIDR, parseCoords, waLink, formatTimestamp
│   ├── i18n.ts / useLang.tsx     Kamus & konteks dua bahasa (ID/EN)
│   ├── useTheme.ts               Terang/gelap
│   ├── useLocations.ts           Daftar wilayah unik (dulu hardcode 3× tempat)
│   ├── useSaved.ts               Wishlist destinasi
│   └── *.check.ts                Uji mandiri, bisa dijalankan `node` polos
│
├── components/                   ← TAMPILAN
│   ├── desktop/  mobile/         Nav, hero, kartu, grid, footer
│   ├── booking/                  BookingHistory, TicketModal (QR)
│   ├── dashboard/                Sidebar, Statistik, Scan, Destinasi, Pengguna, Kamera
│   ├── cameras/                  CameraManager, VerificationForm, LiveModal
│   ├── destinations/             LiveMonitorPanel (kamera+sensor), Reviews
│   ├── notifications/            NotificationBell, PaymentModal
│   ├── profile/                  AuthForm, ProfileView, AccountSettings, dll.
│   └── chat/ChatWidget.tsx       Widget asisten
│
├── firestore.rules               ★ ATURAN KEAMANAN DATABASE
├── public/sw.js                  Service worker (offline)
│
├── Proyek_Karang/                ← SISTEM AI DETEKSI KARANG (Python)
│   ├── kamera_deteksi.py  (715)  ★ Server multi-kamera + YOLO per-kamera
│   ├── coral_logic.py     (159)  ★ Logika murni: kesehatan HSV + CoralTracker
│   ├── app_web.py         (197)  Server kamera tunggal (versi lama/demo)
│   ├── app_karang.py              GUI desktop standalone
│   ├── tests/                     Unit test (pytest) — logika, bukan kamera
│   ├── tools/train.py             Script training YOLOv8
│   ├── data.yaml                  5 kelas karang
│   └── best.pt                    Bobot hasil training
│
└── firmware/                     ← ESP32 (gitignored, di-flash dari PC lain)
    └── WeatherStation_RTDB/*.ino  Baca sensor → PUT ke RTDB tiap 5 detik
```

**Pola arsitektur yang dipakai:** pemisahan *data layer* (`lib/`) dari
*presentation layer* (`components/`). Tidak ada satu pun komponen yang memanggil
`addDoc`/`updateDoc` Firestore langsung — semuanya lewat fungsi bernama di
`lib/firestore.ts`. Kalau ditanya "apa design pattern-nya?": **Repository
pattern sederhana**, plus **Custom Hooks** untuk state yang dipakai lintas
halaman (`useAuth`, `useLocations`, `useSaved`, `useTheme`, `useLang`).

---

## 4. Model data

### Firestore (7 koleksi)

| Koleksi | ID dokumen | Isi penting | Definisi tipe |
|---|---|---|---|
| `users` | `uid` (dari Auth) | `name, email, role, phone, saved[], verification{}` | `lib/firestore.ts:172-184` |
| `destinations` | auto-id | `name, location, tags[], priceItems[], images[], lat/lng, whatsapp, hasMonitoring, stationId, managerUid, cameraStreamId` | `lib/firestore.ts:30-74` |
| `bookings` | auto-id (20 char) | `userId, destinationId, date, guests, items[], amount, status, paymentStatus` | `lib/firestore.ts:439-458` |
| `cameras` | auto-id | `cameraId(6 char), name, location, ownerUid, source, status` | `lib/firestore.ts:304-318` |
| `reviews` | **`{destinationId}_{userId}`** | `rating(1-5), comment, userName` | `lib/firestore.ts:527-537` |
| `settings` | `cameraServer` | `baseUrl` server kamera | `lib/firestore.ts:395-408` |
| `monitoring_data` | — | legacy, tidak dipakai lagi | |

> **Titik cerdas yang layak dipamerkan:** ID dokumen ulasan sengaja
> **deterministik** — `${destinationId}_${userId}` (`lib/firestore.ts:557`).
> Efeknya: satu user secara **struktural** tidak mungkin punya dua ulasan untuk
> destinasi yang sama. Ini bukan validasi yang bisa di-bypass, tapi konsekuensi
> dari desain kunci. Aturan keamanannya menegakkan hal yang sama di sisi server
> (`firestore.rules:85`).

### Realtime Database

```
monitoring/
  └── <stationId>/          ← id paket sensor, mis. "bahoi"
        └── latest          ← ESP32 PUT ke sini tiap 5 detik
              { tempDHT, humidity, tempDS18, rainStatus, rainValue,
                windSpeed, flowRate, updatedAt,
                latitude, longitude, altitude, speed, satellites, gpsValid }
```

Pemetaan destinasi → cabang RTDB ada di `lib/realtime.ts:34-41` (`stationPath`).
Ada penanganan kompatibilitas mundur: stasiun pertama yang firmware-nya belum
diberi ID tetap dibaca dari `monitoring/latest`.

### Peran pengguna (4 tingkat)

| Role | Bisa apa | Naik lewat |
|---|---|---|
| `user` | Cari, booking, ulas, simpan wishlist | otomatis saat daftar |
| `mitra` | + daftarkan & pantau kamera sendiri | ajukan verifikasi di `/kamera` → disetujui admin |
| `pengelola` | + dashboard: statistik, scan tiket, kamera di wilayahnya | ajukan di `/profile` → disetujui admin |
| `admin` | + kelola destinasi, kelola semua pengguna, ubah role | diset manual di database |

Sumbernya `users/{uid}.role`, dibaca real-time oleh `useUserRole()`
(`lib/useAuth.ts:30-57`) — jadi kalau admin menurunkan role seseorang, UI orang
itu langsung berubah tanpa perlu logout.

---

## 5. Alur end-to-end (INI yang paling sering ditanya)

### Alur A — Dari pesan tiket sampai check-in dan bayar

Ini rantai terpanjang di sistem. Hafalkan urutannya.

```
1. /destinations/[id]              user centang item harga (tiket, sewa alat, …)
   app/destinations/[id]/page.tsx:144-159
   └── goToBooking() → cek login + emailVerified → router.push('/booking?dest=X&items=a,b')

2. /booking                        form: tanggal, jumlah, nama, telepon
   app/booking/page.tsx:79-92      ?items= dipakai untuk pra-centang
   app/booking/page.tsx:43         batas tanggal minimal = hari ini
   └── createBooking()  lib/firestore.ts:465-475
       → dokumen bookings baru: status 'confirmed', paymentStatus 'unpaid'

3. /profile atau /booking          tiket muncul, tombol "Lihat Tiket"
   components/booking/TicketModal.tsx:13-15
   └── QR berisi: "OTA-TICKET|{bookingId}|{namaDestinasi}|{tanggal}"
       dirender qrcode.react, dibungkus latar putih agar tetap ter-scan di dark mode

4. Dashboard → Scan               petugas arahkan kamera ke QR
   components/dashboard/ScanPanel.tsx:135-144   html5-qrcode di-import dinamis
   components/dashboard/ScanPanel.tsx:45-50     parseTicketId() ← ★ lihat catatan
   └── getDoc(bookings/{id}) → tampilkan hasil: valid / used / cancelled / notfound

5. Konfirmasi check-in
   components/dashboard/ScanPanel.tsx:156-185
   └── checkInBooking()  lib/firestore.ts:501-513   ← ★ TRANSAKSI

6. Notifikasi pembayaran           lonceng di navbar user menyala
   components/notifications/NotificationBell.tsx:34-47
   └── filter: status === 'used' && paymentStatus === 'unpaid'

7. Bayar
   components/notifications/PaymentModal.tsx:38-50
   └── payBooking()  lib/firestore.ts:516-523 → paymentStatus 'paid'
```

#### ★ Dua bagian yang WAJIB kamu bisa jelaskan

**(a) Transaksi check-in — `lib/firestore.ts:501-513`**

```ts
export async function checkInBooking(id: string): Promise<CheckInOutcome> {
  const ref = doc(db, "bookings", id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return "notfound";
    const status = snap.data()?.status;
    if (status === "used")      return "already-used";
    if (status === "cancelled") return "cancelled";
    tx.update(ref, { status: "used", checkedInAt: serverTimestamp() });
    return "success";
  });
}
```

**Kenapa harus transaksi, tidak cukup `if` biasa?**
> Bayangkan dua petugas men-scan tiket yang sama pada detik yang sama. Kalau
> saya cuma `getDoc` → cek status → `updateDoc`, ada jeda antara baca dan tulis.
> Dua-duanya membaca `status: 'confirmed'`, dua-duanya lolos pengecekan,
> dua-duanya menulis `'used'` — satu tiket masuk dua orang. Itu ***race
> condition***. `runTransaction` membaca ulang dokumen **di dalam** transaksi;
> kalau dokumen berubah sebelum commit, Firestore membatalkan dan mengulang
> transaksinya. Jadi hanya satu yang bisa berhasil.

Perhatikan juga fungsi ini mengembalikan **alasan** kegagalan
(`already-used`/`cancelled`/`notfound`), bukan cuma `true/false` — supaya
petugas tahu apa yang terjadi, bukan sekadar "gagal".

**(b) Validasi payload QR — `components/dashboard/ScanPanel.tsx:45-50`**

```ts
function parseTicketId(text: string): string | null {
  const parts = text.split('|');
  if (parts[0] !== 'OTA-TICKET' || !parts[1]) return null;
  if (!/^[A-Za-z0-9]{20}$/.test(parts[1])) return null;   // ← ini kuncinya
  return parts[1];
}
```

**Kenapa ada regex?**
> Ini pencegahan ***path injection***. ID dari QR langsung masuk ke
> `doc(db, 'bookings', id)`. Kalau seseorang membuat QR berisi
> `OTA-TICKET|../users/abc123`, tanpa validasi itu bisa jadi jalan untuk membaca
> koleksi lain. Auto-ID Firestore selalu 20 karakter alfanumerik, jadi saya
> kunci persis ke pola itu. Selain memblokir injeksi, ini juga menolak QR asal
> lebih cepat tanpa perlu memanggil database.

**(c) Bonus — bug iOS yang sempat dibetulkan: `ScanPanel.tsx:20-30`**

Ini contoh bagus untuk pertanyaan "kesulitan apa yang Anda temui?".

> Library `html5-qrcode` melempar error **sinkron** kalau `stop()` dipanggil
> saat kamera tidak sedang jalan. Karena sinkron, `.stop().catch()` tidak
> menangkapnya — errornya bocor keluar dari fungsi *cleanup* `useEffect` React,
> naik ke error boundary, dan di iOS muncul sebagai "Application error:
> a client-side exception". Perbaikannya membungkus dengan `try/catch` sinkron,
> bukan `.catch()` promise.

---

### Alur B — Autentikasi, verifikasi email, dan naik role

```
1. Daftar / masuk
   components/profile/AuthForm.tsx
   ├─ Email+password  → createUserWithEmailAndPassword
   ├─ Google          → signInWithPopup
   └─ Setelah berhasil: setDoc(users/{uid}, { role: 'user', ... })
      ★ role dipaksa 'user' — dan aturan Firestore juga memaksanya
        (firestore.rules:14-16)

2. Verifikasi email
   lib/sendVerification.ts:4-11 → POST /api/send-verification
   app/api/send-verification/route.ts:29-31
   └── adminAuth().generateEmailVerificationLink(email)
       lalu dikirim lewat SMTP sendiri (Nodemailer), bukan email bawaan Firebase

   ★ Kenapa tidak pakai email bawaan Firebase?
     Karena sering masuk folder spam atau di-drop provider. Dengan SMTP sendiri
     domain pengirimnya bisa diatur & deliverability-nya terkontrol.

   ★ Kenapa endpoint ini tidak bisa dipakai spam orang?
     generateEmailVerificationLink melempar auth/user-not-found kalau email
     belum terdaftar — jadi hanya bisa mengirim ke akun yang benar-benar ada.
     Dan errornya sengaja dibalas 'ok' (route.ts:35) supaya penyerang tidak bisa
     memakai endpoint ini untuk menebak email mana yang terdaftar
     (mencegah user enumeration).

3. Ajukan naik role
   components/cameras/VerificationForm.tsx        (form dipakai dua-duanya)
   ├─ mitra     → dari /kamera  (CameraSection)
   └─ pengelola → dari /profile (PengelolaRequest) + kolom alamat kirim sensor

   Validasi: lib/verification.ts:67-92  validateRoleRequest()
   Simpan  : lib/firestore.ts:250-276   submitRoleRequest()
             → users/{uid}.verification = { …, status: 'pending', submittedAt }

4. Persetujuan perjanjian  ← FITUR TERBARU (branch feat/perjanjian-pengelola)
   lib/verification.ts:13-24
   const AGREEMENT = {
     mitra:     { version: "1.0", path: "/syarat-mitra",     label: "Perjanjian Mitra" },
     pengelola: { version: "1.0", path: "/syarat-pengelola", label: "Perjanjian Pengelola" },
   }
   → checkbox wajib dicentang; versi yang disetujui ikut disimpan
     (agreementVersion) beserta agreedAt yang di-stempel serverTimestamp()
     di lib/firestore.ts:273 — BUKAN waktu dari HP pengguna.

   ★ Kenapa versinya disimpan? Supaya kalau isi perjanjian berubah, kita tahu
     persis versi mana yang disetujui orang ini. Dan checkbox selalu mulai
     kosong saat ajukan ulang (VerificationForm.tsx:44) karena isi perjanjian
     bisa sudah berubah sejak pengajuan sebelumnya.

5. Admin menyetujui  → Dashboard → Pengguna
   components/dashboard/PenggunaPanel.tsx:66-75
   ├── approveRoleRequest()  lib/firestore.ts:279-289 → role naik
   └── notifyApproval()      → POST /api/notify-approval → email pemberitahuan
       ★ email gagal kirim TIDAK membatalkan persetujuan — persetujuan sudah
         tersimpan, email cuma pemberitahuan (komentar PenggunaPanel.tsx:71-73)
```

---

### Alur C — Kamera mitra + deteksi karang + sensor IoT

Ini bagian yang paling "teknik" dan paling menarik bagi penguji.

```
1. Mitra daftarkan kamera dari web
   components/cameras/CameraManager.tsx:68-96 → addCamera()
   lib/firestore.ts:355-366
   ├── genCameraId()  lib/firestore.ts:334-338
   │   → ID 6 karakter dari alfabet 31 huruf (tanpa 0/o, 1/l/i yang membingungkan)
   │   → crypto.getRandomValues(), bukan Math.random()
   └── status dipaksa 'pending'

2. Server Python mendeteksi kamera baru — TANPA polling
   Proyek_Karang/kamera_deteksi.py:673-685  init_firestore()
   ├── _apply_snapshot(col.get())    ← sinkron di awal, supaya siap melayani
   └── col.on_snapshot(_on_snapshot) ← listener real-time
   Proyek_Karang/kamera_deteksi.py:139-177  _apply_snapshot()
   → registry kamera dibangun ulang; kamera yang dicabut → worker-nya dihentikan
     supaya perangkat kameranya dilepas

3. Admin menyetujui di halaman server (dilindungi Basic Auth)
   → status jadi 'approved' lewat Admin SDK
   ★ Aturan Firestore melarang SEMUA update dari klien (firestore.rules:75
     `allow update: if false`). Jadi user TIDAK BISA menyetujui kameranya sendiri.
     Approve hanya mungkin dari server yang memegang service account.

4. QR siaran muncul di web → mitra scan pakai HP
   components/cameras/CameraManager.tsx:215-236
   → membuka /broadcast/<id> di server kamera
   Proyek_Karang/kamera_deteksi.py:665-671
   → halaman itu ambil kamera HP (getUserMedia), kirim frame JPEG
     8 fps ke POST /ingest/<id> (kamera_deteksi.py:603-616)

5. Penonton buka stream → BARULAH model YOLO dimuat
   Proyek_Karang/kamera_deteksi.py:225-345  class CameraWorker
```

#### ★ `CameraWorker` — bagian paling "engineering" di proyek ini

Ini yang harus kamu kuasai kalau penguji dosen informatika.

```python
class CameraWorker(threading.Thread):
    IDLE_STOP_SECONDS = 30
```

Tiga masalah yang dipecahkan sekaligus:

**(1) Satu thread pembaca per kamera, bukan per penonton.**
Kalau tiap request `/stream` membaca kamera sendiri, OpenCV bentrok
(*race condition*) dan CPU meledak. Di sini satu `CameraWorker` membaca +
menginferensi sekali, semua penonton berbagi `self.frame` yang sama lewat
`threading.Condition` (`kamera_deteksi.py:364-386`). Penonton kedua = **nol**
biaya inferensi tambahan.

**(2) Model dimuat *lazy*, dilepas saat idle.**
`YOLO(MODEL_PATH)` dipanggil di dalam `run()` (baris 290), bukan di
`__init__`. Worker baru dibuat saat penonton pertama datang (`get_worker()`,
baris 345), dan berhenti sendiri 30 detik setelah penonton terakhir pergi.
Efeknya: 10 kamera terdaftar tapi tidak ditonton = 0 model di memori.

**(3) `peek_worker()` — baris 356.**
Endpoint `/stats` dan `/history` di-*poll* browser tiap 5 detik. Kalau mereka
memakai `get_worker()`, polling itu akan **menyalakan** kamera + model terus
menerus. Jadi dibuat fungsi terpisah yang hanya mengambil worker yang **sudah**
ada, tidak pernah membuat baru.

**(4) Satu instance model per kamera** (`annotate()`, baris 77-82):
> Ultralytics menyimpan state ByteTrack **di dalam** instance model. Kalau dua
> kamera berbagi satu model, ID track-nya bertabrakan — karang di kamera A dan
> kamera B bisa dianggap objek yang sama. Jadi tiap kamera wajib punya instance
> model dan `CoralTracker` sendiri.

#### Sensor IoT

```
firmware/WeatherStation_RTDB/*.ino
├── DHT22   → suhu & kelembapan udara
├── DS18B20 → suhu air
├── Rain sensor (analog 0-4095) → dikategorikan: Cerah/Berawan/Gerimis/Hujan…
├── Anemometer (interrupt hitung pulsa) → km/h
├── Water flow (interrupt hitung pulsa) → L/min
└── GPS NEO-6M → lat/lng/altitude/satelit

loop() → baca sensor → tiap 5 detik: sendToFirebase()  (.ino:148-183)
      → HTTPS PUT ke https://ota-db-default-rtdb.firebaseio.com/monitoring/<id>/latest.json
      → updatedAt diisi {".sv":"timestamp"}  ← ★ timestamp dari SERVER Firebase,
        bukan dari jam ESP32 yang tidak punya RTC dan akan ngawur

Web membacanya: lib/realtime.ts:43-49  subscribeMonitoring()
Ditampilkan  : components/destinations/LiveMonitorPanel.tsx
```

> 🚨 **PENTING — file firmware di repo ini SUDAH USANG.**
> `firmware/` di-gitignore (`.gitignore:44`), jadi salinan lokal ini tidak
> pernah ikut ter-commit dan **tertinggal dari versi yang benar-benar di-flash
> ke ESP32**. Bedanya nyata:
>
> | | Salinan di repo ini | Yang dibaca website |
> |---|---|---|
> | Field GPS | **tidak ada sama sekali** | `lib/realtime.ts:13-20` mengharapkan `latitude`, `longitude`, `altitude`, `speed`, `satellites`, `gpsValid` |
> | Sensor EC | masih ada (`ecValue`, kartu "Nutrisi (EC)") | sudah dihapus dari sistem |
>
> Salinan ini bahkan kemungkinan **tidak bisa dikompilasi** — `EC_PIN` dan
> `voltage` dipakai tanpa deklarasi yang terlihat.
>
> **Yang harus kamu lakukan sebelum sidang:**
> 1. Ambil `.ino` versi terbaru dari PC tempat kamu mem-flash ESP32.
> 2. Timpa `firmware/WeatherStation_RTDB/WeatherStation_RTDB.ino` di sini.
> 3. Kalau penguji minta lihat kode firmware, tunjukkan versi itu — bukan yang
>    sekarang ada di repo.
>
> Kalau terlanjur ditanya dan file yang ada versi lama, jawab jujur: *"Firmware
> sengaja tidak di-track git karena berisi kredensial WiFi; salinan di repo ini
> versi lama sebelum penambahan GPS dan penghapusan sensor EC. Versi yang
> berjalan ada di PC flashing."* Alasan WiFi-nya benar — baris 12-13 memang
> berisi SSID dan password polos, jadi memang tidak boleh masuk repo.

**Dua detail yang bagus untuk ditunjukkan di `LiveMonitorPanel.tsx`:**

- Baris 103-104: status "Live" dihitung dari **umur data** (`now - updatedAt < 15
  detik`), bukan dari "apakah koneksi terbuka". Kalau ESP32 mati tapi data lama
  masih ada, panelnya jujur menulis **Offline**.
- Baris 77: kamera baru dianggap "Live" setelah **frame pertama benar-benar
  masuk** (`onLoad`), bukan sekadar koneksi terbuka. Koneksi terbuka tanpa frame
  ≠ live.
- Baris 108-112: GPS. `gpsValid` false atau koordinat 0,0 → tampilkan "Mencari
  sinyal satelit…", bukan menampilkan titik di tengah Samudra Atlantik (0,0 =
  Null Island).

---

## 6. Keamanan

### 6.1 Aturan Firestore (`firestore.rules`)

Ini **satu-satunya** hal yang mencegah orang mengubah data lewat SDK Firebase
langsung dari console browser. Penguji yang paham akan menekan di sini.

| Koleksi | Aturan | Baris |
|---|---|---|
| `users` read | pemilik sendiri **atau** admin | 7-11 |
| `users` create | hanya dokumen sendiri **dan** `role == 'user'` | 14-16 |
| `users` update | admin bebas; pemilik boleh **asal role tidak berubah** | 20-27 |
| `destinations` | baca publik; tulis hanya admin/pengelola | 30-34 |
| `cameras` create | wajib `ownerUid == uid` **dan** `status == 'pending'` | 68-71 |
| `cameras` update | **`if false`** — approve hanya dari server (Admin SDK) | 75 |
| `reviews` | id dokumen wajib `<destId>_<uid>`, rating wajib int 1..5 | 83-88 |
| `settings/cameraServer` | baca publik (stream memang publik), tulis mitra ke atas | 100-103 |

**Prinsip yang bisa kamu sebut:** *privilege escalation prevention*. Tiga
lapisannya:
1. User tidak bisa menaikkan role-nya sendiri (baris 25).
2. User tidak bisa menyetujui kameranya sendiri (baris 75).
3. Operasi yang butuh hak istimewa (hapus akun, kirim email persetujuan) lewat
   API route yang **memverifikasi ID token dan mengecek role di server**.

### 6.2 API route — pengecekan yang benar

Contoh `app/api/delete-user/route.ts:17-37`:

```ts
const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
if (!token) return 401;
const callerUid = (await adminAuth().verifyIdToken(token)).uid;   // ← verifikasi kriptografis
const caller = await adminDb().doc(`users/${callerUid}`).get();
if (caller.data()?.role !== 'admin') return 403;                  // ← cek role DI SERVER
if (uid === callerUid) return 400;                                // ← admin tidak bisa hapus diri sendiri
```

**Kenapa role dicek di server, bukan cukup di UI?**
> Karena UI hanya menyembunyikan tombol. Siapa pun bisa memanggil
> `DELETE /api/delete-user?uid=...` langsung dengan `curl`. `verifyIdToken()`
> memverifikasi tanda tangan JWT dari Firebase — token palsu ditolak. Lalu
> role-nya dibaca dari Firestore pakai Admin SDK, bukan dari isi token, supaya
> role yang baru diturunkan admin langsung berlaku.

**Kenapa hapus akun harus lewat server sama sekali?**
> Menghapus user dari Firebase Auth butuh Admin SDK — klien tidak punya haknya.
> Kalau dihapus dari Firebase Console, yang kena cuma Auth-nya; dokumen
> `users/{uid}` tertinggal dan menumpuk jadi "user yatim" di daftar pengguna.
> Route ini menghapus keduanya sekaligus, dan sengaja mengabaikan error
> `auth/user-not-found` (baris 43) supaya sekalian membersihkan sisa akun yang
> terlanjur dihapus dari Console.

### 6.3 Rahasia (secrets)

- Service account Firebase: `FIREBASE_ADMIN_SA_B64` (base64 di env var),
  di-decode di `lib/firebaseAdmin.ts:16`.
- **Terverifikasi: file service account tidak pernah masuk git history.**
  (`git log --all --full-history -- '*firebase-adminsdk*'` → kosong)
- `GEMINI_API_KEY` sengaja **tanpa** prefix `NEXT_PUBLIC_` — kalau diberi
  prefix itu, Next.js akan mem-bundle-nya ke JavaScript browser dan kuncinya
  bocor ke semua pengunjung. Karena itu ada proxy `/api/chat`, bukan panggil
  Gemini langsung dari browser.
- Variabel `NEXT_PUBLIC_FIREBASE_API_KEY` **memang publik dan itu tidak
  apa-apa** — kunci API Firebase bukan rahasia, dia hanya pengenal proyek.
  Yang mengamankan data adalah *security rules*, bukan kunci itu. (Siapkan
  jawaban ini; sering ditanya.)

---

## 7. Sisi AI — deteksi & kesehatan karang

### 7.1 Angka training (HAFALKAN)

Sumber: `Proyek_Karang/runs/detect/train-2/results.csv` & `args.yaml`

| Parameter | Nilai |
|---|---|
| Model dasar | **YOLOv8n** (nano), `pretrained: true` (transfer learning dari COCO) |
| Epoch | **50** |
| Batch size | 16 |
| Ukuran citra | 640 × 640 |
| Optimizer | auto (AdamW), `lr0 = 0.01` |
| Device | **CPU** |
| Waktu training | ± 6.070 detik ≈ **1 jam 41 menit** |
| Dataset | **400 gambar latih / 100 gambar validasi** |
| Jumlah kelas | **5** |

Kelas (`data.yaml`): `Acropora_formosa`, `Acropora_sp`, `Acropora_yongei`,
`Echinophora_sp`, `Seriatopora_hystrix`.

| Metrik (epoch 50) | Nilai |
|---|---|
| Precision | **0,765** |
| Recall | **0,984** |
| mAP@50 | **0,835** |
| mAP@50 terbaik (epoch 45) | **0,862** |

> ✅ **Sudah diverifikasi:** `best.pt` di root folder **identik byte-per-byte**
> dengan `runs/detect/train-2/weights/best.pt` (md5 `da62b196…`, ukuran & waktu
> sama). Jadi angka di atas benar-benar menggambarkan model yang dimuat sistem —
> bukan bobot dari run lain. (Ada folder `runs/detect/train/` dari percobaan
> pertama, tapi folder `weights`-nya kosong: run itu tidak selesai.)
>
> ⚠ Satu hedge yang jujur: `data.yaml` menunjuk path Windows
> (`C:/Proyek_Karang/train/images`) — training dijalankan di mesin lain. Angka
> 400/100 di atas dihitung dari folder `train/` & `val/` yang ada di laptop ini,
> jadi sebut sebagai *"sekitar 400 latih / 100 validasi"* kecuali kamu sempat
> mengeceknya di mesin tempat training berjalan.

**Kenapa YOLOv8n, bukan s/m/l?**
> Karena sistem ini harus menginferensi **beberapa kamera sekaligus secara
> real-time di CPU laptop**, bukan di GPU server. Nano adalah varian tercepat
> dengan trade-off akurasi yang masih dapat diterima untuk 5 kelas dan objek
> yang relatif besar di frame. Kalau nanti dipindah ke GPU, tinggal ganti bobot
> — `resolve_model_path()` (`kamera_deteksi.py:64-72`) sudah mencari bobot
> secara berjenjang.

### 7.2 Klasifikasi kesehatan — `coral_logic.py:24-50`

```python
S_BLEACH  = 40    # saturasi di bawah ini + terang → pemutihan
V_BRIGHT  = 160
S_HEALTHY = 90    # saturasi >= ini → sehat

def predict_health(roi, ...):
    core = roi[crop 25% tiap sisi]         # ambil 50% tengah box
    hsv  = cv2.cvtColor(core, COLOR_BGR2HSV)
    s, v = hsv[:,:,1].mean(), hsv[:,:,2].mean()
    if s < S_BLEACH and v > V_BRIGHT: return "Mengalami Pemutihan"
    if s < S_HEALTHY:                 return "Kurang Sehat"
    return "Sehat"
```

**Alasan ilmiahnya:** pemutihan karang (*coral bleaching*) terjadi ketika karang
melepaskan alga zooxanthellae yang memberinya warna. Karang yang memutih jadi
**pucat/putih** — dalam ruang warna HSV itu berarti **saturasi rendah** dengan
**value tinggi**. Jadi ambang saturasi dipakai sebagai proxy warna.

**Kenapa crop 25% tiap sisi?** Karena bounding box YOLO selalu ikut memuat
latar (pasir, air) di pinggirnya. Mengambil 50% bagian tengah membuat rata-rata
warna lebih mewakili karangnya sendiri, bukan latarnya.

**Kenapa HSV, bukan RGB?** Di RGB, "seberapa berwarna" dan "seberapa terang"
tercampur di tiga kanal. HSV memisahkannya: `S` = kepekatan warna, `V` =
kecerahan. Jadi bisa membedakan "putih pucat" (S rendah, V tinggi) dari
"gelap karena kurang cahaya" (S tinggi, V rendah) — persis yang dibutuhkan.

> ⚠ **Akui duluan:** kode ini sendiri menyebutnya *"proxy berbasis aturan
> (bukan ukuran biologis tervalidasi)"* (`coral_logic.py:29`). Lihat §9.

### 7.3 `CoralTracker` — `coral_logic.py:53-135`

Masalah: kalau tiap frame menghitung deteksi, satu karang yang tampak selama
5 detik pada 20 fps akan terhitung **100 kali**.

Solusi — dua mekanisme:

**(a) Commit-on-confirmation.** Sebuah *track* (ID dari ByteTrack) baru
dihitung ke total kumulatif setelah terlihat `confirm_frames = 5` kali, dan
`_seen_ids` (set permanen) memastikan ID yang sama tidak pernah dihitung dua
kali. Jadi total = jumlah **karang unik**, bukan jumlah deteksi.

**(b) Majority vote.** Label kesehatan per track dihaluskan dengan `Counter`
(baris 109). Satu frame yang kebetulan gelap/silau tidak langsung membuat karang
sehat dilabeli "memutih" — yang menang adalah suara terbanyak sepanjang track
itu terlihat.

Plus: `threading.Lock` (baris 65) karena diakses dari thread worker sekaligus
thread Flask; dan pembersihan track basi via `track_ttl = 30 detik` (baris 130).

**Kenapa `coral_logic.py` dipisah dari `kamera_deteksi.py`?**
> Supaya bisa di-unit-test. File itu sengaja tidak mengimpor Flask atau membuka
> kamera — jadi `tests/test_coral_logic.py` bisa memberi input buatan dan
> memverifikasi logika penghitungan & klasifikasi tanpa perlu kamera fisik atau
> server yang berjalan.

---

## 8. Fitur pendukung

### 8.1 Chatbot asisten — `app/api/chat/route.ts`

Bukan chatbot generik. Tiga hal yang membuatnya "punya konteks":

1. **Katalog destinasi disuntikkan ke system instruction** (baris 23-55). Model
   hanya boleh menyebut harga dari katalog itu; instruksinya eksplisit:
   *"Harga HANYA boleh diambil dari katalog di bawah. Jangan pernah mengarang"*
   (baris 64). Ini mitigasi **halusinasi harga** — kesalahan paling mahal untuk
   platform pemesanan.
2. **Katalog dibaca lewat Admin SDK dan di-cache 5 menit** (baris 20-21).
   Tanpa cache, tiap pesan chat = satu pembacaan koleksi penuh. Pakai Admin SDK
   supaya aturan Firestore tidak perlu dilonggarkan.
3. **Rate limit 8 pesan/IP/menit** (baris 81-93), plus batas 500 karakter/pesan
   dan 12 giliran riwayat — supaya kuota gratis Gemini tidak habis dipakai iseng.

Dikirim dengan `store: false` (baris 160) → Google tidak menyimpan percakapan.

### 8.2 PWA & mode luring (offline)

Ini fitur yang paling berkaitan dengan konteks nyata: **di dermaga sering tidak
ada sinyal, tapi tiket QR harus tetap bisa ditunjukkan.**

Dua bagian yang berpasangan:

- `lib/firebase.ts:37-60` — Firestore dengan `persistentLocalCache` +
  `persistentMultipleTabManager` → **datanya** (tiket, booking, destinasi yang
  pernah dibuka) tersimpan di IndexedDB.
- `public/sw.js` — service worker → **cangkang halamannya** tersimpan di Cache
  API. Strateginya: *network-first* untuk navigasi (selalu dapat versi terbaru,
  jatuh ke cache saat offline), *cache-first* untuk aset build ber-hash.

Batas yang **disengaja dan harus kamu sebut**: halaman yang belum pernah dibuka
saat online tidak akan terbuka offline (`sw.js:6-8`). Tidak ada precache
manifest — yang pernah dibuka, itu yang tersimpan.

Service worker sengaja **hanya didaftarkan di produksi** (`app/layout.tsx:57`),
karena di mode dev cangkang yang ter-cache menutupi hasil edit dan bikin HMR
terlihat rusak.

### 8.3 Dua bahasa (ID/EN) — `lib/i18n.ts`

Kamus sederhana `key → { id, en }`, tanpa library. Cakupannya **sengaja
dibatasi** ke halaman yang disentuh wisatawan; dashboard pengelola tetap bahasa
Indonesia karena penggunanya mitra lokal (alasan ditulis di `i18n.ts:5-8`).
Itu keputusan sadar, bukan pekerjaan setengah jadi — sampaikan begitu.

### 8.4 Detail kecil yang menunjukkan ketelitian

Kalau ada waktu, salah satu ini enak dipamerkan:

- **`app/booking/page.tsx:43`** — `toLocaleDateString('en-CA')` untuk batas
  tanggal minimal, **bukan** `toISOString()`. Alasannya: `toISOString()`
  memberi tanggal UTC; di WITA (UTC+8) sebelum jam 08:00 pagi, batas minimalnya
  mundur ke kemarin dan booking yang baru dibuat langsung terhitung
  kedaluwarsa. `en-CA` kebetulan menghasilkan format `YYYY-MM-DD` di zona waktu
  **lokal**.
- **`components/booking/TicketModal.tsx:109`** — QR selalu hitam-di-putih
  dengan padding (*quiet zone*), tidak ikut dark mode, supaya tetap ter-scan.
- **`TicketModal` / `PaymentModal` pakai `createPortal` ke `<body>`** — karena
  induknya punya animasi CSS yang menyisakan `transform: scale(1)`, dan
  `position: fixed` di dalam elemen ber-`transform` jadi relatif ke elemen itu,
  bukan ke viewport. Akibatnya modal melenceng dan ketutup navbar.
- **`lib/format.ts:26-38` `waLink()`** — menormalkan nomor Indonesia yang
  ditulis bebas (`0812…`, `+62 812…`, `62812…`) jadi format `wa.me`, dan
  mengembalikan `null` kalau terlalu pendek supaya tombolnya disembunyikan
  daripada membuka chat yang gagal.
- **`lib/useLocations.ts`** — dulu daftar wilayah `['Bunaken','Likupang','Lembeh']`
  di-hardcode di **tiga** komponen dan sempat tidak sinkron antara desktop dan
  mobile. Sekarang diturunkan dari koleksi destinasi.

---

## 9. ⚠ Keterbatasan sistem — AKUI DULUAN

**Strategi paling kuat di semhas: sebutkan kelemahanmu sendiri sebelum penguji
menemukannya.** Yang menjatuhkan bukan adanya kelemahan, tapi ketahuan tidak
menyadarinya.

Susun jadi slide "Keterbatasan Sistem & Saran Pengembangan".

### A. Pembayaran masih simulasi

`payBooking()` (`lib/firestore.ts:516-523`) hanya menulis
`paymentStatus: 'paid'` dari sisi klien. **Tidak ada payment gateway.**

> "Modul pembayaran masih berupa simulasi alur — belum terhubung ke payment
> gateway. Untuk implementasi nyata perlu integrasi Midtrans atau Xendit,
> dengan konfirmasi lewat **webhook dari sisi server**, bukan dari klien."

Katakan ini duluan. Kalau penguji yang menemukan `payBooking` dan kamu belum
menyebutnya, posisinya jauh lebih buruk.

### B. Aturan koleksi `bookings` terlalu longgar

`firestore.rules:40-48`:

```
allow create: if request.auth != null;   // tidak cek userId == uid
allow read:   if request.auth != null;   // SETIAP user login bisa baca SEMUA booking
```

Konsekuensinya jujur:
- Semua pengguna yang login secara teknis bisa membaca seluruh booking —
  termasuk nama dan nomor telepon pemesan lain.
- `amount`, `status`, `paymentStatus` tidak divalidasi saat create.

Rencana perbaikan yang bisa kamu sebutkan:
```
allow create: if request.auth != null
              && request.resource.data.userId == request.auth.uid
              && request.resource.data.status == 'confirmed'
              && request.resource.data.paymentStatus == 'unpaid';
allow read:   if resource.data.userId == request.auth.uid
              || userRole() in ['admin','pengelola'];
```

### C. Pengelola belum dibatasi ke wilayahnya di level aturan

`firestore.rules:30-34` — tulis ke `destinations` diizinkan untuk **semua**
pengelola, tanpa cek `managerUid`. Pembatasan wilayah sudah ada di UI
(`KameraPanel.tsx:34`) dan sudah tegas di aturan `cameras` (baris 62-63), tapi
belum di `destinations`. **Ini inkonsistensi yang nyata** — sebutkan sebagai
pekerjaan lanjutan.

### D. Stream kamera tidak diautentikasi (disengaja)

README-nya sendiri menulis: *"stream tetap terbuka karena ID-nya acak"*.
Keamanannya bertumpu pada ID 6 karakter dari alfabet 31 → **31⁶ ≈ 887 juta**
kombinasi.

Sebut apa adanya: **ini *security through obscurity***, bukan autentikasi.
Alasan teknisnya sah: tag `<img>` MJPEG tidak bisa mengirim header Authorization,
jadi endpoint stream tidak bisa memakai Basic Auth. Halaman *kelola* (daftar ID,
tambah/hapus) tetap dilindungi Basic Auth (`kamera_deteksi.py:110-136`).
Perbaikan ke depan: signed URL berbatas waktu, atau proxy stream lewat backend
yang memeriksa sesi.

### E. Aturan Realtime Database masih mode tes

**Yang pasti terbaca dari kode:** `client.setInsecure()`
(`WeatherStation_RTDB.ino:170`) melewati validasi sertifikat TLS. Koneksinya
tetap terenkripsi, tapi ESP32 tidak memverifikasi bahwa lawan bicaranya benar
server Firebase — secara teori bisa kena *man-in-the-middle* di jaringan yang
tidak tepercaya. Alasannya praktis: menanam sertifikat root di ESP32 menambah
pemakaian memori dan sertifikatnya kedaluwarsa berkala. Cukup untuk demo, tidak
untuk produksi.

**Yang HARUS kamu cek dulu sebelum menyebutnya:** komentar di
`WeatherStation_RTDB.ino:18` menulis *"Rules mode tes (read/write terbuka)"*.
Kalau itu masih benar, siapa pun yang tahu URL RTDB bisa menulis data sensor
palsu. **Tapi aturan RTDB tidak tersimpan di repo ini** — `firebase.json` hanya
mendeklarasikan rules Firestore, jadi rules RTDB dikelola langsung di Firebase
Console dan tidak bisa diverifikasi dari kode.

→ **Buka Firebase Console → Realtime Database → Rules sebelum sidang.** Jangan
mengaku ada lubang keamanan yang mungkin sudah kamu tutup. Kalau ternyata masih
terbuka, sebutkan sebagai keterbatasan dengan rencana perbaikan: `".read": true,
".write": false` untuk publik, dan ESP32 menulis memakai token/secret.

### F. Kualitas dataset & indikasi overfitting

Ini yang paling mungkin ditanya dosen yang teliti soal metrik. Dua hal yang
**benar-benar terbaca dari data** dan aman disebut:

- **Dataset kecil**: ±400 gambar latih / ±100 validasi untuk 5 kelas. Untuk
  deteksi objek, itu tergolong sedikit.
- **Recall 0,984 tapi precision 0,765.** Ini kesenjangan yang nyata dan mudah
  dibaca: model berhasil menemukan hampir semua karang yang ada (recall tinggi),
  tapi sekitar **1 dari 4 deteksinya adalah positif palsu** — dia terlalu
  "royal" menandai objek sebagai karang. Untuk aplikasi ini efeknya: hitungan
  total karang cenderung **berlebih**, bukan kurang.

Kalau ditanya, jawab begini:
> "Recall-nya tinggi, 0,98 — modelnya jarang melewatkan karang. Tapi
> precision-nya 0,765, artinya sekitar seperempat deteksinya positif palsu.
> Dengan dataset hanya ±400 gambar latih untuk 5 kelas, saya tidak mengklaim
> angka ini sebagai generalisasi ke perairan lain. Untuk validasi yang benar
> perlu pemisahan set berdasarkan **sumber pengambilan gambar** — bukan acak
> per gambar, karena gambar dari satu sesi penyelaman sangat mirip satu sama
> lain — lalu diuji pada footage lapangan yang belum pernah dilihat model."

> 📌 **Catatan untuk dirimu sendiri, jangan disebut kecuali ditanya:**
> di `results.csv`, kolom `mAP@50-95` bernilai sama persis dengan `mAP@50` pada
> 7 dari 50 epoch (termasuk epoch-epoch akhir), padahal di epoch awal keduanya
> jelas berbeda (0,449 vs 0,338). Secara matematis mAP@50-95 adalah rata-rata
> AP di ambang IoU 0,50–0,95 sehingga **selalu ≤ mAP@50**; sama persis itu
> janggal dan kemungkinan besar **artefak pencatatan log**, bukan perilaku
> model. Karena belum bisa dipastikan penyebabnya, **jangan** jadikan itu bahan
> argumen apa pun — cukup laporkan mAP@50 saja di slide. Kalau penguji yang
> menyorot kolom itu, jawab: *"Saya menyadari kolom itu janggal dan belum
> sempat menelusuri penyebabnya di log training; yang saya pegang sebagai
> metrik adalah mAP@50."*

### G. Klasifikasi kesehatan adalah heuristik, bukan ukuran biologis

Ambang HSV (40/160/90) ditentukan **secara empiris**, bukan dari standar
seperti *Coral Health Chart* CoralWatch. Kode sendiri mengakuinya
(`coral_logic.py:29`). Juga sensitif terhadap kondisi cahaya bawah air — air
keruh atau kedalaman berbeda menggeser saturasi.

Jawaban jujur yang kuat:
> "Ini indikator cepat berbasis aturan untuk memberi gambaran visual ke
> pengunjung, bukan diagnosis pemutihan yang tervalidasi. Ambangnya perlu
> dikalibrasi ulang pada footage tiap lokasi. Pengembangan lanjutnya: melatih
> classifier terpisah untuk kesehatan dengan label dari ahli terumbu karang,
> atau kalibrasi warna memakai color chart sebagai referensi dalam frame."

### H. Utang teknis yang sudah ditandai di kode

Semuanya sudah ditulis sebagai komentar `ponytail:` — tunjukkan ini kalau
ditanya "apa yang Anda tahu belum optimal?". Bahwa sudah tertulis di kode
menunjukkan itu keputusan sadar, bukan kelalaian.

| Lokasi | Batas yang diketahui | Jalur peningkatan |
|---|---|---|
| `app/api/chat/route.ts:78` | rate limit di memori, per-instance; hilang tiap cold start | pindah ke Firestore/Upstash |
| `app/api/send-verification/route.ts:13` | belum ada rate limit per-IP | tambah kalau ada spam |
| `lib/firestore.ts:600` | `fetchRatingSummaries()` membaca **semua** ulasan sekali jalan | denormalisasi rata-rata ke dokumen destinasi |
| `app/manifest.ts:24` | satu SVG untuk semua ukuran ikon | ganti PNG 192/512 kalau prompt install tidak muncul |
| `lib/useLang.tsx:24` | bahasa dibaca setelah mount | |

### I. Skala

Belum diuji beban. Titik jenuh yang bisa diperkirakan: server kamera menjalankan
satu instance YOLO per kamera yang ditonton di CPU — di laptop, ~2-3 kamera
serentak sudah berat. Solusinya GPU, atau menurunkan fps inferensi (inferensi
tiap N frame, bukan tiap frame).

---

## 10. Bank pertanyaan penguji

### Umum

**"Apa kebaruan (novelty) sistem Anda dibanding Traveloka/Tiket.com?"**
> Integrasi **verifikasi kondisi lapangan secara real-time** ke dalam alur
> pemesanan. OTA komersial menjual berdasarkan foto dan deskripsi statis. Di
> sini calon pengunjung bisa melihat kamera langsung dan data sensor
> (suhu air, cuaca, angin) sebelum memutuskan — relevan khusus untuk wisata
> selam, di mana cuaca dan jarak pandang menentukan pengalaman. Ditambah lapisan
> AI yang memantau kesehatan terumbu karang, sehingga platformnya juga berfungsi
> sebagai alat konservasi, bukan hanya transaksi.

**"Kenapa Next.js, bukan React biasa?"**
> Tiga alasan: (1) routing berbasis folder — tidak perlu konfigurasi router
> manual; (2) API Route Handler — backend dan frontend satu repo, jadi kunci
> rahasia seperti `GEMINI_API_KEY` dan service account bisa disimpan di server
> tanpa proyek terpisah; (3) Server Component & optimasi bawaan (font, gambar,
> code splitting) yang di React murni harus diatur sendiri.

**"Bagaimana pengujiannya?"**
> Tiga lapis. (1) Unit test Python dengan pytest untuk logika murni —
> `tests/test_coral_logic.py` menguji klasifikasi kesehatan dan penghitungan
> track tanpa perlu kamera fisik. (2) Uji mandiri berbasis `assert` untuk
> fungsi TypeScript murni: `lib/format.check.ts`, `lib/verification.check.ts`,
> `lib/i18n.check.ts` — sengaja tanpa import apa pun supaya bisa dijalankan
> `node` polos tanpa bundler, dan dikecualikan dari build (`tsconfig.json`).
> (3) Uji integrasi manual end-to-end untuk alur booking→scan→bayar.
> Keterbatasannya: belum ada automated E2E test dan belum ada uji beban.

### Teknis — siap-siap

**"Apa yang terjadi kalau dua petugas scan tiket yang sama bersamaan?"**
→ Jawaban §5(a). Sebut kata **race condition** dan **runTransaction**.

**"Data pemesan kan sensitif. Bagaimana Anda melindunginya?"**
→ Jelaskan lapisan aturan Firestore, LALU akui kelemahan §9.B sebelum diminta.
Format jawaban: *"Ada tiga lapisan… namun saya menyadari aturan koleksi
bookings masih terlalu longgar untuk read: saat ini semua pengguna terautentikasi
bisa membacanya. Perbaikannya…"*

**"Kalau saya ubah role saya sendiri jadi admin lewat console browser, bisa?"**
→ Tidak. `firestore.rules:25` mensyaratkan `request.resource.data.role ==
resource.data.role` untuk update oleh pemilik. Menaikkan role hanya bisa
dilakukan akun ber-role admin. Dan aturan create memaksa `role == 'user'`
(baris 16), jadi tidak bisa juga mendaftar langsung sebagai admin.

**"Kunci API Firebase Anda kelihatan di source browser."**
→ Betul, dan itu memang desainnya. Kunci API Firebase bukan kredensial rahasia —
dia hanya pengenal proyek untuk merutekan request. Yang mengamankan data adalah
security rules yang dievaluasi di server Google. Yang benar-benar rahasia adalah
service account (`FIREBASE_ADMIN_SA_B64`) dan `GEMINI_API_KEY`, keduanya
server-only dan tidak pernah masuk bundle browser.

**"Berapa akurasi model Anda?"**
→ §7.1. Sebut angkanya, LALU §9.F soal keterbatasan dataset. Jangan berhenti di
angka saja.

**"Kenapa deteksinya tidak jalan terus?"**
→ §5, `CameraWorker`. Sebut *lazy loading*, *idle-stop 30 detik*, dan
`peek_worker()`. Ini jawaban yang mengesankan karena menunjukkan kamu berpikir
soal sumber daya, bukan cuma "yang penting jalan".

**"Kalau internetnya mati di lokasi, sistemnya bagaimana?"**
→ §8.2. Sebut pasangan service worker + Firestore persistent cache, dan sebut
batasnya dengan jujur.

**"Kenapa ada dua server Python?"**
→ `app_web.py` adalah versi awal: satu kamera global, dipakai untuk halaman
Monitoring dan sebagai bukti konsep deteksi. `kamera_deteksi.py` adalah
penggabungan: arsitektur multi-kamera + deteksi coral, dengan Firestore sebagai
sumber kebenaran daftar kamera. Yang dipakai sistem sekarang adalah
`kamera_deteksi.py`; `app_web.py` dipertahankan untuk demo mandiri.

**"Bagaimana server Python tahu ada kamera baru?"**
→ Bukan polling. `col.on_snapshot()` (`kamera_deteksi.py:685`) — listener
real-time Firestore. Snapshot awal dibaca sinkron dulu supaya server sudah bisa
melayani stream sebelum listener async menyala.

**"Kenapa ada pemisahan mitra dan pengelola?"**
→ Beda tanggung jawab dan beda perangkat. **Mitra** menyediakan kamera —
haknya terbatas pada kamera miliknya sendiri. **Pengelola** mengurus destinasi
di suatu wilayah — dapat paket sensor IoT, akses dashboard, dan bisa men-scan
tiket. Karena kewajibannya berbeda, perjanjiannya juga berbeda: Perjanjian
Mitra menyangkut pembelian dan pemasangan kamera oleh petugas; Perjanjian
Pengelola menyangkut pembelian paket sensor dan penerimaan pembayaran
pengunjung. Keduanya diversikan terpisah di `lib/verification.ts:13-24`.

### Kalau tidak tahu jawabannya

Jangan mengarang. Pola yang aman:

> "Untuk bagian itu saya belum menguji/mengukurnya secara spesifik. Yang saya
> tahu, [fakta yang benar-benar kamu tahu]. Kalau boleh saya catat sebagai
> perbaikan, pendekatan yang akan saya ambil adalah [langkah konkret]."

Penguji jauh lebih menghargai batas pengetahuan yang jujur daripada tebakan
percaya diri yang salah — dan tebakan yang salah membuka pertanyaan susulan
yang lebih dalam.

---

## 11. Checklist sebelum maju

- [ ] Bisa menggambar diagram arsitektur §1 di papan tulis dari ingatan
- [ ] Hafal angka: 400/100 gambar, 5 kelas, 50 epoch, mAP@50 = 0,835
- [ ] Bisa menjelaskan `checkInBooking` dan kata "race condition"
- [ ] Bisa menjelaskan kenapa `parseTicketId` punya regex
- [ ] Bisa menjelaskan kenapa dua database (Firestore vs RTDB)
- [ ] **Sudah menyiapkan slide keterbatasan** (§9) — jangan sampai penguji
      yang menemukan duluan
- [ ] Server kamera + ESP32 sudah dites nyala sebelum hari-H
- [ ] Punya rekaman video demo sebagai cadangan kalau WiFi ruang sidang jelek
- [ ] `.env.local` tidak ikut ke mana-mana; service account tetap di luar repo

**Tiga hal yang harus diverifikasi sendiri (jangan percaya dokumen ini
mentah-mentah):**

- [ ] **Salin `.ino` terbaru** dari PC flashing ke `firmware/` — versi di repo
      usang, belum ada GPS, masih ada EC (§5 Alur C)
- [ ] **Cek aturan RTDB** di Firebase Console — jangan mengaku ada lubang
      keamanan yang mungkin sudah kamu tutup (§9.E)
- [ ] **Konfirmasi jumlah gambar dataset** di mesin tempat training berjalan —
      `data.yaml` menunjuk path Windows, angka 400/100 dihitung dari folder
      lokal (§7.1)
