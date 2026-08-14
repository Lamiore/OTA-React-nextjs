/**
 * Cek pemilihan kamera destinasi. Cabangnya kecil tapi gagalnya senyap: yang
 * salah bukan error, melainkan kamera yang tayang di halaman destinasi publik —
 * entah hilang semua kecuali satu, atau kamera yang sudah dilepas hidup lagi.
 *
 * Jalankan: node lib/destination.check.ts
 */
import assert from 'node:assert/strict';
import {
  availability,
  bookedPerItem,
  bookingLines,
  bookingTotal,
  descendantIds,
  destinationCameraIds,
  getPriceItems,
  isHourly,
  isTopLevel,
  lineTotal,
  MAX_HOURS,
  MAX_QTY,
  overStock,
  parentOptions,
  resolveHours,
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

// ── Harga & total booking ──
//
// Jalur uang. Rumus ini dipakai DUA kali: sekali di ringkasan halaman booking,
// sekali lagi di /api/bookings untuk menghitung tagihan sebenarnya. Selama
// keduanya memanggil fungsi yang sama, angkanya tidak bisa berbeda — cek ini
// yang menjaga fungsinya tetap satu dan perilakunya tidak diam-diam berubah.

const daftar = [
  { id: 'tiket', label: 'Tiket Masuk', price: 25000, unit: '/pax' },
  { id: 'kapal', label: 'Sewa Kapal', price: 300000, unit: '/trip' },
];

assert.deepEqual(bookingLines(daftar, { tiket: 2 }), [
  { id: 'tiket', label: 'Tiket Masuk', price: 25000, qty: 2 },
]);
assert.equal(bookingTotal(bookingLines(daftar, { tiket: 2, kapal: 1 })), 350000);

// Batas kepercayaan. Body permintaan datang mentah dari jaringan, dan tiap
// baris di bawah ini pernah bisa jadi tagihan kalau tidak disaring: harga
// negatif yang mengurangi total, pecahan yang bikin rupiah berkoma, dan
// jumlah raksasa yang bikin total meledak.
assert.deepEqual(bookingLines(daftar, { tiket: -5 }), [], 'jumlah negatif digugurkan');
assert.deepEqual(bookingLines(daftar, { tiket: 0 }), [], 'nol bukan pesanan');
assert.deepEqual(bookingLines(daftar, { tiket: 'abc' }), [], 'bukan angka digugurkan');
assert.deepEqual(bookingLines(daftar, { tiket: Infinity }), [], 'Infinity digugurkan');
assert.equal(bookingLines(daftar, { tiket: 2.9 })[0].qty, 2, 'pecahan dibulatkan ke bawah');
assert.equal(bookingLines(daftar, { tiket: 1e9 })[0].qty, MAX_QTY, 'jumlah dibatasi');

// Item yang tidak ada di daftar harga destinasi diabaikan — bukan diterima
// dengan harga karangan, bukan pula error. Kalau ini rusak, siapa pun bisa
// menyelipkan id item palsu ke dalam permintaan.
assert.deepEqual(bookingLines(daftar, { palsu: 3 }), [], 'id item asing diabaikan');

// Harga rusak di dokumen destinasi (mis. tersimpan sebagai teks) tidak boleh
// menjalar jadi total NaN.
const rusak = [{ id: 'x', label: 'X', price: 'gratis' as unknown as number, unit: '/pax' }];
assert.deepEqual(bookingLines(rusak, { x: 1 }), [], 'harga bukan angka digugurkan');
assert.equal(bookingTotal(bookingLines(rusak, { x: 1 })), 0);

// Fallback dokumen legacy: masih bisa dipesan tanpa migrasi manual.
assert.equal(getPriceItems({ priceStart: 15000 })[0].price, 15000);
assert.deepEqual(getPriceItems({ priceItems: [] }), [], 'daftar kosong = sengaja tanpa harga');

// ── Stok per item ──
//
// Yang dijaga di sini bukan aritmetikanya (itu penjumlahan biasa), melainkan
// SIAPA yang menghabiskan stok. Salah satu baris di bawah ini bergeser dan
// akibatnya tidak terlihat sebagai error: kursi terjual dua kali, atau kursi
// mati padahal bookingnya sudah dibatalkan berbulan-bulan lalu.

const lunas = (id: string, qty: number, extra: Record<string, unknown> = {}) => ({
  paymentStatus: 'paid',
  items: [{ id, label: id, price: 1, qty }],
  ...extra,
});

// Yang lunas dihitung; yang belum bayar TIDAK menahan stok.
assert.deepEqual(bookedPerItem([lunas('kapal', 2)]), { kapal: 2 });
assert.deepEqual(
  bookedPerItem([{ paymentStatus: 'unpaid', items: [{ id: 'kapal', label: 'K', price: 1, qty: 5 }] }]),
  {},
  'booking belum dibayar tidak menahan stok',
);

// Dibatalkan setelah lunas mengembalikan stoknya.
assert.deepEqual(
  bookedPerItem([lunas('kapal', 2, { status: 'cancelled' })]),
  {},
  'pembatalan melepas kursi',
);

// Sudah dipakai masuk tetap menghabiskan stok — orangnya memang sudah di sana.
assert.deepEqual(bookedPerItem([lunas('kapal', 1, { status: 'used' })]), { kapal: 1 });

// Booking lama tanpa id item tidak diatribusikan ke item mana pun.
assert.deepEqual(
  bookedPerItem([{ paymentStatus: 'paid', items: [{ label: 'Tiket', price: 1, qty: 9 }] }]),
  {},
  'baris tanpa id diabaikan, bukan ditebak dari label',
);

// Inti sentinel stok: undefined = tanpa batas, 0 = habis. Membalik keduanya
// menjual habis-habisan item yang justru sedang ditutup.
const stokItems = [
  { id: 'bebas', label: 'Tiket', price: 1, unit: '/pax' }, // stock undefined
  { id: 'tutup', label: 'Kapal', price: 1, unit: '/trip', stock: 0 },
  { id: 'batas', label: 'Kamar', price: 1, unit: '/malam', stock: 3 },
];
const av = availability(stokItems, { batas: 1 });
assert.equal(av[0].remaining, null, 'stock undefined = tanpa batas');
assert.equal(av[1].remaining, 0, 'stock 0 = habis, BUKAN tanpa batas');
assert.equal(av[2].remaining, 2, '3 stok - 1 terjual = sisa 2');

// overStock: yang muat lolos, yang lewat disebut namanya.
assert.deepEqual(overStock([{ id: 'batas', label: 'Kamar', price: 1, qty: 2 }], stokItems, { batas: 1 }), []);
assert.deepEqual(
  overStock([{ id: 'batas', label: 'Kamar', price: 1, qty: 3 }], stokItems, { batas: 1 }),
  ['Kamar'],
  'minta 3 padahal sisa 2 ditolak',
);
assert.deepEqual(
  overStock([{ id: 'tutup', label: 'Kapal', price: 1, qty: 1 }], stokItems, {}),
  ['Kapal'],
  'item berstok 0 tidak bisa dipesan sama sekali',
);
assert.deepEqual(
  overStock([{ id: 'bebas', label: 'Tiket', price: 1, qty: 999 }], stokItems, {}),
  [],
  'item tanpa batas tidak pernah penuh',
);

// bookingLines sekarang membawa id — tanpa ini stok tidak bisa dihitung sama sekali.
assert.equal(bookingLines(daftar, { tiket: 1 })[0].id, 'tiket');

// ── Sewa per jam ──
//
// Dua hal dijaga di sini dan dua-duanya gagal secara senyap. Pertama, durasi
// dikenali dari teks `unit` yang ditulis bebas oleh pengelola — salah membaca
// berarti tagihan meleset berlipat, bukan error. Kedua, `hours` tidak ada pada
// SATU pun booking yang sudah tersimpan, jadi tiap pembacaan wajib `?? 1`.

assert.equal(isHourly({ unit: '/jam' }), true);
assert.equal(isHourly({ unit: 'per jam' }), true);
assert.equal(isHourly({ unit: 'perjam' }), true, 'tanpa spasi tetap terbaca');
assert.equal(isHourly({ unit: '/hour' }), true);
assert.equal(isHourly({ unit: '/hrs' }), true);
assert.equal(isHourly({ unit: '/pax' }), false);
assert.equal(isHourly({ unit: '/malam' }), false);
assert.equal(isHourly({ unit: '/jamur' }), false, '"jamur" bukan satuan waktu');
assert.equal(isHourly({ unit: '' }), false);

// Durasi dari jaringan: sama mentahnya dengan jumlah, jadi disaring sama ketat.
assert.equal(resolveHours(3), 3);
assert.equal(resolveHours(undefined), 1, 'tanpa durasi = sekali bayar');
assert.equal(resolveHours(0), 1, '0 jam bukan gratis');
assert.equal(resolveHours(-4), 1);
assert.equal(resolveHours('abc'), 1);
assert.equal(resolveHours(Infinity), 1);
assert.equal(resolveHours(2.9), 2, 'pecahan dibulatkan ke bawah');
assert.equal(resolveHours(1e9), MAX_HOURS, 'durasi dibatasi');

const sewa = [
  { id: 'tiket', label: 'Tiket Masuk', price: 25000, unit: '/pax' },
  { id: 'selam', label: 'Sewa Alat Selam', price: 50000, unit: '/jam' },
];

// Jam cuma menempel pada item per jam. Kalau bocor ke tiket masuk, tiket
// masuk ikut dikali durasi dan tagihannya berlipat tanpa ada yang tahu.
const barisSewa = bookingLines(sewa, { tiket: 2, selam: 1 }, 3);
assert.equal(barisSewa[0].hours, undefined, 'item non-jam tidak membawa durasi');
assert.equal(barisSewa[1].hours, 3);
assert.equal(bookingTotal(barisSewa), 25000 * 2 + 50000 * 3);

// `hours: undefined` tidak boleh IKUT TERSIMPAN — Firestore menolak undefined
// dan penyimpanannya melempar. Yang benar: kuncinya memang tidak ada.
assert.equal('hours' in barisSewa[0], false, 'kunci hours tidak dipasang sama sekali');

// Booking lama tanpa hours tetap terbaca — ini yang menjaga 'Rp NaN' tidak
// muncul di tiket yang sudah terbit.
assert.equal(lineTotal({ label: 'Lama', price: 10000, qty: 2 }), 20000);
assert.equal(bookingTotal([{ label: 'Lama', price: 10000, qty: 2 }]), 20000);

// Durasi TIDAK ikut menghabiskan stok: 1 set alat selam tetap 1 set, dipinjam
// sejam atau enam jam. Kalau baris ini bergeser, stok habis berlipat diam-diam.
assert.deepEqual(
  bookedPerItem([{ paymentStatus: 'paid', items: [{ id: 'selam', label: 'S', price: 1, qty: 2, hours: 6 }] }]),
  { selam: 2 },
  'stok menghitung barangnya, bukan jam-nya',
);

console.log('destination.ts OK');
