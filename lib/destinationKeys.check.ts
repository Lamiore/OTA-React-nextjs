/**
 * Menjaga satu kopling yang gagalnya senyap: daftar kolom yang boleh disunting
 * pengelola ditulis di DUA tempat —
 *
 *   1. EDITABLE_KEYS di components/dashboard/PengelolaDestinasiPanel.tsx
 *   2. affectedKeys().hasOnly([...]) di firestore.rules
 *
 * Kalau keduanya berbeda, tidak ada yang gagal saat build. Yang terjadi:
 * pengelola menekan Simpan dan Firestore menolak seluruh update dengan
 * permission-denied — bukan cuma kolom yang tidak cocok, tapi semuanya. Rules
 * juga hidup di Firebase Console, jadi ketidaksamaan ini gampang lolos review.
 *
 * Dibaca sebagai teks, bukan di-import: file panelnya .tsx dengan 'use client'
 * dan import React, jadi tidak bisa dijalankan `node` polos seperti file ini.
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
const rules = readFileSync(`${ROOT}firestore.rules`, "utf8");

const panelBlock = panel.match(/const EDITABLE_KEYS = \[([\s\S]*?)\]/);
assert.ok(panelBlock, "EDITABLE_KEYS tidak ditemukan di PengelolaDestinasiPanel");

const rulesBlock = rules.match(/hasOnly\(\[([\s\S]*?)\]\)/);
assert.ok(rulesBlock, "hasOnly([...]) tidak ditemukan di firestore.rules");

const panelKeys = keysInBrackets(panelBlock[1]);
const rulesKeys = keysInBrackets(rulesBlock[1]);

assert.deepEqual(
  panelKeys,
  rulesKeys,
  `Daftar kolom pengelola tidak sama.\n` +
    `  panel : ${panelKeys.join(", ")}\n` +
    `  rules : ${rulesKeys.join(", ")}\n` +
    `Samakan keduanya, lalu deploy ulang rules-nya ke Firebase Console.`
);

// Kolom yang tidak boleh ikut walau suatu saat panelnya diperluas: ketiganya
// adalah jalur pengalihan kepemilikan (managerUid) dan penyerobotan perangkat
// milik destinasi lain (stationId, cameraId).
for (const terlarang of ["managerUid", "stationId", "cameraId", "name", "location"]) {
  assert.ok(
    !panelKeys.includes(terlarang),
    `${terlarang} tidak boleh bisa disunting pengelola`
  );
}

assert.ok(panelKeys.length > 0, "daftar kolom kosong — panelnya jadi tidak berguna");

console.log(
  `destinationKeys.check.ts OK — ${panelKeys.length} kolom sinkron: ${panelKeys.join(", ")}`
);
