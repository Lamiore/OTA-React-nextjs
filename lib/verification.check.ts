/**
 * Cek validasi form pengajuan naik role — gerbang yang menahan pengajuan tanpa
 * persetujuan perjanjian. Kalau logikanya rusak, orang bisa jadi mitra atau
 * pengelola tanpa pernah diberi tahu dia harus beli alat dari Lautara.
 *
 * Jalankan: node lib/verification.check.ts
 */
import assert from 'node:assert/strict';
import { AGREEMENT, validateRoleRequest } from './verification.ts';

const lengkap = {
  fullName: 'Budi Santoso',
  phone: '081234567890',
  organization: 'Dive Bahoi',
} as const;

// Kolom wajib kosong ditolak lebih dulu, apa pun rolenya — termasuk yang isinya
// cuma spasi.
assert.equal(
  validateRoleRequest({ ...lengkap, fullName: '   ', requestedRole: 'mitra', agreed: true }),
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

// Belum menyetujui — pesannya menyebut dokumen yang sesuai rolenya.
assert.equal(
  validateRoleRequest({ ...lengkap, requestedRole: 'mitra', agreed: false }),
  'Kamu harus menyetujui Perjanjian Mitra dulu.'
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    requestedRole: 'pengelola',
    destination: 'Bahoi',
    agreed: false,
  }),
  'Kamu harus menyetujui Perjanjian Pengelola dulu.'
);

// agreed yang tidak diisi sama sekali diperlakukan sama dengan belum dicentang.
assert.equal(
  validateRoleRequest({ ...lengkap, requestedRole: 'mitra' }),
  'Kamu harus menyetujui Perjanjian Mitra dulu.'
);

// Kolom kosong dan destinasi diperiksa sebelum persetujuan: jangan suruh orang
// menyetujui perjanjian untuk form yang belum diisi.
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
assert.equal(
  validateRoleRequest({
    ...lengkap,
    requestedRole: 'pengelola',
    destination: '',
    agreed: false,
  }),
  'Pilih destinasi yang ingin dikelola.'
);

// Lengkap dan sudah menyetujui.
assert.equal(
  validateRoleRequest({ ...lengkap, requestedRole: 'mitra', agreed: true }),
  null
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    requestedRole: 'pengelola',
    destination: 'Bahoi',
    agreed: true,
  }),
  null
);

// Tiap role punya dokumen sendiri: versi terisi, tautan berbeda, label berbeda.
for (const role of ['mitra', 'pengelola'] as const) {
  assert.ok(AGREEMENT[role].version.length > 0);
  assert.ok(AGREEMENT[role].path.startsWith('/'));
  assert.ok(AGREEMENT[role].label.length > 0);
}
assert.notEqual(AGREEMENT.mitra.path, AGREEMENT.pengelola.path);
assert.notEqual(AGREEMENT.mitra.label, AGREEMENT.pengelola.label);

console.log('verification.ts OK');
