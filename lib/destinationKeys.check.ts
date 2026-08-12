/**
 * Menjaga dua kopling yang gagalnya senyap. Keduanya berbentuk sama: daftar
 * nama kolom ditulis di dua tempat, dan kalau berbeda tidak ada yang gagal saat
 * build — Firestore menolak SELURUH tulisan dengan permission-denied, bukan
 * cuma kolom yang tidak cocok. Rules juga hidup di Firebase Console, jadi
 * ketidaksamaan ini gampang lolos review.
 *
 *   1. Menyunting destinasi: EDITABLE_KEYS di
 *      components/dashboard/PengelolaDestinasiPanel.tsx  ↔
 *      affectedKeys().hasOnly([...]) di firestore.rules
 *
 *   2. Menambah destinasi di dalam destinasi: field yang ditulis
 *      addChildDestination() di lib/firestore.ts  ↔
 *      keys().hasOnly([...]) di firestore.rules
 *
 * Dibaca sebagai teks, bukan di-import: file panelnya .tsx dengan 'use client'
 * dan firestore.ts meng-import SDK Firebase, jadi dua-duanya tidak bisa
 * dijalankan `node` polos seperti file ini.
 *
 * Jalankan: node lib/destinationKeys.check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;

/** Nama kolom di dalam sepasang kurung siku, apa pun gaya kutipnya. */
function keysInBrackets(block: string): string[] {
  return [...block.matchAll(/['"]([a-zA-Z]+)['"]/g)].map((m) => m[1]).sort();
}

const panel = readFileSync(
  `${ROOT}components/dashboard/PengelolaDestinasiPanel.tsx`,
  "utf8"
);
const firestore = readFileSync(`${ROOT}lib/firestore.ts`, "utf8");
const rules = readFileSync(`${ROOT}firestore.rules`, "utf8");

// ── 1. Kolom yang boleh disunting pengelola ──

const panelBlock = panel.match(/const EDITABLE_KEYS = \[([\s\S]*?)\]/);
assert.ok(panelBlock, "EDITABLE_KEYS tidak ditemukan di PengelolaDestinasiPanel");

// Diikat ke affectedKeys(), bukan hasOnly() saja: rules sekarang punya DUA
// daftar hasOnly (satu untuk update, satu untuk create), dan pola yang longgar
// akan mencocokkan daftar create ke EDITABLE_KEYS — cek yang selalu merah dan
// akhirnya dilonggarkan orang, bukan dibetulkan.
const updateBlock = rules.match(/affectedKeys\(\)\s*\.hasOnly\(\[([\s\S]*?)\]\)/);
assert.ok(updateBlock, "affectedKeys().hasOnly([...]) tidak ditemukan di firestore.rules");

const panelKeys = keysInBrackets(panelBlock[1]);
const updateKeys = keysInBrackets(updateBlock[1]);

assert.deepEqual(
  panelKeys,
  updateKeys,
  `Daftar kolom yang boleh disunting pengelola tidak sama.\n` +
    `  panel : ${panelKeys.join(", ")}\n` +
    `  rules : ${updateKeys.join(", ")}\n` +
    `Samakan keduanya, lalu deploy ulang rules-nya ke Firebase Console.`
);

// Kolom yang tidak boleh ikut walau suatu saat panelnya diperluas: jalur
// pengalihan kepemilikan (managerUid), penyerobotan perangkat milik destinasi
// lain (stationId, cameraId), dan identitas yang ditetapkan admin.
for (const terlarang of [
  "managerUid",
  "stationId",
  "cameraId",
  "cameraIds",
  "name",
  "location",
  // Memindahkan destinasi ke induk lain sesudah dibuat: rule create memeriksa
  // pemilik induknya SEKALI, saat dokumen lahir. Kalau parentId bisa disunting,
  // pemeriksaan itu bisa dilewati belakangan — spot pindah ke kawasan orang
  // lain dan tayang di halaman publik destinasi itu.
  "parentId",
]) {
  assert.ok(
    !panelKeys.includes(terlarang),
    `${terlarang} tidak boleh bisa disunting pengelola`
  );
}

assert.ok(panelKeys.length > 0, "daftar kolom kosong — panelnya jadi tidak berguna");

// ── 2. Kolom yang ditulis saat pengelola menambah destinasi di dalam ──

const addFn = firestore.match(
  /export async function addChildDestination[\s\S]*?addDoc\([\s\S]*?\{([\s\S]*?)\n {2}\}\);/
);
assert.ok(addFn, "addChildDestination() tidak ditemukan di lib/firestore.ts");

// Komentar dibuang dulu — isinya bahasa Indonesia berkolon dan akan terbaca
// sebagai nama kolom.
const addKeys = [
  ...addFn[1]
    .replace(/\/\/[^\n]*/g, "")
    .matchAll(/^\s+([a-zA-Z]+):/gm),
]
  .map((m) => m[1])
  .sort();

const createBlock = rules.match(/keys\(\)\s*\.hasOnly\(\[([\s\S]*?)\]\)/);
assert.ok(createBlock, "keys().hasOnly([...]) tidak ditemukan di firestore.rules");
const createKeys = keysInBrackets(createBlock[1]);

assert.deepEqual(
  addKeys,
  createKeys,
  `Daftar kolom destinasi-di-dalam tidak sama.\n` +
    `  addChildDestination : ${addKeys.join(", ")}\n` +
    `  rules               : ${createKeys.join(", ")}\n` +
    `Samakan keduanya, lalu deploy ulang rules-nya ke Firebase Console.`
);

// Inti gerbangnya: dokumen baru tidak boleh lahir sudah menempel ke perangkat
// orang lain. stationId/cameraIds tidak ada di daftar create berarti halaman
// spot buatan pengelola tidak bisa menayangkan siaran atau sensor yang bukan
// haknya — dan karena keduanya juga tidak ada di daftar update, tidak ada jalan
// menambahkannya belakangan.
for (const terlarang of ["stationId", "cameraId", "cameraIds", "hasMonitoring"]) {
  assert.ok(
    !createKeys.includes(terlarang),
    `${terlarang} tidak boleh ikut ditulis saat pengelola menambah destinasi`
  );
}

// parentId & managerUid justru WAJIB ada: keduanya yang diperiksa rules untuk
// memastikan spot baru masuk ke kawasan milik si pemanggil sendiri. Kalau
// hilang dari daftar, create-nya ditolak seluruhnya.
for (const wajib of ["parentId", "managerUid", "name"]) {
  assert.ok(
    createKeys.includes(wajib),
    `${wajib} wajib ikut ditulis saat pengelola menambah destinasi`
  );
}

console.log(
  `destinationKeys.check.ts OK — sunting ${panelKeys.length} kolom, ` +
    `tambah ${createKeys.length} kolom, dua-duanya sinkron dengan rules`
);
