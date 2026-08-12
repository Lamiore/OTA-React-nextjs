/**
 * Cek pemilihan kamera destinasi. Cabangnya kecil tapi gagalnya senyap: yang
 * salah bukan error, melainkan kamera yang tayang di halaman destinasi publik —
 * entah hilang semua kecuali satu, atau kamera yang sudah dilepas hidup lagi.
 *
 * Jalankan: node lib/destination.check.ts
 */
import assert from 'node:assert/strict';
import {
  descendantIds,
  destinationCameraIds,
  isTopLevel,
  parentOptions,
} from './destination.ts';

// Bentuk sekarang: dipakai apa adanya, urutannya dipertahankan (itu urutan
// tayang yang diatur admin).
assert.deepEqual(destinationCameraIds({ cameraIds: ['a', 'b', 'c'] }), ['a', 'b', 'c']);
assert.deepEqual(destinationCameraIds({ cameraIds: ['b', 'a'] }), ['b', 'a']);

// Dokumen lama tanpa cameraIds: satu kamera di cameraId tetap tayang, tanpa
// perlu migrasi.
assert.deepEqual(destinationCameraIds({ cameraId: 'lama' }), ['lama']);

// cameraIds menang atas cameraId yang tertinggal di dokumen yang sama.
assert.deepEqual(destinationCameraIds({ cameraIds: ['baru'], cameraId: 'lama' }), ['baru']);

// Inti cek ini: array kosong = "sengaja tanpa kamera", BUKAN alasan untuk jatuh
// balik ke cameraId. Kalau ini rusak, admin yang melepas kamera terakhir akan
// melihat kamera lamanya tayang lagi di halaman publik.
assert.deepEqual(
  destinationCameraIds({ cameraIds: [], cameraId: 'lama' }),
  [],
  'cameraIds kosong tidak boleh menghidupkan lagi cameraId lama'
);
assert.deepEqual(destinationCameraIds({ cameraIds: [] }), []);

// Tanpa kamera sama sekali.
assert.deepEqual(destinationCameraIds({}), []);
assert.deepEqual(destinationCameraIds({ cameraId: '' }), []);

// Id kosong di dalam array dibuang — kalau lolos, LiveMonitorPanel akan
// berlangganan doc('cameras', '') dan Firestore melempar error.
assert.deepEqual(destinationCameraIds({ cameraIds: ['a', '', 'b'] }), ['a', 'b']);

// Induk–anak. Yang dijaga di sini: destinasi lama (tanpa field parentId sama
// sekali) harus tetap tampil di beranda. Kalau ini rusak, seluruh katalog
// menghilang dari beranda sekaligus — gagalnya total, bukan satu kartu.
assert.equal(isTopLevel({}), true, 'destinasi lama tanpa parentId tetap tingkat atas');
assert.equal(isTopLevel({ parentId: '' }), true, 'parentId kosong = tingkat atas');
assert.equal(isTopLevel({ parentId: 'abc' }), false);

// Pilihan induk di panel admin. Kawasan berisi spot, spot berisi sub-spot:
//   induk → anak → cucu, lalu satu destinasi lain yang tidak berhubungan.
const pohon = [
  { id: 'induk' },
  { id: 'anak', parentId: 'induk' },
  { id: 'cucu', parentId: 'anak' },
  { id: 'lain' },
];
const ids = (docId: string | null) => parentOptions(pohon, docId).map((d) => d.id);

// Sedang menambah: belum ada dokumennya, jadi semua boleh jadi induk.
assert.deepEqual(ids(null), ['induk', 'anak', 'cucu', 'lain']);

// Inti cek ini: diri sendiri dan seluruh isinya dibuang. Kalau ini rusak, admin
// bisa menaruh sebuah destinasi di dalam isinya sendiri — keduanya hilang dari
// beranda dan halamannya saling memajang, tanpa cara membatalkan.
assert.deepEqual(ids('induk'), ['lain'], 'diri sendiri, anak, dan cucu dibuang');
assert.deepEqual(ids('anak'), ['induk', 'lain'], 'cucu ikut terbuang bersama anak');
assert.deepEqual(ids('cucu'), ['induk', 'anak', 'lain']);
assert.deepEqual(ids('lain'), ['induk', 'anak', 'cucu']);

// Dokumen yang induknya sudah tidak ada tetap muncul sebagai pilihan.
assert.deepEqual(parentOptions([{ id: 'a', parentId: 'hilang' }], 'x').map((d) => d.id), ['a']);

// Data yang terlanjur melingkar (ditulis lewat SDK mentah) harus tetap
// berhenti. Yang dijaga: dasbor admin menggantung saat render, bukan salah isi.
const melingkar = [
  { id: 'a', parentId: 'b' },
  { id: 'b', parentId: 'a' },
];
assert.deepEqual(parentOptions(melingkar, 'a').map((d) => d.id), [], 'penelusuran melingkar berhenti');
assert.deepEqual(parentOptions(melingkar, 'z').map((d) => d.id), ['a', 'b']);

// ── descendantIds: sumber "Mulai dari" pada kartu kawasan ──
// Gagalnya senyap: kartu provinsi diam soal harga (seolah gratis), atau malah
// menyebut harga milik destinasi yang bukan isinya.
// Pohon yang sama dengan cek parentOptions di atas.
assert.deepEqual(descendantIds(pohon, 'induk'), ['anak', 'cucu'], 'cucu ikut, sedalam apa pun');
assert.deepEqual(descendantIds(pohon, 'anak'), ['cucu']);
assert.deepEqual(descendantIds(pohon, 'cucu'), [], 'daun tidak punya isi');
assert.deepEqual(descendantIds(pohon, 'lain'), [], 'yang di luar tidak ikut terseret');
assert.deepEqual(descendantIds(pohon, 'tidak-ada'), []);

// Melingkar: berhenti, bukan menggantung render kartu.
assert.deepEqual(descendantIds(melingkar, 'a'), ['b'], 'lingkaran berhenti setelah satu putaran');

console.log('destination.ts OK');
