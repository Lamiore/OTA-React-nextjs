/**
 * Cek validasi form pengajuan naik role — gerbang yang menahan pengajuan tanpa
 * persetujuan perjanjian. Kalau logikanya rusak, orang bisa jadi pengelola
 * tanpa pernah diberi tahu dia harus beli alat dari Nusa.
 *
 * Jalankan: node lib/verification.check.ts
 */
import assert from 'node:assert/strict';
import { AGREEMENT, LAND_RIGHTS, validateRoleRequest } from './verification.ts';

const lengkap = {
  fullName: 'Budi Santoso',
  phone: '081234567890',
  organization: 'Dive Bahoi',
} as const;

/** Empat kolom destinasi, wajib di semua pengajuan pengelola sejak dokumennya
 *  dibuat otomatis saat disetujui. Dipakai tes yang menguji hal lain. */
const destinasi = {
  destination: 'Bahoi',
  destinationLocation: 'Desa Bahoi, Kec. Likupang Barat',
  destinationDescription: 'Desa ekowisata pesisir dengan mangrove dan terumbu.',
  landRights: LAND_RIGHTS[2],
  declaredRights: true,
} as const;

// Kolom wajib kosong ditolak lebih dulu — termasuk yang isinya cuma spasi.
assert.equal(
  validateRoleRequest({ ...lengkap, fullName: '   ', agreed: true }),
  'verifyForm.allFieldsRequired'
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    phone: '',
    ...destinasi,
    agreed: true,
  }),
  'verifyForm.allFieldsRequired'
);

// Pengelola tanpa menuliskan nama destinasi.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    destination: '',
    agreed: true,
  }),
  'verifyForm.newDestNameRequired'
);

// Belum menyetujui — form tanpa centang perjanjian selalu ditolak.
assert.equal(
  validateRoleRequest({ ...lengkap, ...destinasi, agreed: false }),
  'verifyForm.mustAgreePengelola',
  'form tanpa centang perjanjian harus ditolak'
);

// agreed yang tidak diisi sama sekali diperlakukan sama dengan belum dicentang.
assert.equal(
  validateRoleRequest({ ...lengkap, ...destinasi }),
  'verifyForm.mustAgreePengelola'
);

// Kolom kosong dan destinasi diperiksa sebelum persetujuan: jangan suruh orang
// menyetujui perjanjian untuk form yang belum diisi.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    organization: '',
    ...destinasi,
    agreed: false,
  }),
  'verifyForm.allFieldsRequired'
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    destination: '',
    agreed: false,
  }),
  'verifyForm.newDestNameRequired'
);

// Lengkap dan sudah menyetujui — tanpa satu pun kolom pengiriman. Ini penjaga
// perubahan v1.3: alamat kirim tidak lagi diminta di formulir, jadi form yang
// isinya cuma data diri + destinasi harus lolos.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    ...destinasi,
    agreed: true,
  }),
  null
);

// --- Destinasi yang dikelola -----------------------------------------------

/** Empat kolom destinasi — sekarang wajib di semua pengajuan pengelola, karena
 *  dokumen destinasinya dibuat dari sini saat pengajuan disetujui. */
const usulan = {
  destination: 'Pantai Tanjung Merah',
  destinationLocation: 'Desa Tanjung Merah, Kec. Matuari, Kota Bitung, Sulawesi Utara',
  destinationDescription: 'Pantai berpasir hitam, ada gazebo dan warung, ramai akhir pekan.',
  landRights: LAND_RIGHTS[2],
} as const;

// Tiap kolom usulan diperiksa satu per satu — kosong dan spasi sama-sama ditolak.
for (const [kolom, isi, pesan] of [
  ['destination', '   ', 'verifyForm.newDestNameRequired'],
  [
    'destinationLocation',
    '',
    'verifyForm.newDestLocationRequired',
  ],
  ['destinationDescription', '  ', 'verifyForm.newDestDescRequired'],
  ['landRights', '', 'verifyForm.landRightsRequired'],
] as const) {
  assert.equal(
    validateRoleRequest({
      ...lengkap,
      ...usulan,
      [kolom]: isi,
      declaredRights: true,
      agreed: true,
    }),
    pesan,
    `${kolom} kosong seharusnya ditolak`
  );
}

// Destinasi ditulis, bukan dipilih: nama kosong selalu minta ditulis, tidak
// pernah menyuruh memilih dari daftar (daftarnya sudah tidak ada di form).
assert.equal(
  validateRoleRequest({ ...lengkap, ...usulan, destination: '', agreed: true }),
  'verifyForm.newDestNameRequired'
);

// Pernyataan hak wajib dicentang, dan diperiksa sebelum perjanjian.
assert.equal(
  validateRoleRequest({ ...lengkap, ...usulan, agreed: true }),
  'verifyForm.declareRightsRequired'
);
assert.equal(
  validateRoleRequest({ ...lengkap, ...usulan, agreed: false }),
  'verifyForm.declareRightsRequired'
);

// Usulan lengkap + dua centang.
assert.equal(
  validateRoleRequest({ ...lengkap, ...usulan, declaredRights: true, agreed: true }),
  null
);

// Nama destinasi saja tidak cukup: lokasi & deskripsi ikut dipakai membuat
// dokumennya saat disetujui, jadi keduanya tetap diminta.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    destination: 'Bahoi',
    declaredRights: true,
    agreed: true,
  }),
  'verifyForm.newDestLocationRequired'
);

// Perjanjian pengelola satu-satunya yang tersisa setelah role mitra dihapus.
assert.equal(AGREEMENT.pengelola.path, '/syarat-pengelola');
assert.ok(/^\d+\.\d+$/.test(AGREEMENT.pengelola.version));
assert.ok(AGREEMENT.pengelola.label.length > 0);

console.log('verification.ts OK');
