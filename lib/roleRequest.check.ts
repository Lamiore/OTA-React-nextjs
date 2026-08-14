/**
 * Menjaga kopling pengajuan pengelola — gagalnya senyap, persis seperti dua
 * kopling di destinationKeys.check.ts.
 *
 * Yang dijaga: `verification` hanya boleh ditulis server. Sebelum ini rules
 * mengizinkan pemilik dokumen memindahkan status 'invited' → 'pending' sendiri,
 * dan celah itu menjaga KAPAN boleh menulis, bukan APA yang ditulis — isi
 * formulirnya datang dari browser dan dipercaya apa adanya. Akibatnya
 * `agreementVersion` bisa menyebut versi yang tidak pernah terbit dan
 * `declaredRights` bisa true tanpa satu pun centang, sementara `agreedAt`
 * distempel serverTimestamp() sehingga catatannya TAMPAK otoritatif.
 *
 * Kenapa butuh penjaga, bukan cukup sekali diperbaiki: mengembalikan celah itu
 * tidak membuat apa pun gagal saat build. Halaman pengajuan tetap jalan, tesnya
 * tetap hijau, dan yang berubah cuma jaminan yang tidak terlihat di layar mana
 * pun. Rules juga hidup di Firebase Console, jadi ketidaksamaan gampang lolos.
 *
 * Dibaca sebagai teks, bukan di-import: route dan komponennya menarik
 * firebase-admin / SDK klien, jadi tidak bisa dijalankan `node` polos.
 *
 * Jalankan: node lib/roleRequest.check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;

const rules = readFileSync(`${ROOT}firestore.rules`, "utf8");
const firestore = readFileSync(`${ROOT}lib/firestore.ts`, "utf8");
const route = readFileSync(`${ROOT}app/api/role-request/route.ts`, "utf8");
const form = readFileSync(`${ROOT}components/cameras/VerificationForm.tsx`, "utf8");

// ── 1. Rules: pemilik dokumen tidak boleh menyentuh `verification` ──

const awal = rules.indexOf("match /users/{userId}");
assert.ok(awal !== -1, "blok match /users/{userId} tidak ditemukan di firestore.rules");
const akhir = rules.indexOf("match /destinations/{docId}", awal);
assert.ok(akhir !== -1, "blok match /destinations tidak ditemukan — patokan akhir blok users hilang");

// Komentar dibuang: isinya justru MENJELASKAN celah lama, jadi kalau ikut
// terbaca, cek di bawah akan merah selamanya tanpa ada yang salah di rules-nya.
const usersBlock = rules
  .slice(awal, akhir)
  .replace(/\/\/[^\n]*/g, "");

assert.ok(
  usersBlock.includes("hasAny(['verification'])"),
  "Penolakan verification hilang dari rules users/{userId}.\n" +
    "Tanpa baris itu pemilik dokumen bisa menulis verification apa saja sendiri."
);

// Inti penjaganya: cabang lama membandingkan status verification dari klien.
// Kalau pola ini muncul lagi, celahnya kembali.
assert.ok(
  !usersBlock.includes("request.resource.data.verification"),
  "firestore.rules kembali membaca request.resource.data.verification di blok users.\n" +
    "Itu cabang lama yang mengizinkan klien menulis isi pengajuannya sendiri.\n" +
    "Pengiriman formulir harus lewat /api/role-request (Admin SDK)."
);

// ── 2. Klien: submitRoleRequest lewat route, bukan updateDoc ──

// Dipotong lewat indeks, bukan regex sampai `\n}`: tanda kurung kurawal
// penutup pertama yang menempel kolom 0 adalah penutup TIPE parameternya
// (`}) {`), bukan penutup fungsinya — pola yang lugas itu cuma menangkap
// tanda tangannya saja dan membuat cek ini hijau/merah karena alasan yang salah.
const submitAwal = firestore.indexOf("export async function submitRoleRequest");
assert.ok(submitAwal !== -1, "submitRoleRequest() tidak ditemukan di lib/firestore.ts");
const submitBerikut = firestore.indexOf("\nexport ", submitAwal + 1);
const submitFn = firestore.slice(
  submitAwal,
  submitBerikut === -1 ? undefined : submitBerikut
);

assert.ok(
  submitFn.includes("/api/role-request"),
  "submitRoleRequest() tidak lagi memanggil /api/role-request"
);
assert.ok(
  !submitFn.includes("updateDoc"),
  "submitRoleRequest() menulis langsung lewat updateDoc.\n" +
    "Rules menutup verification dari klien, jadi tulisan itu akan ditolak — dan\n" +
    "kalau rules ikut dilonggarkan agar lolos, jaminannya hilang seluruhnya."
);

// ── 3. Route: agreementVersion dari server, bukan dari body ──

assert.ok(
  route.includes("AGREEMENT.pengelola.version"),
  "Route tidak menulis agreementVersion dari AGREEMENT di server"
);
assert.ok(
  !/body\.agreementVersion/.test(route),
  "Route membaca agreementVersion dari body permintaan.\n" +
    "Versi yang tercatat harus versi yang BERLAKU di server saat pengajuan\n" +
    "dikirim — bukan versi yang browser bilang."
);
assert.ok(
  route.includes("LAND_RIGHTS"),
  "Route tidak mengunci landRights ke daftar resmi — <select> di layar bukan penjaga"
);
assert.ok(
  route.includes("validateRoleRequest"),
  "Route tidak memakai validateRoleRequest() yang sama dengan formulir.\n" +
    "Dua salinan validasi berarti server bisa menerima apa yang layar tolak."
);
assert.ok(
  route.includes("'invited'"),
  "Route tidak memeriksa status 'invited' — gerbang tiket-dibuka-admin hilang"
);

// ── 4. Formulir: tidak mengirim agreementVersion ──

assert.ok(
  !/agreementVersion:/.test(form),
  "VerificationForm masih mengirim agreementVersion.\n" +
    "Server mengabaikannya, jadi keberadaannya cuma menyesatkan pembaca kode."
);

console.log(
  "roleRequest.check.ts OK — verification tertutup dari klien, " +
    "agreementVersion & landRights ditentukan server"
);
