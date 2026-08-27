/**
 * Cek penjaga unggah foto destinasi.
 *
 * Yang paling penting di sini bukan cabang if-nya, tapi bagian terakhir:
 * batas ukuran hidup di DUA tempat — `MAX_FOTO_BYTES` di klien dan
 * `request.resource.size` di storage.rules. Kalau salah satunya diubah sendirian
 * tidak ada yang gagal saat build: unggahan cuma mulai ditolak Storage dengan
 * pesan mentah, atau sebaliknya berkas kebesaran lolos cek klien lalu tetap
 * ditolak server. Cek ini membaca kedua berkasnya dan menuntut angkanya sama.
 *
 * Jalankan: node lib/storage.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fotoError, MAX_FOTO_BYTES } from './storage.ts';

const MB = 1024 * 1024;
const foto = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: 'pantai.jpg',
  type: 'image/jpeg',
  size: 2 * MB,
  ...over,
});

// ── berkas yang wajar ──
assert.equal(fotoError(foto()), null);
assert.equal(fotoError(foto({ type: 'image/png', name: 'a.png' })), null);
assert.equal(fotoError(foto({ type: 'image/heic' })), null, 'foto iPhone tidak boleh ditolak di klien');
assert.equal(fotoError(foto({ size: MAX_FOTO_BYTES })), null, 'tepat di batas masih boleh');

// ── yang harus ditolak ──
assert.match(fotoError(foto({ type: 'application/pdf', name: 'brosur.pdf' })) ?? '', /bukan gambar/);
assert.match(fotoError(foto({ type: '', name: 'tanpa-tipe' })) ?? '', /bukan gambar/);
// Bukan gambar diperiksa duluan: PDF 50 MB harus disebut "bukan gambar",
// bukan "kebesaran" — yang kedua menyesatkan, seolah versi kecilnya boleh.
assert.match(fotoError(foto({ type: 'application/pdf', size: 50 * MB })) ?? '', /bukan gambar/);
const kebesaran = fotoError(foto({ size: MAX_FOTO_BYTES + 1 })) ?? '';
assert.match(kebesaran, /maksimal 10 MB/);
assert.match(kebesaran, /10\.0 MB/, 'pesannya menyebut ukuran berkasnya, bukan cuma batasnya');

// ── batas klien vs batas rules ──
const rules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
const cocok = rules.match(/request\.resource\.size\s*<\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
assert.ok(cocok, 'storage.rules tidak lagi membatasi request.resource.size — batasnya hilang?');
assert.equal(
  Number(cocok[1]) * MB,
  MAX_FOTO_BYTES,
  `batas di storage.rules (${cocok[1]} MB) beda dengan MAX_FOTO_BYTES (${MAX_FOTO_BYTES / MB} MB)`,
);

// Prefix tempat berkas ditulis juga harus tetap sama dengan yang diizinkan rules.
assert.ok(
  /match \/destinasi\/\{/.test(rules),
  'storage.rules tidak lagi punya blok destinasi/ — lib/storage.ts menulis ke sana',
);

console.log('storage.check.ts: semua lolos');
