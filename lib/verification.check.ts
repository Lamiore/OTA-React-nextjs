/**
 * Cek validasi form pengajuan naik role — gerbang yang menahan pengajuan tanpa
 * persetujuan perjanjian. Kalau logikanya rusak, orang bisa jadi pengelola
 * tanpa pernah diberi tahu dia harus beli alat dari Nusa.
 *
 * Jalankan: node lib/verification.check.ts
 */
import assert from 'node:assert/strict';
import {
  AGREEMENT,
  LAND_RIGHTS,
  packageRecipient,
  validateRoleRequest,
} from './verification.ts';

const lengkap = {
  fullName: 'Budi Santoso',
  phone: '081234567890',
  organization: 'Dive Bahoi',
} as const;

/** Tambahan yang cuma diminta dari pengelola: alamat kirim paket sensor. */
const alamat = {
  shippingAddress: 'Jl. Raya Bahoi No. 12, Desa Bahoi, Kec. Likupang Barat',
  postalCode: '95371',
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
  validateRoleRequest({ ...lengkap, ...alamat, ...destinasi, agreed: false }),
  'verifyForm.mustAgreePengelola',
  'form tanpa centang perjanjian harus ditolak'
);

// agreed yang tidak diisi sama sekali diperlakukan sama dengan belum dicentang.
assert.equal(
  validateRoleRequest({ ...lengkap, ...alamat, ...destinasi }),
  'verifyForm.mustAgreePengelola'
);

// Pengelola tanpa alamat kirim — paket sensor tidak bisa dikirim ke mana pun.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    ...alamat,
    shippingAddress: '   ',
    ...destinasi,
    agreed: true,
  }),
  'verifyForm.shippingRequired'
);

// Kode pos harus tepat lima angka: kosong, kependekan, kepanjangan, bukan angka.
for (const postalCode of ['', '9537', '953712', '9537a', ' 95371 x']) {
  assert.equal(
    validateRoleRequest({
      ...lengkap,
      ...alamat,
      postalCode,
      ...destinasi,
      agreed: true,
    }),
    'verifyForm.postalCodeInvalid',
    `kode pos ${JSON.stringify(postalCode)} seharusnya ditolak`
  );
}

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

// Lengkap dan sudah menyetujui.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    ...alamat,
    ...destinasi,
    agreed: true,
  }),
  null
);

// Penerima paket: kosong jatuh ke pendaftar, terisi menimpanya. Yang isinya
// cuma spasi diperlakukan kosong — bukan nama penerima yang sah.
assert.deepEqual(packageRecipient(lengkap), {
  name: 'Budi Santoso',
  phone: '081234567890',
});
assert.deepEqual(
  packageRecipient({ ...lengkap, recipientName: '  ', recipientPhone: '' }),
  { name: 'Budi Santoso', phone: '081234567890' }
);
assert.deepEqual(
  packageRecipient({ ...lengkap, recipientName: 'Sari', recipientPhone: '082111222333' }),
  { name: 'Sari', phone: '082111222333' }
);
// Satu terisi, satu kosong: yang kosong tetap jatuh ke pendaftar.
assert.deepEqual(packageRecipient({ ...lengkap, recipientName: 'Sari' }), {
  name: 'Sari',
  phone: '081234567890',
});

// --- Destinasi yang dikelola -----------------------------------------------

/** Empat kolom destinasi — sekarang wajib di semua pengajuan pengelola, karena
 *  dokumen destinasinya dibuat dari sini saat pengajuan disetujui. */
const usulan = {
  destination: 'Pantai Tanjung Merah',
  destinationLocation: 'Desa Tanjung Merah, Kec. Matuari, Kota Bitung, Sulawesi Utara',
  destinationDescription: 'Pantai berpasir hitam, ada gazebo dan warung, ramai akhir pekan.',
  landRights: LAND_RIGHTS[2],
} as const;

const pengaju = { ...lengkap, ...alamat } as const;

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
      ...pengaju,
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
  validateRoleRequest({ ...pengaju, ...usulan, destination: '', agreed: true }),
  'verifyForm.newDestNameRequired'
);

// Pernyataan hak wajib dicentang, dan diperiksa sebelum perjanjian.
assert.equal(
  validateRoleRequest({ ...pengaju, ...usulan, agreed: true }),
  'verifyForm.declareRightsRequired'
);
assert.equal(
  validateRoleRequest({ ...pengaju, ...usulan, agreed: false }),
  'verifyForm.declareRightsRequired'
);

// Alamat kirim tetap wajib walau destinasinya usulan — paketnya tetap dikirim.
assert.equal(
  validateRoleRequest({
    ...pengaju,
    ...usulan,
    shippingAddress: '',
    declaredRights: true,
    agreed: true,
  }),
  'verifyForm.shippingRequired'
);

// Usulan lengkap + dua centang.
assert.equal(
  validateRoleRequest({ ...pengaju, ...usulan, declaredRights: true, agreed: true }),
  null
);

// Nama destinasi saja tidak cukup: lokasi & deskripsi ikut dipakai membuat
// dokumennya saat disetujui, jadi keduanya tetap diminta.
assert.equal(
  validateRoleRequest({
    ...pengaju,
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
