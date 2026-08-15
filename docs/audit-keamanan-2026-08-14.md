# Audit Codebase Nusa (OTA) — 14 Agustus 2026

Auditor: senior code auditor · Commit: `f04be74` · Working tree: bersih
Cakupan: seluruh `app/`, `components/`, `lib/`, `firestore.rules`, `public/sw.js`, konfigurasi build & dependency.

---

## 1. Executive Summary

### Jumlah temuan per severity

| Severity | Jumlah | Ringkasan |
|---|---|---|
| **Critical** | 2 | RTDB terbuka baca-tulis untuk publik · pembayaran tiruan menerbitkan tiket sah di produksi |
| **High** | 6 | 2 endpoint tanpa auth/rate-limit, nol security header, nol Open Graph, halaman destinasi client-only, setting kamera global |
| **Medium** | 12 | Jejak perjanjian bisa dipalsukan, path injection admin-gated, dependency runtime, error boundary, indeks Firestore |
| **Low** | 7 | Biaya listener, re-render sensor, kebocoran minor, kerapian |
| **Total** | **27** | |

> ### Status pengerjaan (15 Agustus 2026)
>
> Dua commit di branch `fix/pengerasan-audit`, belum di-merge ke `main`, belum di-push.
>
> | Commit | Isi |
> |---|---|
> | `148b137` | **S-04** (rules RTDB masuk repo), **S-07** (path injection), **S-09** (`.vercelignore`), **S-13** (log dipotong), **Q-02** (error boundary), **F-02a** (config indeks), **F-03** (kueri pengelola berfilter), **P-04** (detak sensor + `memo`), **P-05** (i18n), **Q-05** (kerapian) |
> | `ee7f76b` | **S-11** (pengajuan pengelola pindah ke `/api/role-request`; `verification` ditutup dari klien; penjaga regresi `lib/roleRequest.check.ts`) |
>
> **Ditunda atas keputusan pemilik proyek:** S-01 (pembayaran, masih direvisi), seluruh High (S-02, S-03, S-05, S-06, P-01, T-01), dan Q-03 (`guests` — dua-duanya opsi mengubah perilaku yang terlihat pengguna, sementara masalahnya kejelasan operasional, bukan keamanan).
>
> **Status deploy:**
> - ✅ **`database.rules.json` sudah naik** (15 Agu 2026). Root tertutup, cabang `monitoring` tetap terbuka untuk website dan firmware. Matriks verifikasinya di S-04.
> - ⏳ **`firestore.rules` belum naik.** Wajib menunggu kode aplikasi ada di Vercel lebih dulu — urutannya tidak bisa dibalik, lihat catatan di S-11.
>
> Verifikasi tiap commit: `tsc` bersih, seluruh self-test lolos (7/7 lalu 8/8), build produksi hijau, `firestore.rules` divalidasi Firebase CLI.
>
> ---
>
> **Dua koreksi terhadap terbitan pertama:**
> **(1)** **S-04 naik dari High ke Critical.** Isi rules RTDB akhirnya dibuka: `{".read": true, ".write": true}` di seluruh pohon — default *test mode* yang tidak pernah dicabut. Tulis publik yang tadinya "belum terverifikasi" ternyata **terbuka**.
> **(2)** Hitungan terbitan pertama meleset: **P-01** ditandai HIGH di badan laporan tapi tidak ikut terhitung di ringkasan. Totalnya 27, bukan 25.

### Penilaian umum

Ini **bukan** codebase pemula. Beberapa hal yang biasanya jadi temuan Critical di proyek sekelas ini sudah ditutup dengan benar dan sengaja:

- `firestore.rules` (316 baris) tidak punya satu pun `allow read, write: if true` yang keliru. Setiap `allow` publik yang ada memang untuk data publik (`destinations`, `reviews`, `monitoring_data`), dan setiap yang tertutup disertai alasan tertulis.
- Koleksi `bookings` dan `loginCodes` **ditutup total** dari klien (`if false`) dan hanya bisa ditulis Admin SDK. Ini yang membuat harga, urutan status tiket, dan status pembayaran tidak bisa dipalsukan dari browser.
- Harga **dihitung ulang di server**. Sudah ak telusuri sampai ke dasarnya: `bookingLines()` di `lib/destination.ts:271` meng-clamp `qty` ke `MAX_QTY`, menggugurkan `NaN`/`Infinity`/negatif/harga rusak, dan `resolveHours()` mengunci durasi di 1–24. Klaim "klien tidak bisa mengarang tagihan" **valid**, bukan sekadar komentar.
- Kuota per tanggal ditegakkan **di dalam transaksi Firestore** (`app/api/bookings/route.ts:299`), sudah teruji 8 pembayaran serentak pada stok 2.
- Path injection sudah diantisipasi di dua tempat (`docId()` di `route.ts:62`, `parseTicketId()` di `ScanPanel.tsx:47`).
- Cross-check yang diminta rules sendiri **cocok persis**: `EDITABLE_KEYS` (`PengelolaDestinasiPanel.tsx:30`) ↔ `firestore.rules:158`, dan daftar field `addChildDestination()` (`firestore.ts:198`) ↔ `firestore.rules:122`.
- **Semua** listener realtime punya cleanup. Ak periksa satu per satu — nol kebocoran.
- Nol `any`, nol `@ts-ignore`, nol `dangerouslySetInnerHTML` dari data pengguna.
- Rahasia **tidak pernah** masuk git (diverifikasi via `git log --all --diff-filter=A`).

Yang tersisa terkonsentrasi di tiga tempat: **(a)** endpoint publik yang belum punya rem, **(b)** lapisan platform yang belum digarap sama sekali (header keamanan, Open Graph, rules RTDB), dan **(c)** pembayaran yang masih tiruan tapi sudah tayang di produksi.

---

## 2. Detail Temuan

## §1 SECURITY

---

### 🔴 S-01 · CRITICAL · Pembayaran tiruan menerbitkan tiket sah di produksi

**File:** `app/api/bookings/route.ts:292-331`

Cabang `pay()` menandai booking lunas **tanpa memverifikasi pembayaran apa pun**. Tidak ada gateway, tidak ada webhook, tidak ada nominal yang dicek. Cukup satu request:

```http
POST /api/bookings
Authorization: Bearer <ID token akun apa pun yang emailnya terverifikasi>

{ "action": "pay", "bookingId": "<booking sendiri>", "method": "apa saja" }
```

Hasilnya: `paymentStatus: 'paid'`, `status: 'confirmed'`, QR terbit, dan `ScanPanel` meloloskan check-in.

**Risiko.** Setiap pengguna terdaftar bisa menerbitkan tiket gratis tanpa batas untuk destinasi mana pun. Karena stok baru dipotong saat "bayar", pelaku juga bisa **menghabiskan seluruh kuota** semua destinasi pada semua tanggal secara gratis — denial-of-inventory terhadap pengelola.

Ini **diketahui dan disengaja** sebagai placeholder (didokumentasikan jujur di `route.ts:274-278` dan `firestore.ts:826-836`), dan arsitekturnya sudah benar — keputusan lunas ada di server, tinggal isinya diganti. Tapi kode ini **sudah live di Vercel produksi**, dan di produksi niat tidak melindungi apa pun.

**Perbaikan.** Pecah `pay()` jadi dua: satu membuat transaksi ke gateway, satu webhook yang menjalankan bagian bawah setelah dana terkonfirmasi.

```ts
// app/api/bookings/route.ts — cabang 'pay' jadi "buat transaksi", bukan "lunasi"
async function pay(ctx: Ctx, body: Record<string, unknown>) {
  const id = docId(body.bookingId);
  if (!id) return bad('missing-field', 400);

  const snap = await adminDb().doc(`bookings/${id}`).get();
  const b = snap.data();
  if (!snap.exists || b?.userId !== ctx.uid) return bad('forbidden', 403);
  if (b.paymentStatus === 'paid') return bad('already-paid', 409);

  // order_id = id booking → sekaligus kunci idempotensi webhook.
  const tx = await createGatewayTransaction({
    orderId: id,
    grossAmount: b.amount,          // dari dokumen, BUKAN dari body
    customer: { name: b.name, phone: b.phone },
  });
  await snap.ref.update({ paymentRef: tx.token, paymentStatus: 'awaiting' });
  return NextResponse.json({ redirectUrl: tx.redirect_url });
}
```

```ts
// app/api/payments/webhook/route.ts — BARU. Hanya di sini 'paid' boleh ditulis.
export async function POST(req: Request) {
  const notif = await req.json();

  // Wajib: verifikasi signature. Tanpa ini webhook = endpoint "lunasi gratis".
  const expected = createHash('sha512')
    .update(`${notif.order_id}${notif.status_code}${notif.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`)
    .digest('hex');
  if (notif.signature_key !== expected) return bad('bad-signature', 403);
  if (notif.transaction_status !== 'settlement' && notif.transaction_status !== 'capture') {
    return NextResponse.json({ ok: true }); // status lain diabaikan, bukan error
  }

  const ref = adminDb().doc(`bookings/${docId(notif.order_id)}`);
  // Transaksi + cek stok DI SINI — persis blok yang sekarang ada di pay().
  // Idempoten: 'already-paid' langsung keluar, webhook boleh datang berkali-kali.
  ...
}
```

> **Catatan penting** dari `lib/destination.ts:323-328` yang harus ikut dikerjakan: gateway mengambil uang **sebelum** webhook memberi tahu. Begitu itu terjadi, stok butuh golongan kedua — kursi yang **ditahan sementara** selama jendela pembayaran, dengan kedaluwarsa. Tanpa itu, pembayaran yang datang belakangan menemukan kursinya habis padahal uangnya sudah diterima → jadi urusan refund.

---

### 🟠 S-02 · HIGH · `/api/send-verification` tanpa auth dan tanpa rate limit

**File:** `app/api/send-verification/route.ts:14-23`

```ts
export async function POST(req: Request) {
  let email: string | undefined;
  try { ({ email } = await req.json()); } catch { ... }
  if (!email || typeof email !== 'string') { ... }
  // ← langsung generateEmailVerificationLink + sendMail. Tidak ada rem.
```

Endpoint publik, tanpa token, tanpa cooldown, tanpa batas per-IP. Komentar di `:13` sudah mengakuinya (`ponytail: tanpa rate-limit per-IP`).

**Risiko.** Tiga sekaligus, dan yang ketiga paling mahal:

1. **Email bomb.** Siapa pun yang tahu satu alamat email terdaftar bisa membanjirinya dengan email verifikasi Nusa — ribuan per menit dengan satu loop `curl`.
2. **Kuota SMTP habis.** Brevo/Resend gratis punya batas harian. Sekali dihabiskan, **kode login juga ikut mati** — `request-code` memakai transport yang sama (`lib/mailer.ts`). Artinya ini bukan cuma spam: ini **jalur mematikan seluruh login aplikasi**.
3. **Reputasi domain.** Volume mendadak + laporan spam → domain pengirim masuk blocklist.

Bandingkan dengan `/api/auth/request-code` yang justru sudah punya cooldown 60 detik per email (`loginCode.ts:93`). Rem itu tinggal dipakai ulang.

**Perbaikan.** Pakai helper `overLimit()` yang sama dengan S-10 — satu mekanisme, satu koleksi, satu blok rules untuk ditutup. Dibatasi dua sumbu sekaligus: **per alamat tujuan** (menahan email bomb ke satu korban) dan **per IP** (menahan satu penyerang menggilir banyak alamat).

```ts
// app/api/send-verification/route.ts
import { isEmail, normalizeEmail } from '@/lib/loginCode';
import { overLimit } from '@/lib/rateLimit';   // lihat S-10

export async function POST(req: Request) {
  let email: unknown;
  try { ({ email } = await req.json()); } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (typeof email !== 'string' || !isEmail(email)) {
    return NextResponse.json({ error: 'email-invalid' }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';

  // Balasannya tetap { ok: true } saat kena batas — sama seperti jalur
  // user-not-found di :35. Membedakan "kena rate limit" dari "terkirim"
  // membocorkan email mana yang punya akun.
  if (await overLimit('verify-email', normalized, 1)) return NextResponse.json({ ok: true });
  if (await overLimit('verify-email-ip', ip, 5)) return NextResponse.json({ ok: true });
  ...
}
```

`overLimit` memakai kunci per-menit, jadi `limit: 1` berarti maksimal satu email verifikasi per alamat per menit — cukup longgar untuk pengguna asli, cukup rapat untuk membuat email bomb tidak berguna. Koleksi `rateLimits` ditutup di rules (lihat S-10), jadi tidak ada blok rules tambahan yang perlu dibuat.

---

### 🟠 S-03 · HIGH · `/api/chat` tanpa auth; throttle in-memory tidak mengikat di serverless

**File:** `app/api/chat/route.ts:81-93, 102-112`

```ts
const hits = new Map<string, number[]>();
const WINDOW = 60_000;
const LIMIT = 8; // pesan per IP per menit

function throttled(ip: string): boolean { ... }
```

**Risiko.** Throttle-nya hidup di memori satu instance. Fluid Compute menjalankan **banyak instance paralel**, dan tiap instance punya `Map` sendiri — batas efektifnya `8 × jumlah_instance`, dan bertambah persis saat traffic naik. Ia juga reset tiap cold start. Ditambah `hits.clear()` di `:91` yang menghapus penghitung **semua orang** begitu map lewat 500 entry.

Konsekuensinya konkret: `GEMINI_API_KEY` adalah kunci berbayar (atau kuota gratis yang terbatas). Endpoint chat terbuka untuk siapa pun tanpa akun, dan tiap pesan juga menyeret pembacaan koleksi `destinations` (di-cache 5 menit — itu bagian yang sudah benar). Penyalahgunaan = tagihan Gemini, atau chat mati untuk pengunjung asli.

**Perbaikan.** Rate limit harus berbagi state antar instance. Yang paling murah tanpa menambah infrastruktur: pakai Firestore yang sudah ada.

```ts
// app/api/chat/route.ts
async function throttled(ip: string): Promise<boolean> {
  const menit = Math.floor(Date.now() / WINDOW);
  // Id per-IP-per-menit → dokumen kedaluwarsa sendiri, tidak perlu penyapu.
  const ref = adminDb().doc(`chatThrottle/${createHash('sha256').update(ip).digest('hex')}_${menit}`);
  const n = await adminDb().runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data()?.n ?? 0;
    if (cur >= LIMIT) return cur;
    tx.set(ref, { n: cur + 1 });
    return cur + 1;
  });
  return n > LIMIT;
}
```

Lebih baik lagi: wajibkan akun untuk chat (`verifyIdToken`) dan pakai `uid` sebagai kunci — IP mudah digilir, uid tidak. Kalau chat memang harus terbuka untuk anonim, minimal turunkan `LIMIT` dan pasang batas global harian.

> **Catatan privasi (Low, terkait).** `destinationContext()` di `:23-55` mengirim **nomor WhatsApp pengelola** ke Google sebagai bagian system instruction. `store: false` sudah dipasang (bagus), tapi nomor pribadi pihak ketiga tetap keluar ke prosesor lain. Pertimbangkan membuang `whatsapp` dari katalog dan menyuruh bot mengarahkan ke halaman destinasi.

---

### 🔴 S-04 · CRITICAL · RTDB terbuka baca **dan tulis** untuk publik (terkonfirmasi 15 Agu 2026)

> **Status berubah sejak terbitan pertama.** Waktu laporan ini pertama ditulis, tulis publik masih "belum terverifikasi" — ak menolak menulis ke database produksi tanpa izin. Isi rules-nya kemudian dibuka, dan hasilnya kondisi terburuk dari dua kemungkinan yang ak sebut:
>
> ```json
> { "rules": { ".read": true, ".write": true } }
> ```
>
> **Tanpa auth, di seluruh pohon.** Siapa pun yang tahu URL database ini bisa:
> - **menghapus seluruh database** dengan satu `curl -X DELETE '…/.json'`
> - memalsukan suhu air, cuaca, dan koordinat GPS yang tayang di halaman publik dan dashboard pengelola
> - menulis data tanpa batas di path mana pun → kuota & tagihan RTDB
>
> Ini default *test mode* Firebase yang tidak pernah dicabut. Analisis di bawah tentang **baca** publik tetap berlaku (itu memang perilaku produk); yang naik jadi Critical adalah **tulis**.
>
> **✅ SUDAH DI-DEPLOY — 15 Agustus 2026.** `firebase deploy --only database`. Rules baru propagasi dalam ~10 detik, diverifikasi dengan matriks di bawah, dan data sensar asli terbukti tidak tersentuh (md5 sebelum = sesudah).
>
> | Uji | Hasil | Arti |
> |---|---|---|
> | Baca `monitoring` | `200` | Website tetap menayangkan sensor |
> | Baca `monitoring/latest` | `200` | Halaman destinasi & hero tetap jalan |
> | **Tulis `monitoring/latest`** | `200` | **Firmware yang sekarang tetap bisa masuk** |
> | **Tulis `monitoring/<stasiun>/latest`** | `200` | Bentuk ber-stationId juga siap |
> | Baca root | `401` | ⬅ dulu `200` |
> | Tulis root | `401` | ⬅ dulu `200` |
> | **Hapus seluruh `monitoring`** | `401` | ⬅ dulu `200` — ini yang paling berbahaya |
> | Tulis di luar `monitoring` | `401` | ⬅ dulu `200` |
>
> Nol perubahan di ESP32, nol perubahan di kode website — kode hanya menyentuh RTDB di satu titik (`lib/realtime.ts:48`), dan selalu di bawah `monitoring/`.
>
> **Catatan operasional dari verifikasi:** menghapus node stasiun itu sendiri (`monitoring/<stasiun>`) ditolak — izin tulis hanya diberikan di `<stasiun>/latest`. Itu memang disengaja, tapi artinya membuang stasiun lama harus lewat Firebase Console, bukan dari perangkat.
>
> **Yang masih terbuka:** menulis ke path sensor tidak menuntut identitas, jadi angka sensor masih bisa dipalsukan orang yang tahu URL database. Menutupnya butuh keputusan cara auth firmware — tahap 2 di bawah.

---

#### Analisis awal (tetap berlaku): rules tidak terlacak, baca publik memang disengaja

**File:** `firebase.json:1-5` (hanya mendeklarasikan `firestore`), tidak ada `database.rules.json`

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

RTDB adalah sumber **seluruh data sensor IoT** (`lib/realtime.ts`, `monitoring/<stationId>/latest`), ditulis firmware di lapangan. Rules-nya hanya hidup di Firebase Console: tidak bisa di-review, tidak bisa di-diff, tidak masuk code review, dan tidak bisa di-deploy ulang kalau seseorang mengubahnya lewat Console.

Probe read-only yang ak jalankan:

```
$ curl 'https://ota-db-default-rtdb.firebaseio.com/.json?shallow=true'
HTTP 200
{"monitoring":true}
```

**Baca publik tanpa auth = terkonfirmasi terbuka.** Ini kemungkinan besar **memang disengaja** dan konsisten dengan produk: `firestore.rules:163-165` juga membuka `monitoring_data` untuk publik, `lib/firebase.ts` menginisialisasi `rtdb` untuk pengunjung anonim, dan `HeroSensorLinks`/`LiveMonitorPanel` menayangkan angka sensor di halaman publik. Isinya telemetri lingkungan, bukan PII. Jadi read terbuka **bukan kebocoran**.

Yang menentukan severity adalah **write**, dan itu **belum ak verifikasi** — memverifikasinya berarti menulis ke database produksi kalian, jadi ak tidak melakukannya tanpa izin.

**Hasil:** rules-nya dibuka manual — `.write: true` di root. Kondisi terburuk, seperti diringkas di kotak atas.

**Perbaikan — dua tahap, sengaja dipisah.**

**Tahap 1 (sudah ada di repo, belum di-deploy).** `database.rules.json` menutup root dan hanya membuka cabang `monitoring`. Yang penting: **firmware tidak perlu diubah sama sekali** — path yang ditulisnya masih terbuka persis seperti sebelumnya, tanpa auth dan tanpa validasi bentuk. Yang tertutup adalah semua yang lain.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "monitoring": {
      ".read": true,
      // Bentuk lama — satu-satunya cabang yang saat ini terisi.
      "latest":      { ".write": true },
      // Bentuk sekarang, satu cabang per paket sensor.
      "$stationId": { "latest": { ".write": true } }
    }
  }
}
```

Yang ini sudah menutup: penghapusan database, penulisan di path sembarang, dan pembacaan apa pun di luar `monitoring`. Yang **belum**: memalsukan angka sensor di path yang benar.

```bash
firebase deploy --only database
# tunggu ~2 menit — propagasi rules tidak instan, probe detik-detik setelah
# deploy bisa lolos padahal seharusnya sudah ditolak.

# Verifikasi: root harus 401, monitoring harus 200.
curl -s -o /dev/null -w 'root  %{http_code}\n' 'https://ota-db-default-rtdb.firebaseio.com/.json?shallow=true'
curl -s -o /dev/null -w 'monit %{http_code}\n' 'https://ota-db-default-rtdb.firebaseio.com/monitoring.json?shallow=true'
```

**Tahap 2 (menunggu keputusan auth firmware).** Inilah yang dulu jadi blocker, dan memang tidak bisa diselesaikan tanpa memutuskan bagaimana firmware membuktikan diri. Begitu itu ada, ganti `".write": true` jadi:

```json
"$stationId": {
  "latest": {
    ".write": "auth != null && auth.token.station === $stationId",
    ".validate": "newData.hasChildren(['updatedAt'])",
    "tempDHT":   { ".validate": "newData.isNumber() && newData.val() >= -50 && newData.val() <= 100" },
    "humidity":  { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100" },
    "updatedAt": { ".validate": "newData.isNumber()" }
  }
}
```

Validasi rentang itu bukan hiasan: tanpa `.validate`, satu paket sensor yang rusak (atau dipalsukan) bisa menulis `tempDHT: 99999` dan halaman publik menayangkannya apa adanya — `fmt()` di `LiveMonitorPanel.tsx:24` hanya menyaring `NaN`, bukan kewajaran. Blok itu sudah ditulis dalam bentuk komentar di `database.rules.json`, tinggal dihidupkan.

> **Kalau sensor mendadak Offline setelah deploy tahap 1**, penyebabnya hampir pasti satu: firmware menulis ke path di luar dua yang dibuka (mis. ke `monitoring/` langsung, bukan ke `monitoring/latest`). Obatnya satu baris — pindahkan `".write": true` naik ke level `monitoring`. Itu tetap jauh lebih aman daripada terbuka di root.

---

### 🟠 S-05 · HIGH · Nol security header (tidak ada `next.config`, tidak ada `middleware`)

**File:** `next.config.mjs:1-4` — kosong. Tidak ada `middleware.ts`, tidak ada `vercel.json`.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

Aplikasi dikirim **tanpa** `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `X-Content-Type-Options`, maupun `Permissions-Policy`.

**Risiko.** Yang paling nyata untuk OTA:

- **Clickjacking di halaman checkout.** Tanpa `X-Frame-Options`/`frame-ancestors`, `/booking` bisa di-`<iframe>` situs lain dan tombol "Konfirmasi" ditumpuk overlay. Untuk halaman yang membuat transaksi, ini bukan teoritis.
- **Tidak ada CSP.** Aplikasi ini memuat gambar dari **URL sembarang yang diketik pengelola** (`PengelolaDestinasiPanel.tsx:364`) dan siaran MJPEG dari alamat server di Firestore. Tanpa CSP, tidak ada satu pun pagar di sisi browser.
- **Referrer bocor.** Default `strict-origin-when-cross-origin` sudah lumayan, tapi belum eksplisit — dan tautan keluar ke Google Maps (`LiveMonitorPanel.tsx:401`) membawa path halaman.

**Perbaikan.**

```js
// next.config.mjs
const csp = [
  "default-src 'self'",
  // 'unsafe-inline' terpaksa: layout.tsx memasang 3 inline script (tema, lang, SW).
  // Hilangkan dengan nonce kalau nanti pindah ke middleware.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Gambar destinasi & siaran MJPEG datang dari host sembarang → https: dibuka,
  // tapi http: sengaja TIDAK, supaya mixed content ketahuan saat pengelola salah tempel.
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
      ],
    }];
  },
};

export default nextConfig;
```

> `camera=(self)` bukan `camera=()`: `ScanPanel` butuh kamera untuk memindai QR tiket. Deploy CSP dengan `Content-Security-Policy-Report-Only` dulu selama beberapa hari — halaman ini memuat aset dari banyak host dan satu direktif keliru mematikan siaran kamera.

> **Diverifikasi sebelum merekomendasikan `img-src https:`.** `.env.local.example:10` masih mencontohkan server kamera di `http://192.168.1.10:5001`, yang kalau itu nilai sesungguhnya akan **diblokir** direktif ini. Ak baca dokumen produksinya: `settings/cameraServer.baseUrl` = `https://deepnorth-karang.duckdns.org` — **HTTPS**, jadi `img-src 'self' https: …` aman dan siaran MJPEG tetap jalan. Kalau nanti ada yang mengembalikan alamat LAN `http://`, siarannya akan mati **dua kali**: oleh CSP ini dan oleh mixed-content blocking browser (halaman HTTPS tidak boleh memuat gambar HTTP). Perbarui `.env.local.example:10` supaya tidak menyesatkan.

---

### 🟠 S-06 · HIGH · `settings/cameraServer` global, tapi bisa ditulis pengelola mana pun

**File:** `firestore.rules:297-312`, dipakai di `lib/firestore.ts:677-690` dan `LiveMonitorPanel.tsx:47-53`

```
match /settings/{settingId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && settingsUserRole() in ['pengelola', 'admin'];
}
```

Dokumen `settings/cameraServer` adalah **singleton global** — satu alamat untuk seluruh situs. Tapi rules mengizinkan **setiap** pengelola menulisnya, dan nilainya langsung jadi prefix URL siaran semua kamera:

```ts
// LiveMonitorPanel.tsx:53
: `${serverUrl.replace(/\/+$/, '')}/stream/${cam.cameraId}`;
```

**Risiko.** Satu akun pengelola (nakal, atau yang password/emailnya jatuh) mengubah `baseUrl` ke host miliknya, lalu **setiap browser pengunjung** di semua halaman destinasi dan halaman Monitoring menembak host itu. Konsekuensinya: seluruh siaran kamera situs mati sekaligus (denial of service), atau diganti gambar palsu, dan host penyerang memanen IP + `Referer` semua penonton. Tidak ada satu pun pengelola lain yang bisa mencegahnya, dan tidak ada jejak siapa yang mengubah.

Ini kelas kesalahan yang sama dengan yang rules ini justru sudah tutup rapat di tempat lain: `cameras/{id}` dikunci `hasOnly(['viewers','isPublic'])` tepat supaya pemilik tidak bisa menyentuh yang bukan haknya. Pagar itu belum dipasang di `settings`.

**Perbaikan.** Alamat server infrastruktur adalah urusan admin, bukan pengelola:

```
match /settings/{settingId} {
  allow read: if request.auth != null;
  // Alamat server kamera dipakai SELURUH situs — satu pengelola tidak boleh
  // memindahkan siaran semua orang. Naikkan ke admin saja.
  allow write: if request.auth != null
    && settingsUserRole() == 'admin'
    // Bentuknya ikut dijaga: bukan-string atau URL non-https membuat setiap
    // <img> siaran menembak alamat sembarang.
    && request.resource.data.baseUrl is string
    && request.resource.data.baseUrl.matches('^https://[a-zA-Z0-9.-]+(:[0-9]+)?/?$');
}
```

Kalau pengelola memang perlu mengatur servernya sendiri, pindahkan alamatnya **ke dokumen kamera** (`cameras/{id}.baseUrl`) supaya cakupannya ikut kepemilikan — bukan ke singleton global.

> **Regex `^https://` sudah dicek terhadap nilai produksi**, bukan diusulkan buta: `settings/cameraServer.baseUrl` saat ini `https://deepnorth-karang.duckdns.org` — lolos. Kalau ada instalasi lain yang masih memakai alamat LAN `http://`, longgarkan jadi `^https?://` **hanya untuk sementara** dan catat bahwa halaman HTTPS tidak akan bisa memuat siarannya (mixed content) — artinya alamat itu memang harus dinaikkan ke HTTPS, bukan regex-nya yang dilonggarkan permanen.

---

### 🟡 S-07 · MEDIUM · `uid` tidak divalidasi sebelum menyusun path dokumen

**File:** `app/api/delete-user/route.ts:33`, `app/api/notify-approval/route.ts:42`

```ts
// delete-user/route.ts:33
const uid = new URL(req.url).searchParams.get('uid');
if (!uid) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
...
await adminDb().doc(`users/${uid}`).delete();   // ← uid mentah masuk ke path
```

**Risiko.** `doc()` menerima path bersegmen. `uid = "abc/pengajuan/xyz"` menghasilkan `users/abc/pengajuan/xyz` — dokumen di **subkoleksi yang sama sekali lain**, dan `.delete()` menghapusnya. Sama persis di `notify-approval`.

Kedua endpoint sudah digerbangi role admin, jadi dampaknya terbatas pada admin yang keliru atau akun admin yang jatuh — makanya Medium, bukan High. Tapi yang bikin ini layak diperbaiki: **penjaganya sudah ada dua file di sebelah**, dan justru ditulis untuk alasan ini persis.

```ts
// app/api/bookings/route.ts:62-65 — sudah ada, tinggal dipakai ulang
function docId(v: unknown): string {
  const s = str(v, 128);
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : '';
}
```

**Perbaikan.** Angkat `str()` + `docId()` ke `lib/format.ts` (modul tanpa import, sudah jadi rumah fungsi murni serupa), lalu:

```ts
// app/api/delete-user/route.ts
import { docId } from '@/lib/format';

const uid = docId(new URL(req.url).searchParams.get('uid'));
if (!uid) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
```

```ts
// app/api/notify-approval/route.ts
let uid: unknown;
try { ({ uid } = await req.json()); } catch { ... }
const target = docId(uid);
if (!target) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
```

---

### 🟡 S-08 · MEDIUM · Dependency runtime dengan CVE (dan 1 "critical" yang sebenarnya dev-only)

**File:** `package.json:11-20`

`npm audit` melaporkan **18 kerentanan (1 critical, 11 high, 6 moderate)**. Angka itu **menyesatkan kalau dibaca mentah** — mayoritas tidak pernah ikut ke produksi. Pemisahannya:

| Paket | Severity | Jalur | Ikut ke produksi? |
|---|---|---|---|
| `@grpc/grpc-js` <1.9.16 | **High** (DoS, GHSA-5375-pq7m-f5r2 + GHSA-99f4-grh7-6pcq) | `firebase-admin` | ✅ **Ya** |
| `@google-cloud/storage` → `retry-request`, `teeny-request` | Moderate | `firebase-admin` | ✅ **Ya** |
| `websocket-driver` | *Critical* | `localtunnel` (devDep) | ❌ Tidak |
| `axios` (CSRF, SSRF) | High | `localtunnel` (devDep) | ❌ Tidak |
| `glob` → `@next/eslint-plugin-next` | High | `eslint-config-next` (devDep) | ❌ Tidak |

**Yang benar-benar perlu ditindak cuma baris 1 dan 2.** Satu-satunya "critical" justru datang dari `localtunnel` — alat dev untuk script `tunnel`, tidak pernah di-bundle.

**Perbaikan.**

```bash
# 1. Angkat rantai runtime. firebase-admin 14.x terbaru sudah memakai grpc-js >=1.9.16.
npm i firebase-admin@latest
npm audit --omit=dev          # ← inilah angka yang sebenarnya penting

# 2. localtunnel praktis tidak terawat dan menyeret axios+websocket-driver.
#    Ganti dengan tunnel bawaan yang tidak menambah dependency:
npm rm localtunnel
#    lalu di package.json: "tunnel": "npx --yes localtunnel --port 3000"
#    atau pakai `vercel dev` / `cloudflared tunnel` yang tidak masuk node_modules.
```

Tambahkan ke CI supaya tidak balik lagi:

```bash
npm audit --omit=dev --audit-level=high
```

> `overrides: { "jose": "^5.10.0" }` di `package.json:22-24` sengaja dipin — jangan dilepas saat upgrade. `jose` v6 membuat `verifyIdToken()` 500 di runtime Vercel.

---

### 🟡 S-09 · MEDIUM · Service account JSON di root repo tanpa `.vercelignore`

**File:** `ota-db-firebase-adminsdk-fbsvc-aeaa52f6cc.json` (2.358 byte, mode `600`), dirujuk `.env.local` via `GOOGLE_APPLICATION_CREDENTIALS`

**Yang sudah benar** — ak verifikasi, bukan berasumsi:
- `.gitignore:47` memuat `*-firebase-adminsdk-*.json` ✅
- `git ls-files` → tidak ke-track ✅
- `git log --all --diff-filter=A` → **tidak pernah** ter-commit sekali pun ✅
- Permission file `600` (hanya pemilik) ✅

**Yang tersisa.** Tidak ada `.vercelignore`. Deploy via Git integration aman (Vercel memakai isi repo). Tapi `vercel deploy` **dari CLI** meng-upload isi direktori kerja dengan hanya sebagian aturan `.gitignore` yang dihormati — file ini bisa ikut naik ke build. Kunci privat Admin SDK = bypass total seluruh `firestore.rules`.

**Perbaikan.**

```bash
# .vercelignore — BARU
*-firebase-adminsdk-*.json
serviceAccount.json
.env*.local
Proyek_Karang/
docs/
*.probe.mjs
```

Lebih baik lagi: pindahkan file JSON-nya keluar dari direktori repo sepenuhnya, dan arahkan `GOOGLE_APPLICATION_CREDENTIALS` ke sana.

```bash
mkdir -p ~/.config/nusa && mv ota-db-firebase-adminsdk-*.json ~/.config/nusa/
# .env.local:
# GOOGLE_APPLICATION_CREDENTIALS=/Users/<user>/.config/nusa/ota-db-firebase-adminsdk-fbsvc-aeaa52f6cc.json
```

Di produksi Vercel sudah pakai `FIREBASE_ADMIN_SA_B64` (base64 di env) — itu pendekatan yang benar dan tidak perlu diubah.

---

### 🟡 S-10 · MEDIUM · `verify-code` tanpa rem per-IP: brute force lintas-akun & penguncian login korban

**File:** `app/api/auth/verify-code/route.ts:18-48`, `lib/loginCode.ts:77-95`

Yang sudah benar: kode di-hash bersama email (`hashCode`), maksimal 5 tebakan (`MAX_ATTEMPTS`), TTL 10 menit, kedaluwarsa dicek **sebelum** kecocokan, kode dihapus sekali pakai sebelum token dibuat. Ini desain yang rapi.

Yang kurang: **tidak ada batas per-IP sama sekali** di `verify-code`, dan cooldown di `request-code` dikunci **per email**, bukan per pemanggil.

**Risiko.**

1. **Penguncian login korban (paling praktis).** Penyerang yang tahu email korban memanggil `request-code` tiap 60 detik. Tiap panggilan **menimpa** dokumen kodenya (`request-code/route.ts:48`). Korban yang menerima kode dan mengetiknya selalu telat — kodenya sudah diganti. Login korban praktis mati selama serangan berjalan, dan tidak ada indikasi apa pun kenapa.
2. **Brute force horizontal.** 5 tebakan per email per 10 menit terasa aman untuk satu akun (5/1.000.000). Tapi terhadap **daftar** 100.000 alamat sekaligus, ekspektasi keberhasilannya jadi nyata — dan tidak ada satu pun penghitung yang melihat lintas-email.

**Perbaikan.** Batas per-IP di kedua route. Perhatikan bahwa **kode yang masih hidup tidak bisa "dikirim ulang"** — yang tersimpan cuma hash-nya (`loginCode.ts:41`), teks aslinya sudah hilang. Jadi regenerasi harus tetap diizinkan; yang dibatasi adalah **berapa kali** dan **oleh siapa**, bukan apakah boleh:

```ts
// lib/rateLimit.ts — BARU, dipakai request-code, verify-code, send-verification, chat
import { createHash } from 'node:crypto';
import { adminDb } from './firebaseAdmin';

/** true = sudah lewat batas. Kunci per-menit → dokumennya kedaluwarsa sendiri. */
export async function overLimit(bucket: string, key: string, limit: number): Promise<boolean> {
  const menit = Math.floor(Date.now() / 60_000);
  const id = `${bucket}_${createHash('sha256').update(key).digest('hex').slice(0, 32)}_${menit}`;
  const ref = adminDb().doc(`rateLimits/${id}`);
  return adminDb().runTransaction(async (tx) => {
    const n = (await tx.get(ref)).data()?.n ?? 0;
    if (n >= limit) return true;
    tx.set(ref, { n: n + 1 });
    return false;
  });
}
```

```ts
// dipakai di tiap route:
const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
if (await overLimit('verify', ip, 10)) return bad('too-many-requests', 429);
```

```ts
// app/api/auth/request-code/route.ts — batasi PEMANGGIL, bukan cuma alamat tujuan.
// Cooldown 60 detik per email tetap dipertahankan (itu sudah benar); yang baru
// adalah batas per-IP, yang menahan satu penyerang menggilir banyak alamat
// sekaligus dan menahan penguncian login satu korban.
const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
if (await overLimit('request-code', ip, 5)) {
  return NextResponse.json({ error: 'too-many-requests' }, { status: 429 });
}
```

Tambahan yang menutup skenario penguncian sepenuhnya: simpan penghitung regenerasi di dokumen kodenya, supaya satu alamat tidak bisa dipaksa memutar kode tanpa henti.

```ts
// lib/loginCode.ts
/** Regenerasi maksimum dalam satu jendela TTL. Menahan penyerang memutar kode
 *  korban terus-menerus sehingga yang sedang diketik selalu keburu kedaluwarsa. */
export const MAX_RESENDS = 5;

export function resendExhausted(stored: (StoredCode & { resends?: number }) | null, now: number): boolean {
  if (!stored || now - stored.createdAt > CODE_TTL_MS) return false; // jendela baru
  return (stored.resends ?? 0) >= MAX_RESENDS;
}
```

```ts
// app/api/auth/request-code/route.ts
if (resendExhausted(stored, Date.now())) {
  // Balasannya tetap ok:true — jangan bocorkan bahwa email ini sedang diserang.
  return NextResponse.json({ ok: true });
}
await ref.set({
  hash: hashCode(code, normalized),
  createdAt: Date.now(),
  attempts: 0,
  resends: (stored?.resends ?? 0) + 1,
});
```

Dan tutup koleksinya di rules, sama seperti `loginCodes`:

```
match /rateLimits/{id} { allow read, write: if false; }
```

---

### ✅ S-11 · MEDIUM · Jejak persetujuan Perjanjian Pengelola bisa dipalsukan oleh yang menyetujuinya — **SUDAH DIPERBAIKI** (`ee7f76b`)

> **Yang dikerjakan**, sesuai usulan di bawah: `app/api/role-request/route.ts` jadi satu-satunya pintu tulis, `uid` diambil dari ID token, `landRights` dikunci ke `LAND_RIGHTS`, isinya divalidasi `validateRoleRequest()` yang sama dengan formulir, dan `agreementVersion` ditulis dari `AGREEMENT` di server. Cabang `invited` → `pending` dihapus dari `firestore.rules`; `verification` kini tertutup total dari klien.
>
> Ditambah satu yang tidak ada di usulan awal: **`lib/roleRequest.check.ts`**, penjaga regresi mengikuti pola `destinationKeys.check.ts`. Alasannya — mengembalikan celah lama tidak membuat apa pun gagal saat build: halaman pengajuan tetap jalan, tes lain tetap hijau, dan yang berubah cuma jaminan yang tidak terlihat di layar mana pun. Penjaganya diuji dengan benar-benar mengembalikan celahnya (cek merah), lalu memulihkannya (hijau).
>
> **⚠️ Urutan deploy penting.** Naikkan **kode aplikasi dulu**, baru `firestore.rules`. Kalau rules naik duluan, browser yang masih memegang JS lama akan mencoba `updateDoc` langsung ke `verification` dan kena `permission-denied` — pengaju yang sedang mengisi formulir melihat kegagalan yang tidak perlu terjadi.
>
> ```bash
> git push                                   # Vercel membangun & menaikkan kode
> # tunggu deploy selesai, lalu:
> firebase deploy --only firestore:rules
> ```

---

#### Analisis lengkap (untuk rujukan)

**File:** `lib/firestore.ts:389-415`, `components/cameras/VerificationForm.tsx:59-73`, `firestore.rules:39-42`

Rules-nya sendiri yang menyebut lubang ini, terus terang:

> *"Yang dijaga di sini KAPAN boleh menulis, bukan APA yang ditulis: isi formulirnya (nama, instansi, versi perjanjian) tetap datang dari klien dan dipercaya apa adanya."* — `firestore.rules:39-42`

`submitRoleRequest()` menulis **seluruh objek `verification`** langsung dari browser:

```ts
// lib/firestore.ts:405-414
await updateDoc(doc(db, "users", uid), {
  verification: {
    ...data,                                  // ← seluruhnya dari klien
    status: "pending",
    submittedAt: serverTimestamp(),
    ...(data.agreementVersion && { agreedAt: serverTimestamp() }),
  },
});
```

Rules hanya memvalidasi **perpindahan status** `invited` → `pending` (`:58-61`). Tidak ada satu pun `.validate` atas isinya.

**Risiko.** Pemegang tiket `invited` bisa memanggil SDK dari console browser dan menulis `verification` apa saja: `fullName`, `organization`, `landRights` di luar daftar `LAND_RIGHTS`, `declaredRights: true` tanpa pernah mencentang apa pun, dan `agreementVersion` berisi versi yang **tidak pernah terbit**.

Yang membuat ini lebih dari sekadar data kotor: `agreedAt` distempel `serverTimestamp()` — **waktunya otoritatif, isinya tidak**. Hasilnya catatan yang *tampak* tepercaya ("disetujui v1.0 pada 14 Agustus 2026 pukul 22:51 menurut server") padahal versi yang disebut dikarang oleh orang yang menyetujuinya. Untuk platform yang punya halaman `/syarat-pengelola` dan menjadikan **Pasal 3 Perjanjian Pengelola** sebagai dasar kolom mana yang boleh disunting pengelola (`firestore.rules:145-150`), jejak siapa-menyetujui-versi-berapa adalah dokumen yang harus bisa dipegang. Sekarang tidak bisa.

Dampak kedua: `declaredRights` disimpan justru **karena Pasal 2 ayat 4 memakainya sebagai dasar pencabutan** (komentar `VerificationForm.tsx:70-71`). Dasar pencabutan yang bisa ditulis sendiri oleh pihak yang akan dicabut bukan dasar apa pun.

Belum Critical/High karena tiketnya tetap harus dibuka admin lebih dulu, dan persetujuan akhir tetap di tangan manusia — jadi tidak ada eskalasi peran otomatis. Tapi admin menyetujui **berdasarkan isi formulir ini**, dan isi itu tidak terverifikasi.

**Perbaikan.** Persis yang disarankan komentar rules-nya: pindahkan pengiriman ke route server dengan Admin SDK, dan validasi versi perjanjian terhadap konstanta di server.

```ts
// app/api/role-request/route.ts — BARU
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { AGREEMENT, LAND_RIGHTS, validateRoleRequest } from '@/lib/verification';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; }
  catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  // Gerbang yang sama dengan rules, tapi sekarang isinya ikut dijaga.
  const ref = adminDb().doc(`users/${uid}`);
  const cur = (await ref.get()).data();
  if (cur?.verification?.status !== 'invited') {
    return NextResponse.json({ error: 'not-invited' }, { status: 403 });
  }

  // Validasi yang SAMA dengan yang dipakai form — satu sumber, dua tempat pakai.
  const invalid = validateRoleRequest({ ...body, agreed: true });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  // landRights harus dari daftar resmi, bukan teks bebas.
  if (!LAND_RIGHTS.includes(body.landRights)) {
    return NextResponse.json({ error: 'bad-land-rights' }, { status: 400 });
  }

  await ref.update({
    verification: {
      fullName: String(body.fullName).trim().slice(0, 120),
      phone: String(body.phone).trim().slice(0, 32),
      organization: String(body.organization).trim().slice(0, 160),
      destination: String(body.destination ?? '').trim().slice(0, 120),
      destinationLocation: String(body.destinationLocation ?? '').trim().slice(0, 120),
      destinationDescription: String(body.destinationDescription ?? '').trim().slice(0, 1000),
      landRights: body.landRights,
      declaredRights: true,
      // Versi datang dari SERVER, bukan dari body. Inilah inti perbaikannya:
      // yang tercatat selalu versi yang benar-benar berlaku saat dikirim.
      agreementVersion: AGREEMENT.pengelola.version,
      status: 'pending',
      submittedAt: FieldValue.serverTimestamp(),
      agreedAt: FieldValue.serverTimestamp(),
    },
  });

  return NextResponse.json({ ok: true });
}
```

Lalu tutup jalur klien di rules — cabang `invited` → `pending` tidak diperlukan lagi begitu penulisannya lewat Admin SDK:

```
// firestore.rules — cabang kedua dihapus; sisakan HANYA update biasa.
allow update: if request.auth != null
  && (
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
    || (
      request.auth.uid == userId
      && request.resource.data.role == resource.data.role
      // verification sekarang HANYA ditulis /api/role-request (Admin SDK).
      && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['verification'])
    )
  );
```

Dan `submitRoleRequest` di `lib/firestore.ts` jadi pemanggil route, seperti `bookingAction()` yang polanya sudah ada di file yang sama (`:772-783`).

---

### 🟢 S-12 · LOW · XSS & injection: bersih, dengan satu catatan

Diperiksa dan **tidak ditemukan masalah**:

- Nol `dangerouslySetInnerHTML` dari data pengguna. Tiga yang ada di `app/layout.tsx:56,64,71` semuanya **string literal statis** (tema, lang, service worker) — tidak ada interpolasi variabel sama sekali. Aman.
- Nol `eval()`, nol `new Function()`, nol `innerHTML`.
- React meng-escape seluruh interpolasi teks secara default; deskripsi/ulasan/nama pengelola dirender sebagai teks, bukan HTML.
- Input IoT tidak punya endpoint HTTP di aplikasi ini — firmware menulis langsung ke RTDB (lihat S-04 untuk validasinya).
- `sanitizeStationId()` (`lib/realtime.ts:24`) membuang karakter yang berbahaya untuk path RTDB (`. # $ / [ ] &`). Benar.
- `parseTicketId()` (`ScanPanel.tsx:47`) mewajibkan 20 karakter alfanumerik — QR palsu tidak bisa membelokkan path.

**Catatan (Low).** URL gambar dari pengelola (`PengelolaDestinasiPanel.tsx:364,494`; `DestinasiPanel.tsx`) dipakai apa adanya di `<img src>`. Bukan XSS — `javascript:` di `src` gambar tidak dieksekusi browser modern — tapi tetap: setiap pengunjung halaman destinasi menembak host yang diketik pengelola, membocorkan IP mereka ke pihak itu. CSP `img-src https:` (lihat S-05) sudah cukup menutup sisi terburuknya. Kalau mau rapat, validasi skema saat simpan:

```ts
// lib/format.ts
export function safeImageUrl(u: string): string {
  const s = u.trim();
  return /^https:\/\//i.test(s) ? s : '';
}
```

### 🟢 S-13 · LOW · Error server dilog utuh

**File:** `app/api/chat/route.ts:171,191` dkk.

```ts
console.error('[chat] gemini', res.status, await res.text().catch(() => ''));
```

Semua `console.error` berada di route server (log Vercel, tidak sampai ke browser) dan pesan yang dikembalikan ke klien sudah berupa kode pendek (`'upstream-error'`, `'send-failed'`) — **tidak ada stack trace yang bocor ke pengguna**. Itu sudah benar.

Yang perlu diingat: balasan mentah Gemini dan objek error `firebase-admin` bisa memuat fragmen kredensial atau data pengguna di log. Batasi panjangnya dan jangan log objek error utuh untuk jalur yang menyentuh email:

```ts
console.error('[chat] gemini', res.status, (await res.text().catch(() => '')).slice(0, 300));
```

---

## §2 FIREBASE-SPECIFIC

---

### ✅ F-01 · PASS · Realtime listener: nol kebocoran

Ak periksa **setiap** `onSnapshot`/`onValue`/`setInterval` di `app/` dan `components/`. Semuanya punya cleanup yang benar:

| Lokasi | Cleanup |
|---|---|
| `app/destinations/[id]/page.tsx:82,95,103` | `return () => unsub()` / `return subscribe…` ✅ |
| `app/monitoring/page.tsx:57,158` | `useEffect(() => subscribeX(setY), [])` — mengembalikan unsub ✅ |
| `app/monitoring/page.tsx:71-82` | array `unsubs`, `return () => unsubs.forEach(u => u())` ✅ |
| `components/destinations/LiveMonitorPanel.tsx:462-473` | idem, seluruh id tercakup ✅ |
| `LiveMonitorPanel.tsx:232,240` | `return subscribeMonitoring(...)` / `clearInterval` ✅ |
| `components/booking/BookingHistory.tsx:63-69` | ✅ |
| `components/dashboard/PengelolaDestinasiPanel.tsx:82-87` | ✅ |
| `components/chat/ChatWidget.tsx:77-78` | `removeEventListener` ✅ |
| `lib/useAuth.ts:20-25,47-53` | ✅ |

Pola `idsKey = ids.join(',')` di `LiveMonitorPanel.tsx:451` dan `monitoring/page.tsx:61` juga tepat — mencegah langganan ulang ke seluruh kamera tiap render karena array literal baru. Ini detail yang sering terlewat.

---

### 🟡 F-02 · MEDIUM · Konfigurasi indeks Firestore tidak dikelola sama sekali

**File:** `firebase.json` — tidak ada `firestore.indexes.json`

Tidak ada satu pun indeks yang tercatat di repo. Akibatnya setiap indeks komposit yang pernah dibuat hanya hidup di Console, dan **beberapa keputusan desain query dibuat justru untuk menghindarinya** — keputusan itu sekarang jadi utang yang tidak tercatat di mana pun kecuali komentar:

```ts
// app/api/bookings/route.ts:117-125
// Rentang (`date >= x && date <= y` bersama dua filter kesamaan) menuntut composite
// index yang belum ada sama sekali di koleksi ini …
// ponytail: konsekuensinya seluruh booking berbayar destinasi ini terbaca,
// bukan cuma tanggal yang diminta.
```

```ts
// lib/firestore.ts:167-171
// Diurutkan di klien, bukan lewat orderBy: pasangan where+orderBy menuntut
// indeks komposit yang harus dibuat manual di Console …
```

**Risiko.** Bukan keamanan — **biaya dan skala**. Query di `route.ts:126-130` membaca **seluruh** booking berbayar sebuah destinasi setiap kali halaman booking dibuka. Aman di puluhan–ratusan booking (dan komentarnya jujur soal itu), tapi tidak ada apa pun yang akan memberi tahu saat ambangnya lewat: tidak ada indeks, tidak ada alarm, biayanya naik diam-diam.

**Perbaikan.** Turunkan konfigurasi indeks ke repo supaya bisa di-deploy dan di-review:

```json
// firestore.indexes.json — BARU
{
  "indexes": [
    {
      "collectionGroup": "bookings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "destinationId", "order": "ASCENDING" },
        { "fieldPath": "paymentStatus", "order": "ASCENDING" },
        { "fieldPath": "date",          "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "destinations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "parentId", "order": "ASCENDING" },
        { "fieldPath": "name",     "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

```json
// firebase.json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "database": { "rules": "database.rules.json" }
}
```

Dengan indeks pertama terpasang, `route.ts` bisa kembali ke filter rentang dan berhenti membaca seluruh riwayat destinasi:

```ts
const semua = await adminDb()
  .collection('bookings')
  .where('destinationId', '==', destinationId)
  .where('paymentStatus', '==', 'paid')
  .where('date', '>=', isoDate())                    // hari ini
  .where('date', '<=', nextDays(14).at(-1)!)         // 14 hari ke depan
  .get();
```

---

### 🟡 F-03 · MEDIUM · `subscribeDestinations()` melanggan seluruh koleksi, berkali-kali

**File:** `lib/firestore.ts:140-148`, dipanggil di `monitoring/page.tsx:57`, `PengelolaDestinasiPanel.tsx:82`, `HeroSensorLinks.tsx`, `DestinasiPanel.tsx`

```ts
export function subscribeDestinations(callback: (destinations: Destination[]) => void) {
  if (!db) return () => {};
  const ref = collection(db, "destinations");
  return onSnapshot(ref, (snap) => { ... });   // ← tanpa limit, tanpa filter
}
```

**Risiko.** Tiap komponen yang memanggilnya membuka langganan **koleksi penuh** sendiri. `PengelolaDestinasiPanel` bahkan menyaring hasilnya di klien (`:83`) — jadi pengelola dengan 2 destinasi tetap membayar pembacaan seluruh katalog, dan **setiap perubahan destinasi milik siapa pun** memicu ulang snapshot untuk semua orang yang sedang membuka panel. Firestore menagih per dokumen terbaca, per snapshot.

**Perbaikan.** Untuk panel pengelola, gerbangnya sudah ada di data — pakai:

```ts
// lib/firestore.ts
/** Destinasi kelolaan satu pengelola. Query berfilter, bukan koleksi penuh
 *  yang disaring di klien: pengelola dengan 2 destinasi tidak perlu membayar
 *  pembacaan seluruh katalog tiap kali ada yang menyunting destinasi lain. */
export function subscribeManagedDestinations(
  uid: string,
  callback: (destinations: Destination[]) => void
) {
  if (!db) return () => {};
  const q = query(collection(db, "destinations"), where("managerUid", "==", uid));
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Destination)))
  );
}
```

```ts
// components/dashboard/PengelolaDestinasiPanel.tsx:82
const unsub = subscribeManagedDestinations(uid, (mine) => {
  setDestinations(mine);
  setLoaded(true);
});
```

Untuk beranda/monitoring yang memang butuh semuanya, katalog destinasi **jarang berubah** — `getDocs` sekali + revalidate jauh lebih murah daripada langganan realtime seumur halaman:

```ts
// Beranda tidak butuh realtime: destinasi berubah beberapa kali sebulan, bukan
// beberapa kali semenit. onSnapshot di sini membayar langganan seumur tab.
const destinations = await getDestinations();
```

---

### 🟢 F-04 · LOW · `fetchRatingSummaries()` membaca seluruh koleksi `reviews`

**File:** `lib/firestore.ts:913-925`

```ts
// ponytail: baca semua ulasan sekali jalan; denormalisasi ke dokumen destinasi kalau ulasan sudah ribuan.
export async function fetchRatingSummaries(): Promise<Record<string, RatingSummary>> {
  if (!db) return {};
  const snap = await getDocs(collection(db, "reviews"));
```

Sudah ditandai sadar, dan benar untuk skala sekarang. Ambang yang perlu diawasi: **~1.000 ulasan**, karena ini dipanggil tiap kali beranda dimuat oleh setiap pengunjung. Jalur naiknya: simpan `ratingSum` + `ratingCount` di dokumen destinasi, di-update oleh route server saat ulasan ditulis (koleksi `reviews` sekarang masih ditulis langsung dari klien, jadi ini butuh pemindahan ke server dulu).

### 🟢 F-05 · LOW · Cloud Functions

Tidak dipakai. Semua logika server ada di Next.js route handler dengan Admin SDK — pilihan yang sah dan justru menyederhanakan deployment. Tidak ada temuan.

---

## §3 PERFORMANCE

---

### 🟠 P-01 · HIGH (dampak SEO+perf) · Halaman destinasi 100% client-rendered

**File:** `app/destinations/[id]/page.tsx:1` — `'use client'`

Halaman yang paling penting untuk konversi OTA — halaman detail destinasi — adalah **komponen klien penuh**. Datanya baru diambil setelah JS terunduh dan hidrasi selesai (`onSnapshot` di `:82`).

**Risiko.**

- **HTML awal kosong.** Crawler dan preview link (WhatsApp, Instagram, Twitter) menerima kerangka tanpa nama destinasi, tanpa harga, tanpa gambar.
- **LCP buruk di 3G.** Pengguna di lokasi wisata pesisir — persis target aplikasi ini — menunggu bundle + Firestore round-trip sebelum melihat apa pun.
- **Tidak bisa `generateMetadata`.** File `'use client'` tidak boleh mengekspornya. Ini akar penyebab T-01 di §5.

**Perbaikan.** Bungkus: server component untuk data + metadata, client component untuk bagian interaktif (langganan realtime kamera & sensor).

```tsx
// app/destinations/[id]/page.tsx — jadi SERVER component
import { cache } from 'react';
import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import DestinationClient from './DestinationClient';

export const revalidate = 300; // ISR: katalog jarang berubah

// cache(): generateMetadata dan Page sama-sama memanggilnya dalam satu request.
// Tanpa ini, tiap kunjungan halaman destinasi membayar DUA pembacaan Firestore
// untuk dokumen yang sama persis.
const getDest = cache(async (id: string) => {
  const snap = await adminDb().doc(`destinations/${id}`).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
});

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const d = await getDest(params.id);
  if (!d) return { title: 'Destinasi tidak ditemukan — Nusa' };
  return {
    title: `${d.name} — Nusa`,
    description: (d.description ?? '').slice(0, 155),
    openGraph: {
      title: `${d.name} · ${d.location}`,
      description: (d.description ?? '').slice(0, 155),
      images: d.image ? [{ url: d.image, width: 1200, height: 630 }] : [],
      type: 'website',
    },
  };
}

export default async function Page({ params }: { params: { id: string } }) {
  const dest = await getDest(params.id);
  // Data awal dikirim dari server (HTML terisi, LCP cepat); komponen klien
  // di bawah tetap berlangganan realtime untuk kamera & sensor.
  return <DestinationClient initial={dest} id={params.id} />;
}
```

Isi `page.tsx` yang sekarang dipindah apa adanya ke `DestinationClient.tsx`, dengan `useState(initial)` sebagai nilai awal alih-alih `null`.

---

### 🟡 P-02 · MEDIUM · Nol `next/image` — 17 `<img>` mentah dengan lint di-suppress

**File:** 17 lokasi, di antaranya `app/destinations/[id]/page.tsx:245,381,502`, `components/desktop/HeroBanner.tsx:45`, `components/mobile/DestinationCard.tsx:71`, `components/desktop/DesktopDestinationCard.tsx:196`

```tsx
// eslint-disable-next-line @next/next/no-img-element
<img src={dest.image} alt={dest.name} ... />
```

Peringatan lint-nya di-suppress di 9 tempat. Akibatnya foto Bunaken/Likupang dkk. dikirim **pada resolusi aslinya** — foto kamera 4000×3000 (3–5 MB) diunduh utuh lalu diperkecil CSS jadi thumbnail 40×40 di `booking/page.tsx:321`.

Yang **sudah benar** (dan patut dipertahankan): `loading="lazy"` + `decoding="async"` sudah dipasang di 9 tempat. Yang kurang justru resizing dan format modern.

**Kenapa belum dipakai:** URL gambar datang dari host sembarang yang diketik pengelola, dan `next/image` menuntut host itu terdaftar. Itu masalah yang bisa diselesaikan:

```js
// next.config.mjs
const nextConfig = {
  images: {
    // Pengelola menempel URL dari host mana saja. remotePatterns dengan hostname
    // '**' menerima semuanya TAPI tetap lewat optimizer Next — jadi yang sampai
    // ke browser sudah diperkecil & di-AVIF/WebP, bukan JPEG 4 MB asli.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/avif', 'image/webp'],
    // Batas kasar supaya optimizer tidak dipakai memproses gambar raksasa.
    minimumCacheTTL: 86400,
  },
};
```

```tsx
// components/mobile/DestinationCard.tsx
import Image from 'next/image';

<Image
  src={image}
  alt={name}
  fill                                  // induknya sudah `relative`
  sizes="(max-width: 768px) 100vw, 33vw"
  className="object-cover"
/>
```

Untuk thumbnail kecil, `width`/`height` eksplisit lebih tepat:

```tsx
// app/booking/page.tsx:321
<Image src={destination.image} alt={destination.name} width={40} height={40}
       className="h-10 w-10 rounded-sm object-cover shrink-0" />
```

> **Kecualikan siaran MJPEG.** `LiveMonitorPanel.tsx:79` dan `CameraLiveModal.tsx:67` **harus tetap `<img>` mentah** — MJPEG adalah stream tak berujung, dan `next/image` akan mencoba mengoptimalkannya lalu menggantung. Ganti komentar suppress-nya jadi alasan itu, bukan dibiarkan generik.

---

### 🟡 P-03 · MEDIUM · Tidak ada code splitting; `firebase` masuk bundle awal setiap halaman

**File:** seluruh `app/**/page.tsx` kecuali `beranda`, `page.tsx`, `syarat-pengelola`

Enam dari sembilan halaman ditandai `'use client'` di baris pertama, dan hampir semuanya mengimpor `@/lib/firestore` yang menarik `firebase/firestore` + `firebase/auth` + `firebase/database`. Satu-satunya lazy import di seluruh codebase:

```ts
// components/dashboard/ScanPanel.tsx:143 — ini sudah benar
const { Html5Qrcode } = await import('html5-qrcode');
```

`html5-qrcode` sudah di-lazy (bagus — hanya dipakai petugas), tapi `qrcode.react`, seluruh panel dashboard, dan `ChatWidget` ikut ke bundle awal. `ChatWidget` khususnya dimuat di **`app/layout.tsx:66`** — artinya di **setiap halaman**, termasuk yang tidak pernah dibuka chat-nya.

**Perbaikan.**

```tsx
// app/layout.tsx — chat dimuat setelah halaman interaktif, bukan sebelum
import dynamic from 'next/dynamic';

const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), {
  ssr: false,   // widget mengambang, tidak perlu ikut HTML awal
});
```

```tsx
// app/dashboard/page.tsx — panel dimuat saat tab-nya dibuka, bukan sekaligus
const DestinasiPanel = dynamic(() => import('@/components/dashboard/DestinasiPanel'));
const ScanPanel      = dynamic(() => import('@/components/dashboard/ScanPanel'));
const KameraPanel    = dynamic(() => import('@/components/dashboard/KameraPanel'));
```

```tsx
// components/booking/TicketModal.tsx — QR hanya perlu saat modal tiket dibuka
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });
```

Ukur dulu supaya tahu mana yang benar-benar berat:

```bash
ANALYZE=true npm run build   # setelah memasang @next/bundle-analyzer
```

---

### 🟡 P-04 · MEDIUM · Sensor IoT me-render ulang seluruh panel tiap detik

**File:** `components/destinations/LiveMonitorPanel.tsx:238-245`

```ts
useEffect(() => {
  if (!sensorPath) return;
  const t = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(t);
}, [sensorPath]);

const ageSec = data?.updatedAt ? Math.max(0, Math.round((now - data.updatedAt) / 1000)) : null;
return { data, ready, ageSec, isLive: ageSec !== null && ageSec < 15 };
```

`setNow` setiap detik, **selamanya**, selama panel terpasang. Tiap tick me-render ulang `LiveMonitorPanel` beserta `SensorGrid` (6 kartu, masing-masing dengan SVG inline) dan `GpsCard`. Di halaman Monitoring dengan beberapa stasiun, tiap stasiun punya interval sendiri.

Detaknya **memang perlu** — tanpanya stasiun mati akan bertuliskan "Live" selamanya (alasannya benar, ditulis di `:219-221`). Yang tidak perlu adalah presisi satu detik untuk teks yang setelah semenit pertama hanya berubah tiap menit.

**Perbaikan.** Kendurkan detak begitu datanya sudah tua, dan hentikan saat tab tidak terlihat:

```ts
useEffect(() => {
  if (!sensorPath) return;
  let t: ReturnType<typeof setInterval>;

  const start = () => {
    // 1 dtk selama data masih segar (label "Live"/"x dtk lalu" berubah tiap detik);
    // 30 dtk setelah lewat semenit — teksnya sendiri sudah dalam satuan menit.
    const segar = data?.updatedAt && Date.now() - data.updatedAt < 60_000;
    t = setInterval(() => setNow(Date.now()), segar ? 1000 : 30_000);
  };

  // Tab di latar belakang tidak perlu detak sama sekali.
  const onVis = () => { clearInterval(t); if (!document.hidden) { setNow(Date.now()); start(); } };

  start();
  document.addEventListener('visibilitychange', onVis);
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
}, [sensorPath, data?.updatedAt]);
```

Sekalian bungkus `SensorGrid` supaya tick yang tidak mengubah datanya tidak menyentuhnya:

```tsx
// components/destinations/LiveMonitorPanel.tsx
export const SensorGrid = memo(function SensorGrid({ data, ready, isLive, cols }: Props) {
  ...
});
```

---

### 🟢 P-05 · LOW · Loading state data realtime: sudah baik

Layak dicatat sebagai yang **sudah benar**, karena ini bagian yang paling sering diabaikan:

- `CameraFeed` (`LiveMonitorPanel.tsx:42-109`) membedakan **empat** keadaan: alamat server masih dimuat (`src === null` → skeleton), belum diatur (`''`), gagal (`error`), dan tersambung tapi belum ada frame (`!loaded` → spinner "Menghubungkan ke kamera…"). Status `Live` hanya muncul kalau frame benar-benar masuk (`:61`) — koneksi terbuka tanpa frame tidak dihitung live. Ini presisi yang tepat.
- `SensorGrid` (`:340`) membedakan `connecting` / `Live` / `Offline`, bukan cuma ada/tidak ada data.
- `fmt()` (`:24`) memulangkan `'--'` untuk nilai hilang, bukan `NaN`.
- `useMonitorGroups().settled` (`monitoring/page.tsx:90`) menunggu **semua** kamera dijawab rules sebelum menampilkan empty state — tanpa itu halaman akan mengedipkan "kamu belum punya kamera" ke orang yang justru punya.

Satu yang kurang: **string hardcoded** `'Menghubungkan ke kamera…'` di `:90` melewati i18n, padahal seluruh komponen lain memakai `t()`. Pindahkan ke `lib/i18n.ts` sebagai `monitor.connectingCamera`.

---

## §4 CODE QUALITY & MAINTAINABILITY

---

### ✅ Q-01 · PASS · TypeScript, penamaan, dan struktur

Ini bagian terkuat dari codebase ini.

- **Nol `any`, nol `as any`, nol `@ts-ignore`, nol `@ts-nocheck`.** Satu-satunya `eslint-disable` yang ada (9 buah) semuanya `@next/next/no-img-element` — terkait P-02, bukan penekanan tipe.
- `strict` aktif di `tsconfig.json`; nilai yang bentuknya memang tidak diketahui dipakai `unknown` dengan penyempitan eksplisit (`checkedInLabel` di `ScanPanel.tsx:59`, `body: Record<string, unknown>` di route booking) — ini penggunaan `unknown` yang benar, bukan `any` yang disamarkan.
- Struktur folder konsisten: `app/` (rute), `components/<domain>/`, `lib/` (logika murni + integrasi). Pemisahan `lib/destination.ts` (tanpa import, bisa dijalankan `node` polos) dari `lib/firestore.ts` (menarik SDK) adalah keputusan arsitektur yang bagus — itulah yang membuat route server bisa memakai rumus harga yang **persis sama** dengan UI tanpa menyeret SDK klien.
- Ada **8 file `.check.ts`** (`destination.check.ts` 331 baris, `verification.check.ts`, `format.check.ts`, `loginCode.check.ts`, …) — self-test berbasis assert yang jalan tanpa framework. Persis pola yang tepat untuk proyek sebesar ini.
- Duplikasi logika ditangani sadar: komentar di `firestore.ts:105-112` dan `destination.ts:136-142` menjelaskan kenapa rumus dipusatkan, dengan menyebut bug nyata yang pernah terjadi karena dua salinan.

Kualitas komentarnya di atas rata-rata: menjelaskan **kenapa**, sering menyebut bug yang pernah terjadi dan apa yang rusak kalau baris itu dihapus. Pertahankan.

---

### 🟡 Q-02 · MEDIUM · Tidak ada satu pun error boundary atau fallback UI

**File:** tidak ada `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, maupun `app/loading.tsx`

Seluruh aplikasi berjalan tanpa jaring pengaman React. Satu exception yang tidak tertangkap di komponen mana pun → **layar putih** dengan "Application error: a client-side exception has occurred".

Bahwa ini nyata sudah dibuktikan sendiri oleh codebase-nya: `stopScanner()` di `ScanPanel.tsx:20-30` ada **persis** karena `html5-qrcode` melempar sinkron dari cleanup dan menjatuhkan seluruh halaman. Perbaikannya benar, tapi menutup satu lubang; boundary menutup kelasnya.

Yang paling rentan: `dateLabel()` di `ScanPanel.tsx:54` dan `booking/page.tsx:268` memanggil `new Date(date).toLocaleDateString(...)` atas data dokumen — satu dokumen booking dengan `date` rusak, dan halaman petugas mati di dermaga.

**Perbaikan.**

```tsx
// app/error.tsx — BARU
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-shore-50 px-6 text-center">
      <h1 className="font-serif text-2xl font-medium text-navy">Ada yang tidak beres</h1>
      <p className="max-w-sm text-sm leading-relaxed text-navy-soft">
        Halaman ini gagal dimuat. Koneksi di lokasi wisata sering putus-putus —
        coba muat ulang dulu.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn-primary px-5 py-2.5 text-sm">Coba lagi</button>
        <a href="/beranda" className="btn-ghost px-5 py-2.5 text-sm">Ke beranda</a>
      </div>
      {error.digest && (
        <p className="text-2xs text-navy-soft">Kode: {error.digest}</p>
      )}
    </main>
  );
}
```

```tsx
// app/not-found.tsx — BARU
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-shore-50 px-6 text-center">
      <h1 className="font-serif text-2xl font-medium text-navy">Halaman tidak ditemukan</h1>
      <a href="/beranda" className="btn-primary px-5 py-2.5 text-sm">Ke beranda</a>
    </main>
  );
}
```

Tambahkan juga `app/global-error.tsx` (menangkap error di `layout.tsx` sendiri) dan `app/dashboard/error.tsx` khusus, supaya kegagalan satu panel tidak menjatuhkan seluruh dashboard petugas.

---

### 🟡 Q-03 · MEDIUM · `guests` tidak pernah dicocokkan dengan jumlah item

**File:** `app/api/bookings/route.ts:220-223`, `app/booking/page.tsx:436-445`

```ts
const guests = Math.floor(Number(body.guests));
if (!Number.isFinite(guests) || guests < 1 || guests > MAX_GUESTS) {
  return bad('bad-guests', 400);
}
```

`guests` divalidasi rentangnya, lalu disimpan — tapi **tidak pernah dipakai dalam perhitungan apa pun**. Tagihan datang murni dari `qty` per item. Artinya booking dengan `guests: 50` dan `qty: { tiket: 1 }` valid: 50 orang datang membawa 1 tiket, dan `BookingCard` di `ScanPanel.tsx:83` memajang "50 orang" ke petugas yang lalu meloloskan mereka.

Ini bukan lubang harga (harganya benar untuk 1 tiket), tapi **kebingungan operasional di gerbang** — petugas melihat angka yang tidak ada hubungannya dengan yang dibayar.

**Perbaikan.** Salah satu dari dua, pilih yang sesuai model bisnisnya:

```ts
// A) guests harus konsisten dengan item ber-unit /pax
const perPax = items.filter((l) => {
  const it = getPriceItems(dest).find((p) => p.id === l.id);
  return /pax|orang|person/i.test(it?.unit ?? '');
});
const kursi = perPax.reduce((s, l) => s + l.qty, 0);
if (perPax.length > 0 && kursi !== guests) return bad('guests-mismatch', 400);
```

```ts
// B) buang `guests` sama sekali — turunkan dari item saat menampilkan.
//    Lebih sederhana, dan menghapus satu field yang tidak punya arti.
```

Opsi B lebih sejalan dengan arah codebase ini (satu sumber kebenaran). Kalau dipilih, `booking/page.tsx:434-446` ikut hilang dan formulirnya jadi satu langkah lebih pendek.

---

### 🟢 Q-04 · LOW · `approveRoleRequest` membaca di luar batch

**File:** `lib/firestore.ts:466-472`

```ts
// ponytail: pencarian nama kembar dibaca di luar batch, jadi dua admin yang
// menyetujui dua pengaju bernama destinasi sama pada detik yang sama
// sama-sama melihat "belum ada" dan membuat dua dokumen.
const snap = await getDocs(collection(db, "destinations"));
```

Sudah ditandai sadar dan penilaiannya benar (persetujuan itu tindakan manual yang jarang). Dua catatan tambahan yang belum disebut komentarnya: `getDocs` di sini juga membaca **seluruh** koleksi destinasi tiap kali tombol Setujui ditekan, dan operasi ini berjalan dari **klien** dengan hak admin. Kalau nanti dipindah, tempat yang tepat adalah route server dengan `runTransaction` — sekalian menutup keduanya.

### 🟢 Q-05 · LOW · Dead code & kerapian

- `parentOptions()` (`lib/destination.ts:114`) punya **dua blok JSDoc berurutan** (`:65-76` lalu `:77-87`) — yang pertama nyasar dari `descendantIds` saat refactor. Hapus salah satu.
- `Destination.hasMonitoring` dan `stationId` tidak ada di daftar `hasOnly()` rules pengelola (benar — itu milik admin), tapi `AUTO_DEST_DEFAULTS` (`firestore.ts:420-434`) menulis keduanya. Aman karena dibuat lewat cabang admin, tapi layak diberi komentar supaya tidak ada yang "merapikan" daftar itu kelak.
- `bookings.probe.mjs` dan `rules.probe.mjs` ada di root repo. Bagus bahwa keduanya ada dan dipertahankan — tapi pindahkan ke `scripts/` supaya root bersih, dan tambahkan ke `.vercelignore`.

---

## §5 ACCESSIBILITY & SEO

---

### 🟠 T-01 · HIGH · Nol Open Graph — setiap link destinasi yang dibagikan tampil identik

**File:** `app/layout.tsx:19-25`; metadata hanya ada di 2 dari 9 halaman

```ts
export const metadata: Metadata = {
  title: "Nusa — Dive Into Adventure",
  description: "Platform OTA untuk destinasi selam dan pesisir — …",
  appleWebApp: { capable: true, title: "Nusa", statusBarStyle: "default" },
};
// ← tidak ada openGraph, tidak ada twitter, tidak ada metadataBase
```

`grep -rn 'openGraph' app/` → **nol hasil di seluruh repo.** Hanya `app/layout.tsx` dan `app/syarat-pengelola/page.tsx` yang punya `metadata` sama sekali.

**Risiko — dan untuk OTA ini bukan temuan kosmetik.** Kanal distribusi utama produk wisata di Indonesia adalah WhatsApp dan Instagram. Saat pengelola atau calon pengunjung membagikan `nusa.app/destinations/<id>`, yang muncul di chat adalah:

> **Nusa — Dive Into Adventure**
> Platform OTA untuk destinasi selam dan pesisir — cari, pesan, dan pantau…

Tanpa nama destinasi, tanpa foto, tanpa harga. **Setiap** destinasi tampil sebagai kartu yang persis sama. Untuk platform yang hidup dari orang membagikan tautan tempat, ini kebocoran konversi langsung.

Diperparah P-01: halaman destinasi `'use client'`, jadi `generateMetadata` **tidak bisa** dipasang sebelum halamannya dipecah jadi server + client.

**Perbaikan — langkah 1: dasar di layout.**

```ts
// app/layout.tsx
export const metadata: Metadata = {
  // Wajib: tanpa ini URL relatif di openGraph.images tidak diresolusi.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Nusa — Dive Into Adventure',
    template: '%s — Nusa',        // halaman anak cukup menulis namanya sendiri
  },
  description: 'Platform OTA untuk destinasi selam dan pesisir — cari, pesan, dan pantau kondisi perairan secara langsung.',
  appleWebApp: { capable: true, title: 'Nusa', statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    siteName: 'Nusa',
    locale: 'id_ID',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};
```

**Langkah 2: per destinasi** — `generateMetadata` seperti di P-01, memakai `d.image` sebagai `openGraph.images`.

**Langkah 3: sitemap & robots** (keduanya belum ada sama sekali):

```ts
// app/sitemap.ts — BARU
import type { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nusa.app';
  const snap = await adminDb().collection('destinations').get();

  return [
    { url: `${base}/beranda`, priority: 1 },
    { url: `${base}/booking`, priority: 0.6 },
    ...snap.docs.map((d) => ({
      url: `${base}/destinations/${d.id}`,
      lastModified: d.data().updatedAt?.toDate?.() ?? new Date(),
      priority: 0.8,
    })),
  ];
}
```

```ts
// app/robots.ts — BARU
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nusa.app';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Halaman berakun tidak berguna di indeks dan membocorkan struktur internal.
      disallow: ['/dashboard', '/profile', '/monitoring', '/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

---

### ✅ T-02 · PASS · Alt text, `lang`, dan navigasi keyboard

Diperiksa satu per satu, hasilnya bagus:

- **Alt text lengkap.** Semua 17 `<img>` punya `alt`. Yang deskriptif memakai konteks nyata (`alt={`${dest.name} — foto ${i + 1}`}` di `destinations/[id]/page.tsx:384`, `alt="Perairan dangkal Pantai Liang, Bunaken"` di `HeroBanner.tsx:47`), dan yang dekoratif memakai `alt=""` dengan **benar** — pratinjau thumbnail di `PengelolaDestinasiPanel.tsx:506` dan `DestinasiPanel.tsx:450,647` memang tidak menambah informasi. Membedakan keduanya adalah tanda ini dikerjakan sadar, bukan diisi asal.
- **`<html lang="id">`** terpasang (`layout.tsx:37`), dan ada inline script (`:64`) yang menyelaraskan atribut `lang` dengan pilihan bahasa tersimpan **sebelum paint** — supaya pembaca layar tidak salah menyebut bahasa halaman. Detail yang jarang dipikirkan.
- **Navigasi keyboard aman.** `grep` untuk `onClick` pada `<div>`/`<span>`/`<li>` → semua interaksi memakai `<button>` atau `<a>` asli. Tidak ada div yang diklik-klik.
- **`aria-label` dipakai di 25 file**, terkonsentrasi tepat di tempat yang butuh: tombol ikon tanpa teks (`aria-label={`Hapus ${child.name}`}` di `PengelolaDestinasiPanel.tsx:279`), kontrol carousel (`LiveMonitorPanel.tsx:185,193,205` — lengkap dengan `aria-current`), dan setiap input di form pengelola (14 buah).
- `focus-visible:outline` dipasang eksplisit pada tombol carousel (`:186,194`) — fokus tidak dihilangkan diam-diam.

### 🟢 T-03 · LOW · Responsivitas & sisa aksesibilitas

Pola responsifnya konsisten dan benar: `min-h-dvh` (bukan `vh` — menghindari bug bilah alamat mobile), `pb-24 md:pb-0` untuk memberi ruang `BottomNav`, dan grid `lg:grid-cols-[minmax(0,1fr)_340px]` di `booking/page.tsx:308` dengan komentar yang menjelaskan **kenapa** `minmax(0,1fr)` bukan `1fr` — persis jebakan yang pernah membuat halaman bergeser ke samping.

Sisa yang layak dirapikan:

1. **Tidak ada skip-link.** `TopNav` + `BottomNav` berarti pengguna keyboard menelusuri seluruh navigasi tiap ganti halaman.

   ```tsx
   // app/layout.tsx, tepat setelah <body>
   <a href="#konten"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-navy">
     Lompat ke konten
   </a>
   ```
   Lalu beri `id="konten"` pada `<section>` utama tiap halaman.

2. **Modal tanpa focus trap.** `TicketModal`, `PaymentModal`, `CameraLiveModal` di-portal ke `<body>` (benar), tapi fokus tidak dikurung di dalamnya dan tidak dikembalikan saat ditutup. `ChatWidget.tsx:77` sudah menangani Escape — pola itu tinggal diseragamkan. Native `<dialog>` menyelesaikan semuanya tanpa dependency:

   ```tsx
   const ref = useRef<HTMLDialogElement>(null);
   useEffect(() => { open ? ref.current?.showModal() : ref.current?.close(); }, [open]);
   // <dialog> memberi focus trap, Escape, dan ::backdrop gratis dari browser.
   return <dialog ref={ref} onClose={onClose} className="…">{children}</dialog>;
   ```

3. **`confirm()` native** di `PengelolaDestinasiPanel.tsx:171` — memblokir, tidak bisa ditata, dan pengalamannya buruk di iOS PWA. Ganti dengan dialog konfirmasi in-app yang sudah ada polanya di modal lain.

4. **Kontras** belum diverifikasi terhadap WCAG AA. `text-navy-soft` dan `text-2xs` dipakai luas untuk teks pendukung; jalankan Lighthouse a11y untuk mengukurnya.

---

## 3. Prioritized Action List

Diurutkan dari yang paling mendesak. Kolom "Usaha" adalah perkiraan kasar untuk satu orang.

### 🔴 Segera — produksi terbuka

| # | Temuan | File | Usaha |
|---|---|---|---|
| ~~1~~ | ~~**S-04** deploy rules RTDB~~ — ✅ **selesai 15 Agu 2026**, terverifikasi | `database.rules.json` | — |
| 2 | **S-01** Pasang gateway pembayaran sungguhan + webhook bertanda tangan. Sampai itu jadi, pertimbangkan menutup tombol Bayar di produksi — sekarang setiap pengguna bisa menerbitkan tiket gratis dan menghabiskan kuota semua destinasi | `app/api/bookings/route.ts:292` | 2–3 hari |

### 🟠 Pekan ini

| # | Temuan | File | Usaha |
|---|---|---|---|
| 3 | **S-02** Rate limit + cooldown `/api/send-verification` — sekarang endpoint ini bisa mematikan seluruh login dengan menghabiskan kuota SMTP | `app/api/send-verification/route.ts` | 1 jam |
| 4 | **S-03** Rate limit `/api/chat` berbagi state (atau wajibkan akun) | `app/api/chat/route.ts:81` | 1–2 jam |
| 5 | **S-05** Security header via `next.config.mjs` (CSP `Report-Only` dulu) | `next.config.mjs` | 2 jam |
| 6 | **S-06** `settings/cameraServer` naikkan ke admin + validasi bentuk URL | `firestore.rules:310` | 15 menit |
| 7 | **S-04** Turunkan `database.rules.json` + `storage.rules` ke repo, daftarkan di `firebase.json` | `firebase.json` | 2 jam |
| 8 | **T-01** Open Graph + `metadataBase` + `sitemap.ts` + `robots.ts` | `app/layout.tsx`, baru | 2 jam |

### 🟡 Dua pekan ke depan

| # | Temuan | File | Usaha |
|---|---|---|---|
| 9 | **P-01 + T-01** Pecah halaman destinasi jadi server + client, pasang `generateMetadata` & ISR | `app/destinations/[id]/` | 1 hari |
| 10 | **Q-02** `error.tsx`, `global-error.tsx`, `not-found.tsx` | `app/` | 1 jam |
| 11 | **S-11** Pindahkan `submitRoleRequest` ke route server; `agreementVersion` dari konstanta server, bukan dari body | `app/api/role-request/` baru | 3 jam |
| 12 | **S-07** Pakai ulang `docId()` di `delete-user` & `notify-approval` | 2 route | 20 menit |
| 13 | **S-08** `npm i firebase-admin@latest`, buang `localtunnel`, pasang `npm audit --omit=dev` di CI | `package.json` | 1 jam |
| 14 | **S-09** `.vercelignore` + pindahkan service account keluar repo | baru | 15 menit |
| 15 | **S-10** `lib/rateLimit.ts` + batas per-IP di jalur auth + penghitung `resends` | `lib/rateLimit.ts` baru | 3 jam |
| 16 | **F-02** `firestore.indexes.json` + kembalikan filter rentang tanggal | `firebase.json` | 2 jam |
| 17 | **P-02** `next/image` + `remotePatterns` (kecualikan MJPEG) | `next.config.mjs` + 15 komponen | 4 jam |

### 🟢 Backlog

| # | Temuan | Usaha |
|---|---|---|
| 18 | **P-03** `next/dynamic` untuk `ChatWidget`, panel dashboard, `qrcode.react` | 2 jam |
| 19 | **F-03** `subscribeManagedDestinations()` untuk panel pengelola | 1 jam |
| 20 | **P-04** Kendurkan detak sensor + `memo(SensorGrid)` | 1 jam |
| 21 | **Q-03** Putuskan nasib `guests` (rekomendasi: buang) | 2 jam |
| 22 | **T-03** Skip-link, focus trap modal (`<dialog>` native), ganti `confirm()` | 3 jam |
| 23 | **S-03** Buang `whatsapp` dari katalog yang dikirim ke Gemini | 10 menit |
| 24 | **P-05** i18n untuk `'Menghubungkan ke kamera…'` | 5 menit |
| 25 | **S-05** Perbarui `.env.local.example:10` (contoh `http://` LAN menyesatkan sejak server pindah ke HTTPS) | 5 menit |
| 26 | **Q-05** Hapus JSDoc ganda `parentOptions`, pindahkan `*.probe.mjs` ke `scripts/` | 15 menit |

---

## 4. Catatan penutup

Tiga hal yang ak sengaja **tidak** ubah statusnya jadi temuan, supaya laporan ini tidak menggembungkan angka:

1. **RTDB terbaca publik** bukan kebocoran — itu perilaku produk yang konsisten dengan `monitoring_data` di Firestore dan dengan hero sensor di beranda. Yang jadi temuan adalah rules-nya tidak terlacak (S-04).
2. **`npm audit` "1 critical"** datang dari `localtunnel`, alat dev. Angka yang layak dipakai mengambil keputusan adalah `npm audit --omit=dev`.
3. **Komentar `ponytail:`** di seluruh codebase adalah utang yang **sudah ditandai sadar** dengan ambang dan jalur naik yang jelas. Ak masukkan ke laporan hanya kalau ambangnya sudah dekat atau kalau alasannya berubah karena temuan lain (mis. F-02, yang jadi relevan begitu indeks dikelola).

Tiga hal yang **diverifikasi terhadap sistem yang berjalan**, bukan disimpulkan dari kode saja:

- `git log --all --diff-filter=A` → service account & `.env` **tidak pernah** ter-commit (S-09).
- `curl` ke RTDB → baca publik terbuka, **tulis belum diuji** karena itu berarti menulis ke database produksi kalian (S-04).
- `settings/cameraServer.baseUrl` dibaca langsung → `https://…`, yang membuat rekomendasi CSP di S-05 dan regex di S-06 aman dipasang (dua perbaikan itu saling terkait; kalau alamatnya `http://`, keduanya akan mematikan siaran kamera).

Yang paling penting dari audit ini bukan panjang daftarnya. Fondasi keamanan aplikasi ini — rules, penulisan server-side, transaksi, validasi input — **sudah benar dan dibangun sengaja**. Yang tersisa hampir semuanya adalah **lapisan yang belum disentuh** (header, metadata, rules RTDB, rate limit) plus **satu placeholder yang terlanjur tayang** (S-01). Itu jauh lebih baik daripada sebaliknya: arsitektur yang salah tidak bisa ditambal, lapisan yang belum dipasang bisa.
