/**
 * Cek cepat parser koordinat & nomor WhatsApp — dua fungsi yang punya cabang
 * dan validasi, jadi kalau logikanya rusak ini yang jatuh duluan.
 *
 * Jalankan: node lib/format.check.ts
 */
import assert from 'node:assert/strict';
import {
  formatTimestamp,
  isoDate,
  nextDays,
  normalizeViewerEmail,
  parseCoords,
  waLink,
} from './format.ts';

// Koordinat — bentuk yang disalin Google Maps.
assert.deepEqual(parseCoords('1.4508, 125.0917'), { lat: 1.4508, lng: 125.0917 });
assert.deepEqual(parseCoords('  -8.65,115.216  '), { lat: -8.65, lng: 115.216 });
assert.deepEqual(parseCoords('1.4508,125.0917'), { lat: 1.4508, lng: 125.0917 });

// Ditolak: kosong, satu angka, ada teks, di luar rentang.
assert.equal(parseCoords(''), null);
assert.equal(parseCoords('1.4508'), null);
assert.equal(parseCoords('1.4508, 125.0917 Bahoi'), null);
assert.equal(parseCoords('91, 125'), null);
assert.equal(parseCoords('1, 181'), null);

// WhatsApp — semua bentuk lokal bermuara ke nomor internasional yang sama.
const expected = 'https://wa.me/6281234567890';
assert.equal(waLink('081234567890'), expected);
assert.equal(waLink('+62 812-3456-7890'), expected);
assert.equal(waLink('6281234567890'), expected);
assert.equal(waLink('81234567890'), expected);

// Teks awal ikut ter-encode.
assert.equal(waLink('081234567890', 'Halo, Bahoi?'), `${expected}?text=Halo%2C%20Bahoi%3F`);

// Terlalu pendek → null supaya tombolnya disembunyikan, bukan chat yang gagal.
assert.equal(waLink(''), null);
assert.equal(waLink('0812345'), null);

// Tanggal — Timestamp Firestore hanya dikenali lewat toDate(). Tanggal lokal
// dipakai supaya hasilnya tidak bergeser mengikuti zona waktu pelaksana.
assert.equal(formatTimestamp({ toDate: () => new Date(2026, 6, 30) }), '30 Jul 2026');

// Bukan timestamp → null, supaya pemanggil bisa menyembunyikan barisnya.
assert.equal(formatTimestamp(null), null);
assert.equal(formatTimestamp(undefined), null);
assert.equal(formatTimestamp({}), null);
assert.equal(formatTimestamp('30 Juli 2026'), null);
assert.equal(formatTimestamp({ toDate: () => new Date('bukan tanggal') }), null);

// ── normalizeViewerEmail ──
//
// Kenapa ini dijaga: rules mencocokkan `request.auth.token.email` dengan daftar
// `viewers` memakai operator `in`, yang membandingkan string persis. ID token
// selalu memuat email huruf kecil (route verify-code memasukkannya sudah
// dinormalkan), sedangkan pengelola mengetik bebas. Kalau "Orang@Mail.com"
// tersimpan apa adanya, orangnya tidak akan pernah bisa menonton — dan gagalnya
// muncul sebagai "akses ditolak", bukan sebagai kesalahan input. Nyaris mustahil
// dilacak dari gejalanya.

assert.equal(
  normalizeViewerEmail('Orang@Mail.com'),
  'orang@mail.com',
  'huruf besar harus diturunkan'
);

assert.equal(
  normalizeViewerEmail('  orang@mail.com  '),
  'orang@mail.com',
  'spasi tepi hasil salin-tempel harus dibuang'
);

assert.equal(
  normalizeViewerEmail(' ORANG@MAIL.COM '),
  'orang@mail.com',
  'spasi dan huruf besar sekaligus'
);

assert.equal(
  normalizeViewerEmail('orang@mail.com'),
  'orang@mail.com',
  'yang sudah normal tidak berubah'
);

// ── Tanggal lokal ──
//
// Yang dijaga: isoDate memakai jam LOKAL, bukan UTC. Cara membuktikannya tanpa
// mengganti zona waktu mesin adalah membandingkan dengan getFullYear/getMonth/
// getDate — trio yang menurut definisi memang lokal. Kalau suatu saat isoDate
// diam-diam diganti toISOString(), assert ini jatuh di zona mana pun yang
// bergeser dari UTC pada jam tesnya dijalankan.
const lokal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

for (const jam of [0, 1, 7, 12, 16, 23]) {
  const d = new Date(2026, 7, 14, jam, 30);
  assert.equal(isoDate(d), lokal(d), `jam ${jam} tetap tanggal lokal`);
}

// Titik paling rawan: sesaat setelah tengah malam lokal. Di WITA jam itu masih
// kemarin menurut UTC, dan justru itulah bug yang fungsi ini ada untuk cegah.
const lewatTengahMalam = new Date(2026, 7, 14, 0, 5);
assert.equal(isoDate(lewatTengahMalam), '2026-08-14');

// nextDays: maju saja, dimulai dari harinya sendiri, dan pergantian bulan benar.
assert.deepEqual(nextDays(3, new Date(2026, 7, 14)), ['2026-08-14', '2026-08-15', '2026-08-16']);
assert.deepEqual(
  nextDays(3, new Date(2026, 7, 30)),
  ['2026-08-30', '2026-08-31', '2026-09-01'],
  'ganti bulan'
);
assert.deepEqual(
  nextDays(2, new Date(2026, 11, 31)),
  ['2026-12-31', '2027-01-01'],
  'ganti tahun'
);
assert.deepEqual(
  nextDays(3, new Date(2028, 1, 28)),
  ['2028-02-28', '2028-02-29', '2028-03-01'],
  'tahun kabisat'
);
assert.deepEqual(nextDays(0), [], 'nol hari = tidak ada kartu');

// Tanggal awal tidak boleh ikut bergeser — pemanggil memakai objek Date-nya
// sendiri, dan strip yang menggeser 'hari ini' milik pemanggil akan merusak
// batas minimal input tanggal di halaman yang sama.
const awal = new Date(2026, 7, 14);
nextDays(5, awal);
assert.equal(isoDate(awal), '2026-08-14', 'argumennya tidak dimutasi');

console.log('format.ts OK');
