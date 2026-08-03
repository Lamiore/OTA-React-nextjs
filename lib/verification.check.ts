/**
 * Cek validasi form pengajuan naik role — gerbang yang menahan pengajuan tanpa
 * persetujuan perjanjian. Kalau logikanya rusak, orang bisa jadi mitra atau
 * pengelola tanpa pernah diberi tahu dia harus beli alat dari Nusa.
 *
 * Jalankan: node lib/verification.check.ts
 */
import assert from 'node:assert/strict';
import {
  AGREEMENT,
  LAND_RIGHTS,
  NEW_DESTINATION,
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

// Kolom wajib kosong ditolak lebih dulu, apa pun rolenya — termasuk yang isinya
// cuma spasi.
assert.equal(
  validateRoleRequest({ ...lengkap, fullName: '   ', requestedRole: 'mitra', agreed: true }),
  'verifyForm.allFieldsRequired'
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    phone: '',
    requestedRole: 'pengelola',
    destination: 'Bahoi',
    agreed: true,
  }),
  'verifyForm.allFieldsRequired'
);

// Pengelola tanpa memilih destinasi.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    requestedRole: 'pengelola',
    destination: '',
    agreed: true,
  }),
  'verifyForm.destRequired'
);

// Belum menyetujui — pesannya menyebut dokumen yang sesuai rolenya.
assert.equal(
  validateRoleRequest({ ...lengkap, requestedRole: 'mitra', agreed: false }),
  'verifyForm.mustAgreeMitra'
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    ...alamat,
    requestedRole: 'pengelola',
    destination: 'Bahoi',
    agreed: false,
  }),
  'verifyForm.mustAgreePengelola'
);

// Pengelola tanpa alamat kirim — paket sensor tidak bisa dikirim ke mana pun.
assert.equal(
  validateRoleRequest({
    ...lengkap,
    ...alamat,
    shippingAddress: '   ',
    requestedRole: 'pengelola',
    destination: 'Bahoi',
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
      requestedRole: 'pengelola',
      destination: 'Bahoi',
      agreed: true,
    }),
    'verifyForm.postalCodeInvalid',
    `kode pos ${JSON.stringify(postalCode)} seharusnya ditolak`
  );
}

// Alamat tidak pernah diminta dari mitra — kameranya dipasang petugas Nusa.
assert.equal(
  validateRoleRequest({ ...lengkap, requestedRole: 'mitra', agreed: true }),
  null
);

// agreed yang tidak diisi sama sekali diperlakukan sama dengan belum dicentang.
assert.equal(
  validateRoleRequest({ ...lengkap, requestedRole: 'mitra' }),
  'verifyForm.mustAgreeMitra'
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
  'verifyForm.allFieldsRequired'
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    requestedRole: 'pengelola',
    destination: '',
    agreed: false,
  }),
  'verifyForm.destRequired'
);

// Lengkap dan sudah menyetujui.
assert.equal(
  validateRoleRequest({ ...lengkap, requestedRole: 'mitra', agreed: true }),
  null
);
assert.equal(
  validateRoleRequest({
    ...lengkap,
    ...alamat,
    requestedRole: 'pengelola',
    destination: 'Bahoi',
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

// --- Usulan destinasi baru -------------------------------------------------

/** Usulan lengkap: yang membedakannya dari pengajuan biasa cuma empat kolom. */
const usulan = {
  newDestination: true,
  destination: 'Pantai Tanjung Merah',
  destinationLocation: 'Desa Tanjung Merah, Kec. Matuari, Kota Bitung, Sulawesi Utara',
  destinationDescription: 'Pantai berpasir hitam, ada gazebo dan warung, ramai akhir pekan.',
  landRights: LAND_RIGHTS[2],
} as const;

const pengaju = { ...lengkap, ...alamat, requestedRole: 'pengelola' } as const;

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

// "Pilih destinasi" tidak boleh muncul di jalur usulan — pesannya harus yang
// menyuruh menulis nama, bukan memilih dari daftar yang memang belum ada isinya.
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

// Pengajuan ke destinasi terdaftar tidak pernah diminta pernyataan hak.
assert.equal(
  validateRoleRequest({ ...pengaju, destination: 'Bahoi', agreed: true }),
  null
);

// Sentinel dropdown tidak boleh bocor jadi nama destinasi yang tersimpan: form
// menukarnya dengan nama yang diketik, jadi nilainya wajib beda dari nama mana pun.
assert.notEqual(NEW_DESTINATION, '');
assert.ok(!LAND_RIGHTS.includes(NEW_DESTINATION as never));

// Tiap role punya dokumen sendiri: versi terisi, tautan berbeda, label berbeda.
for (const role of ['mitra', 'pengelola'] as const) {
  assert.ok(AGREEMENT[role].version.length > 0);
  assert.ok(AGREEMENT[role].path.startsWith('/'));
  assert.ok(AGREEMENT[role].label.length > 0);
}
assert.notEqual(AGREEMENT.mitra.path, AGREEMENT.pengelola.path);
assert.notEqual(AGREEMENT.mitra.label, AGREEMENT.pengelola.label);

console.log('verification.ts OK');
