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
