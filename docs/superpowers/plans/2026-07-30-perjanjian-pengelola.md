# Perjanjian Pengelola — Implementation Plan

> ⚠️ **SUDAH DIJALANKAN DAN SUDAH DILAMPAUI (30 Juli 2026).** Keempat task di
> bawah sudah selesai dan ter-commit, lalu cakupannya diperluas: Perjanjian Mitra
> ditambahkan, kamera diwajibkan dibeli & dipasang Lautara untuk mitra
> (dianjurkan-tidak-wajib untuk pengelola), dan `PENGELOLA_AGREEMENT_VERSION`
> diganti tabel `AGREEMENT` per role. **Potongan kode di dokumen ini tidak lagi
> mencerminkan kode yang berjalan** — dibiarkan apa adanya sebagai catatan
> langkah. Sumber kebenaran yang berlaku:
> `docs/superpowers/specs/2026-07-30-perjanjian-mitra-pengelola-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calon pengelola wajib membaca dan menyetujui Perjanjian Pengelola — yang menjelaskan bahwa ia membeli paket sensor IoT dan menerima pembayaran booking langsung dari pengunjung — sebelum pengajuannya bisa dikirim, dan persetujuan itu tercatat sebagai bukti.

**Architecture:** Halaman statis `/syarat-pengelola` memuat teks perjanjian. Checkbox di form pengajuan (`VerificationForm`) menautkannya dan memblokir submit sampai dicentang. Validasi form dipindah ke modul murni `lib/verification.ts` supaya bisa diuji tanpa bundler. Versi perjanjian dan waktu persetujuan disimpan bersama data pengajuan di `users/{uid}.verification`, lalu ditampilkan ke admin di `PenggunaPanel`.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4, Firebase Firestore 12. Uji berbasis `node:assert` tanpa framework, dijalankan langsung dengan `node` (Node 26 menanggalkan tipe secara bawaan).

**Spec:** `docs/superpowers/specs/2026-07-30-perjanjian-mitra-pengelola-design.md`

## Global Constraints

- Repositori sedang di branch `main`. Buat branch kerja lebih dulu: `git checkout -b feat/perjanjian-pengelola`. Jangan commit langsung ke `main`.
- Versi perjanjian yang dirilis rencana ini: **`"1.0"`**, tanggal berlaku **30 Juli 2026**. Dua nilai ini muncul di beberapa berkas dan harus identik.
- Garansi paket IoT: **3 (tiga) bulan** untuk cacat produksi. Angka ini hanya muncul di teks perjanjian.
- Harga dan isi paket IoT **tidak boleh** ditulis di teks perjanjian — mengacu daftar terpisah, supaya perubahan harga tidak memaksa penerbitan versi baru.
- Checkbox persetujuan **hanya** untuk `requestedRole === 'pengelola'`. Pengajuan `mitra` memakai form yang sama dan tidak boleh terpengaruh.
- `lib/verification.ts` wajib **tanpa satu pun import**. Berkas ceknya dijalankan `node` polos; import apa pun ke SDK Firebase akan membuatnya gagal.
- Semua teks yang tampil ke pengguna berbahasa Indonesia, mengikuti nada berkas yang ada (kalimat lugas, sapaan "kamu").
- Firestore menolak nilai `undefined`. Field opsional hanya boleh di-spread saat nilainya pasti ada.

---

### Task 1: Modul validasi murni + konstanta versi

Memindahkan validasi form ke modul yang bisa diuji, sekaligus menambahkan gerbang persetujuan. Task ini tidak mengubah UI apa pun — hanya menyiapkan fungsi yang dipakai Task 3.

**Files:**
- Create: `lib/verification.ts`
- Create: `lib/verification.check.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `PENGELOLA_AGREEMENT_VERSION: string` (nilai `"1.0"`)
  - `interface RoleRequestInput { fullName: string; phone: string; organization: string; requestedRole: 'mitra' | 'pengelola'; destination?: string; agreed?: boolean }`
  - `validateRoleRequest(input: RoleRequestInput): string | null`

- [ ] **Step 1: Buat branch kerja**

```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA
git checkout -b feat/perjanjian-pengelola
```

- [ ] **Step 2: Tulis berkas cek yang gagal**

Buat `lib/verification.check.ts`:

```ts
/**
 * Cek validasi form pengajuan naik role — gerbang yang menahan pengajuan
 * pengelola tanpa persetujuan Perjanjian Pengelola. Kalau logikanya rusak,
 * orang bisa jadi pengelola tanpa pernah diberi tahu dia harus beli alat.
 *
 * Jalankan: node lib/verification.check.ts
 */
import assert from 'node:assert/strict';
import { PENGELOLA_AGREEMENT_VERSION, validateRoleRequest } from './verification.ts';

const lengkap = {
  fullName: 'Budi Santoso',
  phone: '081234567890',
  organization: 'Dive Bahoi',
} as const;

// Kolom wajib kosong ditolak lebih dulu, apa pun rolenya — termasuk yang isinya
// cuma spasi.
assert.equal(
  validateRoleRequest({ ...lengkap, fullName: '   ', requestedRole: 'mitra' }),
  'Semua kolom wajib diisi.'
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    phone: '',
    requestedRole: 'pengelola',
    destination: 'Bahoi',
    agreed: true,
  }),
  'Semua kolom wajib diisi.'
);

// Mitra: tidak butuh destinasi maupun persetujuan perjanjian.
assert.equal(validateRoleRequest({ ...lengkap, requestedRole: 'mitra' }), null);

// Pengelola tanpa memilih destinasi.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    requestedRole: 'pengelola',
    destination: '',
    agreed: true,
  }),
  'Pilih destinasi yang ingin dikelola.'
);

// Pengelola lengkap tapi belum menyetujui perjanjian.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    requestedRole: 'pengelola',
    destination: 'Bahoi',
    agreed: false,
  }),
  'Kamu harus menyetujui Perjanjian Pengelola dulu.'
);

// Kolom kosong diperiksa sebelum persetujuan: jangan suruh orang menyetujui
// perjanjian untuk form yang belum diisi.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    organization: '',
    requestedRole: 'pengelola',
    destination: 'Bahoi',
    agreed: false,
  }),
  'Semua kolom wajib diisi.'
);

// Pengelola lengkap dan sudah menyetujui.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    requestedRole: 'pengelola',
    destination: 'Bahoi',
    agreed: true,
  }),
  null
);

// Versi perjanjian tidak boleh kosong — nilai ini yang tercatat sebagai bukti.
assert.ok(PENGELOLA_AGREEMENT_VERSION.length > 0);

console.log('verification.ts OK');
```

- [ ] **Step 3: Jalankan berkas cek, pastikan gagal**

Run: `node lib/verification.check.ts`
Expected: GAGAL dengan `ERR_MODULE_NOT_FOUND` — `./verification.ts` belum ada.

- [ ] **Step 4: Tulis implementasi minimal**

Buat `lib/verification.ts`:

```ts
/**
 * Aturan form pengajuan naik role. Sengaja tanpa import apa pun supaya
 * verification.check.ts bisa dijalankan `node` polos tanpa bundler — sama
 * alasannya dengan format.ts.
 */

/** Versi Perjanjian Pengelola yang berlaku. Dinaikkan bila isinya berubah. */
export const PENGELOLA_AGREEMENT_VERSION = '1.0';

export interface RoleRequestInput {
  fullName: string;
  phone: string;
  organization: string;
  requestedRole: 'mitra' | 'pengelola';
  /** Hanya diisi pengajuan pengelola. */
  destination?: string;
  /** Centang Perjanjian Pengelola; tidak berlaku bagi pengajuan mitra. */
  agreed?: boolean;
}

/**
 * Pesan kesalahan pertama yang ditemukan, atau null bila pengajuan boleh
 * dikirim. Urutannya disengaja: kolom kosong diperiksa duluan, baru syarat
 * khusus pengelola — supaya orang tidak disuruh menyetujui perjanjian untuk
 * form yang belum diisi.
 */
export function validateRoleRequest(input: RoleRequestInput): string | null {
  if (
    !input.fullName.trim() ||
    !input.phone.trim() ||
    !input.organization.trim()
  ) {
    return 'Semua kolom wajib diisi.';
  }
  if (input.requestedRole !== 'pengelola') return null;
  if (!input.destination) return 'Pilih destinasi yang ingin dikelola.';
  if (!input.agreed) return 'Kamu harus menyetujui Perjanjian Pengelola dulu.';
  return null;
}
```

- [ ] **Step 5: Jalankan berkas cek, pastikan lolos**

Run: `node lib/verification.check.ts`
Expected: mencetak `verification.ts OK`, keluar dengan kode 0.

- [ ] **Step 6: Commit**

```bash
git add lib/verification.ts lib/verification.check.ts
git commit -m "feat: modul validasi pengajuan role + konstanta versi perjanjian"
```

---

### Task 2: Halaman `/syarat-pengelola`

Dokumen perjanjiannya sendiri. Berdiri sendiri — bisa dibuka dan dibaca sebelum form menautkannya.

**Files:**
- Create: `app/syarat-pengelola/page.tsx`

**Interfaces:**
- Consumes: `PENGELOLA_AGREEMENT_VERSION` dari `@/lib/verification` (Task 1).
- Produces: rute `/syarat-pengelola`, ditautkan oleh Task 3.

- [ ] **Step 1: Buat halaman**

Buat `app/syarat-pengelola/page.tsx`. Susunan `main`/`TopNav`/`Footer`/`BottomNav` mengikuti `app/profile/page.tsx`:

```tsx
import type { Metadata } from 'next';
import TopNav from '@/components/desktop/TopNav';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';
import { PENGELOLA_AGREEMENT_VERSION } from '@/lib/verification';

export const metadata: Metadata = {
  title: 'Perjanjian Pengelola — Lautara',
  description:
    'Hak, kewajiban, dan ketentuan paket pemantauan bagi pengelola destinasi Lautara.',
};

/** Tanggal berlaku v1.0. Ditulis di sini karena hanya dipakai di halaman ini. */
const BERLAKU_SEJAK = '30 Juli 2026';

const PASAL: { judul: string; ayat: string[] }[] = [
  {
    judul: '1. Ruang Lingkup',
    ayat: [
      'Perjanjian ini mengatur hubungan antara Lautara ("Platform") dan pengguna yang disetujui menjadi pengelola destinasi ("Pengelola").',
      'Destinasi yang dikelola ditetapkan oleh admin Platform. Pilihan destinasi pada formulir pengajuan bersifat usulan, bukan penetapan.',
      'Perjanjian ini bukan perjanjian kerja. Pengelola bukan karyawan Platform, tidak menerima upah, dan tidak memperoleh hak ketenagakerjaan dari Platform.',
    ],
  },
  {
    judul: '2. Hak Pengelola',
    ayat: [
      'Mengubah data destinasi yang dikelolanya: deskripsi, foto, titik lokasi, daftar harga, dan kontak WhatsApp.',
      'Melihat dan mengonfirmasi pesanan yang masuk ke destinasinya.',
      'Mendaftarkan kamera pemantau dan melihat streamnya.',
      'Mengakses statistik kunjungan dan bacaan sensor destinasinya melalui Dashboard.',
    ],
  },
  {
    judul: '3. Kewajiban Pengelola',
    ayat: [
      'Menjaga keakuratan data destinasi, terutama harga, ketersediaan, dan jam operasional. Data yang keliru merugikan pengunjung dan menjadi tanggung jawab Pengelola.',
      'Merespons pesanan yang masuk dalam waktu yang wajar.',
      'Menjaga kerahasiaan akun. Semua tindakan yang dilakukan dari akun Pengelola dianggap dilakukan olehnya.',
      'Mematuhi peraturan perundang-undangan yang berlaku serta menjaga keselamatan pengunjung di destinasinya.',
    ],
  },
  {
    judul: '4. Paket Pemantauan IoT',
    ayat: [
      'Destinasi yang dikelola wajib dilengkapi paket sensor pemantauan yang disediakan Platform.',
      'Paket sensor dibeli oleh Pengelola dan sepenuhnya menjadi hak miliknya setelah pembayaran lunas.',
      'Pembelian dan pemasangan baru dikoordinasikan setelah pengajuan menjadi Pengelola disetujui admin. Tidak ada pembayaran apa pun yang diminta sebelum pengajuan diterima.',
      'Rincian isi paket dan harganya disampaikan terpisah sebelum pembelian, mengacu pada daftar yang berlaku saat itu. Pengelola berhak membatalkan pembelian sebelum pembayaran dilakukan; dalam hal itu status Pengelola tidak dapat diaktifkan karena ayat 1 tidak terpenuhi.',
      'Platform menjamin paket bebas cacat produksi selama 3 (tiga) bulan sejak tanggal pemasangan. Dalam masa itu komponen yang rusak karena cacat produksi diganti tanpa biaya.',
      'Garansi tidak berlaku atas kerusakan akibat bencana alam, kelalaian, vandalisme, pencurian, sambaran petir, atau modifikasi yang dilakukan sendiri oleh Pengelola.',
      'Pengelola menyediakan sumber listrik dan koneksi internet yang layak di titik pemasangan, serta memberi akses bagi petugas Platform untuk pemasangan dan perbaikan.',
      'Alat adalah milik Pengelola. Dengan memasangnya, Pengelola memberi izin kepada Platform untuk menampilkan bacaan sensornya di halaman publik destinasi selama ia menjabat sebagai Pengelola.',
      'Bila Pengelola berhenti, alat tetap menjadi miliknya. Platform menghentikan penayangan datanya dan memutus keterkaitan alat dengan destinasi di dalam sistem.',
    ],
  },
  {
    judul: '5. Pesanan dan Pembayaran',
    ayat: [
      'Pembayaran atas tiket, penginapan, sewa alat, dan layanan lain di destinasi dilakukan pengunjung langsung kepada Pengelola, di luar Platform.',
      'Platform hanya mencatat pesanan dan menerbitkan tiket elektronik. Platform tidak menerima, menyimpan, maupun menyalurkan dana pengunjung.',
      'Platform bukan pihak dalam transaksi antara pengunjung dan Pengelola. Sengketa mengenai layanan, harga, pengembalian dana, atau pembatalan diselesaikan antara pengunjung dan Pengelola.',
    ],
  },
  {
    judul: '6. Bagi Hasil',
    ayat: [
      'Saat ini Platform tidak memungut potongan, komisi, atau biaya apa pun atas pendapatan destinasi.',
      'Bila kemudian Platform memberlakukan potongan, Pengelola diberitahu paling lambat 30 (tiga puluh) hari sebelum ketentuan itu berlaku.',
      'Dalam tenggang waktu tersebut Pengelola berhak mengakhiri perjanjian ini tanpa penalti.',
    ],
  },
  {
    judul: '7. Tanggung Jawab',
    ayat: [
      'Pengelola bertanggung jawab penuh atas layanan, fasilitas, dan keselamatan pengunjung di destinasi yang dikelolanya.',
      'Platform menyediakan layanan pencatatan dan penayangan informasi sebagaimana adanya. Platform tidak bertanggung jawab atas kerugian yang timbul dari layanan di destinasi, kekeliruan data yang diisi Pengelola, maupun gangguan jaringan atau perangkat di luar kendalinya.',
    ],
  },
  {
    judul: '8. Data Pribadi Pengunjung',
    ayat: [
      'Data pengunjung yang terlihat di Dashboard hanya boleh digunakan untuk keperluan pesanan yang bersangkutan.',
      'Pengelola dilarang menyalin, menyebarkan, atau memakai data tersebut untuk tujuan lain, termasuk pemasaran, tanpa persetujuan pengunjung.',
    ],
  },
  {
    judul: '9. Penangguhan, Pengakhiran, dan Perubahan',
    ayat: [
      'Platform dapat menangguhkan atau mencabut status Pengelola bila terjadi pelanggaran atas perjanjian ini, disertai pemberitahuan.',
      'Pengelola dapat mengundurkan diri kapan saja dengan memberitahu admin.',
      'Perubahan perjanjian ditandai dengan kenaikan nomor versi dan diberitahukan kepada Pengelola aktif. Persetujuan yang tercatat mengacu pada nomor versi yang berlaku saat pengajuan dikirim.',
    ],
  },
];

export default function SyaratPengelola() {
  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-24 md:pb-0">
      <TopNav compact />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-serif text-3xl font-medium text-navy">
          Perjanjian Pengelola
        </h1>
        <p className="mt-2 text-2xs text-navy-soft">
          Versi {PENGELOLA_AGREEMENT_VERSION} · Berlaku sejak {BERLAKU_SEJAK}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-navy-soft">
          Baca sebelum mengajukan diri jadi pengelola. Dua hal yang paling perlu
          kamu tahu: kamu membeli sendiri paket sensor untuk destinasimu, dan
          pembayaran dari pengunjung kamu terima langsung, bukan lewat Lautara.
        </p>

        <div className="mt-10 space-y-8">
          {PASAL.map((p) => (
            <section key={p.judul}>
              <h2 className="font-serif text-lg font-medium text-navy">
                {p.judul}
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                {p.ayat.map((a, i) => (
                  <li key={i} className="text-sm leading-relaxed text-navy-soft">
                    {a}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
      <Footer />
      <BottomNav />
    </main>
  );
}
```

- [ ] **Step 2: Pastikan build lolos**

Run: `npm run build`
Expected: SUKSES, dan daftar rute memuat `/syarat-pengelola`.

- [ ] **Step 3: Periksa halamannya di browser**

Run: `npm run dev`, lalu buka `http://localhost:3000/syarat-pengelola`.
Expected: judul "Perjanjian Pengelola", baris "Versi 1.0 · Berlaku sejak 30 Juli 2026", sembilan pasal bernomor, dan halaman tidak menggeser horizontal di lebar 375px.

- [ ] **Step 4: Commit**

```bash
git add app/syarat-pengelola/page.tsx
git commit -m "feat: halaman Perjanjian Pengelola v1.0"
```

---

### Task 3: Checkbox persetujuan di form pengajuan

Menyambungkan halaman Task 2 ke form, dan menyimpan bukti persetujuannya.

**Files:**
- Modify: `lib/firestore.ts:141-152` (antarmuka `MitraVerification`)
- Modify: `lib/firestore.ts:221-235` (`submitRoleRequest`)
- Modify: `components/cameras/VerificationForm.tsx`

**Interfaces:**
- Consumes: `validateRoleRequest`, `PENGELOLA_AGREEMENT_VERSION` dari `@/lib/verification` (Task 1); rute `/syarat-pengelola` (Task 2).
- Produces: `users/{uid}.verification` kini bisa memuat `agreementVersion: string` dan `agreedAt` (Timestamp server) — dibaca Task 4. Parameter `data` pada `submitRoleRequest` menerima `agreementVersion?: string`; `agreedAt` distempel di dalam fungsi, bukan dikirim pemanggil.

- [ ] **Step 1: Tambah dua field ke `MitraVerification`**

Di `lib/firestore.ts`, sisipkan sebelum `submittedAt: unknown;`:

```ts
  /** Versi Perjanjian Pengelola yang disetujui. Kosong pada pengajuan mitra
   *  dan pengajuan pengelola sebelum v1.0 terbit. */
  agreementVersion?: string;
  /** Waktu checkbox persetujuan dicentang. unknown mengikuti submittedAt. */
  agreedAt?: unknown;
```

- [ ] **Step 2: Perluas `submitRoleRequest`**

Di `lib/firestore.ts`, tambahkan satu baris pada tipe `data`, setelah `destination?: string;`:

```ts
    agreementVersion?: string;
```

Lalu ubah badan fungsinya agar menstempel waktu persetujuan sendiri:

```ts
  await updateDoc(doc(db, "users", uid), {
    verification: {
      ...data,
      status: "pending",
      submittedAt: serverTimestamp(),
      // Distempel di sini, bukan di komponen: waktu persetujuan harus datang
      // dari server, dan pemanggil tidak perlu mengimpor SDK Firestore.
      ...(data.agreementVersion && { agreedAt: serverTimestamp() }),
    },
  });
```

- [ ] **Step 3: Pasang checkbox di `VerificationForm.tsx`**

Tambahkan import di bagian atas berkas:

```ts
import {
  PENGELOLA_AGREEMENT_VERSION,
  validateRoleRequest,
} from '@/lib/verification';
```

Tambahkan state, tepat di bawah `const [error, setError] = useState('');`:

```ts
  // Selalu mulai false, termasuk saat ajukan ulang setelah ditolak: isi
  // perjanjian bisa sudah berubah sejak pengajuan sebelumnya.
  const [agreed, setAgreed] = useState(false);
```

Ganti rantai validasi di `handleSubmit` — buang enam baris `if` yang ada
(`if (!fullName.trim() ...)` sampai `}` penutup blok destinasi) dan pakai:

```ts
    const invalid = validateRoleRequest({
      fullName,
      phone,
      organization,
      requestedRole,
      destination,
      agreed,
    });
    if (invalid) {
      setError(invalid);
      return;
    }
```

Lalu tambahkan dua field pada panggilan `submitRoleRequest`, di dalam blok
`...(isPengelola && { ... })` yang sudah ada:

```ts
        ...(isPengelola && {
          destination,
          agreementVersion: PENGELOLA_AGREEMENT_VERSION,
        }),
```

`agreedAt` tidak dikirim dari sini — `submitRoleRequest` yang menstempelnya
dengan `serverTimestamp()` begitu `agreementVersion` ada.

- [ ] **Step 4: Tambahkan checkbox ke JSX**

Sisipkan tepat setelah blok `{isPengelola && ( ... )}` yang memuat pilihan
destinasi, sebelum `{error && ...}`:

```tsx
        {isPengelola && (
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
            />
            <span className="text-xs leading-relaxed text-navy-soft">
              Saya sudah membaca dan menyetujui{' '}
              <a
                href="/syarat-pengelola"
                target="_blank"
                rel="noopener"
                className="font-medium text-teal-700 underline underline-offset-2"
              >
                Perjanjian Pengelola
              </a>
              , termasuk ketentuan pembelian paket sensor dan pembayaran
              pengunjung yang diterima langsung oleh pengelola.
            </span>
          </label>
        )}
```

Tautan dibuka di tab baru supaya isian form yang belum dikirim tidak hilang.

- [ ] **Step 5: Pastikan cek dan build lolos**

Run: `node lib/verification.check.ts && npm run build`
Expected: `verification.ts OK` lalu build SUKSES tanpa galat TypeScript.

- [ ] **Step 6: Uji manual alur pengelola**

Run: `npm run dev`, buka `/profile` → bagian "Jadi Pengelola" dengan akun ber-role `user`.
Expected:
1. Isi semua kolom, pilih destinasi, **jangan** centang → klik Ajukan → muncul "Kamu harus menyetujui Perjanjian Pengelola dulu." dan tidak ada tulisan ke Firestore.
2. Kosongkan Instansi lalu klik Ajukan → muncul "Semua kolom wajib diisi.", bukan pesan perjanjian.
3. Klik tautan "Perjanjian Pengelola" → terbuka di tab baru, isian form tetap utuh.
4. Centang lalu Ajukan → kartu berubah jadi "Menunggu Persetujuan".
5. Di Firebase Console, `users/{uid}.verification` memuat `agreementVersion: "1.0"` dan `agreedAt` berisi timestamp.
6. Buka halaman Kamera dengan akun ber-role `user` → form verifikasi mitra **tidak** menampilkan checkbox, dan pengajuannya tetap bisa dikirim.

- [ ] **Step 7: Commit**

```bash
git add lib/firestore.ts components/cameras/VerificationForm.tsx
git commit -m "feat: wajib setujui Perjanjian Pengelola sebelum ajukan jadi pengelola"
```

---

### Task 4: Tampilkan bukti persetujuan ke admin

Tanpa ini persetujuan tersimpan tapi tidak pernah terlihat siapa pun — jejak audit yang tidak terbaca sama saja dengan tidak ada.

**Files:**
- Modify: `lib/format.ts` (tambah `formatTimestamp`)
- Modify: `lib/format.check.ts` (tambah kasus uji)
- Modify: `components/dashboard/PenggunaPanel.tsx:124-126`

**Interfaces:**
- Consumes: `agreementVersion` dan `agreedAt` pada `MitraVerification` (Task 3).
- Produces: `formatTimestamp(value: unknown): string | null` di `lib/format.ts`.

- [ ] **Step 1: Tulis kasus uji yang gagal**

Di `lib/format.check.ts`, ubah baris import menjadi:

```ts
import { formatTimestamp, parseCoords, waLink } from './format.ts';
```

Lalu sisipkan sebelum `console.log('format.ts OK');`:

```ts
// Tanggal — Timestamp Firestore hanya dikenali lewat toDate(). Tanggal lokal
// dipakai supaya hasilnya tidak bergeser mengikuti zona waktu pelaksana.
assert.equal(formatTimestamp({ toDate: () => new Date(2026, 6, 30) }), '30 Jul 2026');

// Bukan timestamp → null, supaya pemanggil bisa menyembunyikan barisnya.
assert.equal(formatTimestamp(null), null);
assert.equal(formatTimestamp(undefined), null);
assert.equal(formatTimestamp({}), null);
assert.equal(formatTimestamp('30 Juli 2026'), null);
assert.equal(formatTimestamp({ toDate: () => new Date('bukan tanggal') }), null);
```

- [ ] **Step 2: Jalankan berkas cek, pastikan gagal**

Run: `node lib/format.check.ts`
Expected: GAGAL — `formatTimestamp` belum diekspor dari `./format.ts`.

- [ ] **Step 3: Tulis `formatTimestamp`**

Tambahkan di akhir `lib/format.ts`:

```ts
/**
 * Tanggal ringkas dari Timestamp Firestore, mis. "30 Jul 2026". Masuk sebagai
 * unknown karena antarmuka Firestore di proyek ini menyimpan timestamp begitu.
 * null bila nilainya bukan timestamp — dokumen lama, field yang belum terisi,
 * atau tulisan yang belum tersinkron dari server.
 */
export function formatTimestamp(value: unknown): string | null {
  const d = (value as { toDate?: () => Date } | null | undefined)?.toDate?.();
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
```

- [ ] **Step 4: Jalankan berkas cek, pastikan lolos**

Run: `node lib/format.check.ts`
Expected: mencetak `format.ts OK`, keluar dengan kode 0.

- [ ] **Step 5: Tampilkan barisnya di `PenggunaPanel`**

Tambahkan import di bagian atas berkas:

```ts
import { formatTimestamp } from '@/lib/format';
```

Sisipkan tepat setelah blok `{u.verification.destination && ( ... )}`:

```tsx
                  {u.verification.agreementVersion && (
                    <p>
                      <span className="text-navy-soft">Perjanjian:</span>{' '}
                      {[
                        `v${u.verification.agreementVersion}`,
                        formatTimestamp(u.verification.agreedAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
```

Barisnya tidak dirender bila `agreementVersion` kosong — pengajuan mitra dan
pengajuan pengelola lama tampil persis seperti sebelumnya.

- [ ] **Step 6: Pastikan semua cek dan build lolos**

Run: `node lib/format.check.ts && node lib/verification.check.ts && npm run build`
Expected: `format.ts OK`, `verification.ts OK`, lalu build SUKSES.

- [ ] **Step 7: Uji manual tampilan admin**

Run: `npm run dev`, masuk sebagai admin, buka Dashboard → Pengguna.
Expected:
1. Kartu pengajuan pengelola dari Task 3 menampilkan `Perjanjian: v1.0 · 30 Jul 2026`.
2. Kartu pengajuan mitra tidak menampilkan baris itu sama sekali.
3. Tombol Setujui masih menaikkan role seperti sebelumnya.

- [ ] **Step 8: Commit**

```bash
git add lib/format.ts lib/format.check.ts components/dashboard/PenggunaPanel.tsx
git commit -m "feat: tampilkan bukti persetujuan perjanjian di panel pengguna admin"
```

---

## Verifikasi akhir

- [ ] `node lib/format.check.ts` — lolos
- [ ] `node lib/verification.check.ts` — lolos
- [ ] `npm run build` — sukses, rute `/syarat-pengelola` terdaftar
- [ ] `npm run lint` — tanpa galat baru
- [ ] Pengajuan pengelola tanpa centang ditolak; dengan centang tersimpan lengkap dengan versi dan waktu
- [ ] Pengajuan mitra tidak terpengaruh sama sekali
