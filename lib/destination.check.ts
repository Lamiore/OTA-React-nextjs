/**
 * Cek pemilihan kamera destinasi. Cabangnya kecil tapi gagalnya senyap: yang
 * salah bukan error, melainkan kamera yang tayang di halaman destinasi publik —
 * entah hilang semua kecuali satu, atau kamera yang sudah dilepas hidup lagi.
 *
 * Jalankan: node lib/destination.check.ts
 */
import assert from 'node:assert/strict';
import { destinationCameraIds } from './destination.ts';

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

console.log('destination.ts OK');
