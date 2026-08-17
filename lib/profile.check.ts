import assert from 'assert';
import { kelengkapanProfil, nikBerbentukSah } from './profile';

/**
 * Uji mandiri lib/profile — jalankan: npx tsx lib/profile.check.ts
 *
 * Yang dijaga di sini cuma satu hal, tapi hal itu yang menentukan lonceng bisa
 * dimatikan atau tidak: profil yang semua syaratnya terisi HARUS 100% dan
 * kurang = 0. Meleset sedikit saja, peringatannya menetap selamanya di navbar
 * tanpa ada yang bisa dilakukan pengguna untuk menghilangkannya.
 */

const lengkap = {
  name: 'Irham',
  phone: '08123',
  city: 'Manado',
  nik: '7171010101010001',
  emailVerified: true,
};

assert.equal(kelengkapanProfil(lengkap).persen, 100);
assert.equal(kelengkapanProfil(lengkap).kurang, 0, 'profil lengkap = lonceng diam');

assert.equal(kelengkapanProfil({}).persen, 0);
assert.equal(kelengkapanProfil({}).kurang, 5);

// Spasi bukan isian. Tanpa ini, satu ketukan spasi mematikan peringatannya
// sambil meninggalkan kolom yang sebenarnya masih kosong.
assert.equal(kelengkapanProfil({ ...lengkap, phone: '   ' }).persen, 80);
assert.equal(kelengkapanProfil({ ...lengkap, name: null }).kurang, 1);

// emailVerified harus benar-benar true — undefined dari dokumen yang belum
// dibaca tidak boleh terhitung selesai.
assert.equal(kelengkapanProfil({ ...lengkap, emailVerified: undefined }).kurang, 1);

// Pembulatan ke bawah: 4 dari 5 = 80, bukan 80-an yang dibulatkan ke atas.
assert.equal(kelengkapanProfil({ ...lengkap, city: '' }).persen, 80);

// ── NIK ──
//
// Yang dijaga: batang kelengkapan tidak boleh bisa dipenuhi ketikan asal.
// Ini satu-satunya pemeriksaan yang ada pada nomor ini — tidak ada pencocokan
// ke Dukcapil di mana pun, jadi lolos di sini TIDAK berarti identitasnya benar.
assert.equal(nikBerbentukSah('7171010101010001'), true);
assert.equal(nikBerbentukSah('123'), false, 'kependekan ditolak');
assert.equal(nikBerbentukSah('71710101010100011'), false, 'kepanjangan ditolak');
assert.equal(nikBerbentukSah('717101010101000a'), false, 'huruf ditolak');
assert.equal(nikBerbentukSah('7171 0101 0101 0001'), false, 'spasi di tengah ditolak');
assert.equal(nikBerbentukSah(' 7171010101010001 '), true, 'spasi di tepi dipangkas');
assert.equal(nikBerbentukSah(''), false);
assert.equal(nikBerbentukSah(null), false);

assert.equal(
  kelengkapanProfil({ ...lengkap, nik: '123' }).kurang,
  1,
  'NIK asal-asalan tidak boleh menutup daftar periksa',
);

console.log('profile.ts OK');
