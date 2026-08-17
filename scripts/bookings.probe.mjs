/**
 * Uji /api/bookings sebagai PENGGUNA ASLI — ID token sungguhan, bukan Admin SDK.
 * Admin SDK melewati semua penjagaan, jadi menulis lewat dia tidak membuktikan
 * apa pun. Di sini Admin SDK dipakai hanya untuk menyiapkan boneka, mencetak
 * custom token, dan memeriksa hasil akhirnya di database.
 *
 * Yang dibuktikan: harga tidak bisa dikarang klien, status & pembayaran tidak
 * bisa ditulis sendiri, satu QR hanya bisa dipakai sekali, dan tiket yang belum
 * dibayar ditolak di gerbang check-in. Bonekanya dihapus di `finally`.
 *
 * Sejak Midtrans dipasang, jalur lunasnya ikut diuji di sini: tagihan sungguhan
 * diterbitkan ke sandbox Midtrans, lalu notifikasi webhooknya DIPALSUKAN dengan
 * tanda tangan yang dihitung sendiri. Itu sengaja — hanya dengan begitu
 * notifikasi bertanda tangan SALAH bisa ikut diuji, dan Midtrans tidak pernah
 * mengirim yang salah.
 *
 * Jalankan (butuh dev server hidup di port 3111):
 *   ./node_modules/.bin/next dev --port 3111
 *   node scripts/bookings.probe.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cert, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.trim()&&!l.trim().startsWith('#')&&l.includes('='))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));

initAdmin({ credential: cert(JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'))) });
const web = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
// Default localhost; arahkan ke produksi dengan:
//   PROBE_BASE=https://<domain> node bookings.probe.mjs
const BASE = process.env.PROBE_BASE || 'http://localhost:3111';
const API = `${BASE}/api/bookings`;

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '  OK  ' : ' GAGAL'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
}

async function idTokenFor(uid) {
  const custom = await adminAuth().createCustomToken(uid);
  const cred = await signInWithCustomToken(getAuth(web), custom);
  return cred.user.getIdToken();
}

/** uid boneka tambahan yang dibuat di tengah jalan; dibersihkan di `finally`. */
const boneka = [];

/**
 * Pengunjung baru lengkap dengan tokennya.
 *
 * Ada sejak /api/bookings membatasi booking belum-bayar per AKUN: tes yang
 * memerlukan banyak booking menggantung sekaligus (balapan pembayaran) memang
 * harus datang dari banyak orang — memakai satu akun untuk itu bukan cuma
 * kena batasnya, tapi juga tidak pernah mewakili keadaan yang diuji.
 */
async function userBaru(label) {
  const uid = `probe-${label}-${Date.now()}-${boneka.length}`;
  await adminAuth().createUser({ uid, email: `${uid}@probe.local`, emailVerified: true });
  await adminDb().doc(`users/${uid}`).set({ role: 'user' });
  boneka.push(uid);
  return idTokenFor(uid);
}

/**
 * Buang booking yang sudah selesai diperiksa, supaya tidak memakan jatah
 * belum-bayar akun ujinya. Hapus, bukan batalkan: dokumen batal tetap terbaca
 * oleh tes stok di bawah, dan yang ini tidak boleh ikut terhitung di mana pun.
 */
async function lepas(...ids) {
  for (const id of ids) if (id) await adminDb().doc(`bookings/${id}`).delete();
}
async function post(token, body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// ── webhook Midtrans ──
//
// Notifikasi dipalsukan di sini, bukan ditunggu dari Midtrans sungguhan.
// Tanda tangannya dihitung dengan rumus yang sama persis, jadi seluruh jalur
// lunas bisa diuji tanpa membayar apa pun — dan yang paling penting, notifikasi
// dengan tanda tangan SALAH bisa ikut diuji, dan itu mustahil dilakukan lewat
// Midtrans karena dia tidak pernah mengirim yang salah.
const HOOK = `${BASE}/api/payments/midtrans`;

function tandaTangan(orderId, statusCode, gross) {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${gross}${env.MIDTRANS_SERVER_KEY}`)
    .digest('hex');
}

async function webhook(fields) {
  const n = { status_code: '200', transaction_status: 'settlement', payment_type: 'qris', ...fields };
  n.signature_key ??= tandaTangan(n.order_id, n.status_code, n.gross_amount);
  const res = await fetch(HOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(n),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** Lunasi booking lewat jalur asli: terbitkan tagihan, lalu kabari webhook. */
async function lunasi(token, id) {
  const bayar = await post(token, { action: 'pay', bookingId: id });
  const doc = (await adminDb().doc(`bookings/${id}`).get()).data();
  const hasil = await webhook({ order_id: doc.orderId, gross_amount: `${doc.amount}.00` });
  return { bayar, orderId: doc.orderId, amount: doc.amount, hasil };
}

// ── boneka ──
const UID_USER = 'probe-user-' + Date.now();
const UID_PETUGAS = 'probe-petugas-' + Date.now();
const DEST = 'probe-dest-' + Date.now();
const created = [];

await adminAuth().createUser({ uid: UID_USER, email: `${UID_USER}@probe.local`, emailVerified: true });
await adminAuth().createUser({ uid: UID_PETUGAS, email: `${UID_PETUGAS}@probe.local`, emailVerified: true });
await adminDb().doc(`users/${UID_USER}`).set({ role: 'user' });
await adminDb().doc(`users/${UID_PETUGAS}`).set({ role: 'pengelola' });
await adminDb().doc(`destinations/${DEST}`).set({
  name: 'Probe Destinasi', location: 'Probe', parentId: 'induk-yang-tidak-ada',
  priceItems: [
    { id: 'tiket', label: 'Tiket Masuk', price: 25000, unit: '/pax' }, // tanpa stok = tanpa batas
    { id: 'kapal', label: 'Sewa Kapal', price: 300000, unit: '/trip', stock: 2 },
    { id: 'tutup', label: 'Item Ditutup', price: 5000, unit: '/pax', stock: 0 },
    // Dipakai HANYA oleh tes balapan, supaya hitungannya tidak tercampur
    // penjualan dari tes-tes di atas.
    { id: 'kursi', label: 'Kursi Balap', price: 1000, unit: '/pax', stock: 2 },
    // Sewa per jam. Satuannya yang menentukan, bukan field terpisah — lihat
    // isHourly. Stoknya sengaja dibatasi supaya bisa dibuktikan bahwa jam TIDAK
    // ikut memakan stok.
    { id: 'selam', label: 'Sewa Alat Selam', price: 50000, unit: '/jam', stock: 3 },
  ],
});

const besok = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const kemarin = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

try {
  const tokUser = await idTokenFor(UID_USER);

  // 1. Tanpa token → ditolak.
  const anon = await fetch(API, { method: 'POST', body: '{}' });
  check('tanpa token ditolak', anon.status === 401, `status ${anon.status}`);

  // 2. INTI: harga dikarang klien tidak berpengaruh.
  const r = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, guests: 2,
    name: 'Probe', phone: '0800', notes: '',
    qty: { tiket: 2, kapal: 1 },
    amount: 1, items: [{ label: 'Gratis', price: 0, qty: 1 }], // <- upaya curang
    userId: 'orang-lain', status: 'confirmed', paymentStatus: 'paid',
  });
  const id = r.body.id;
  if (id) created.push(id);
  check('booking dibuat', r.status === 200, `status ${r.status}`);
  check('total dihitung server (350000)', r.body.amount === 350000, `dapat ${r.body.amount}`);

  const doc1 = (await adminDb().doc(`bookings/${id}`).get()).data();
  check('status dipaksa pending', doc1.status === 'pending', doc1.status);
  check('pembayaran dipaksa unpaid', doc1.paymentStatus === 'unpaid', doc1.paymentStatus);
  check('userId dipaksa pemanggil', doc1.userId === UID_USER, doc1.userId);
  check('items ditulis ulang server', doc1.items.length === 2 && doc1.amount === 350000);

  // 2a. Sewa per jam: durasi jadi pengali, tapi HANYA untuk item bersatuan jam.
  // Kalau jam bocor ke tiket masuk, tagihannya berlipat tanpa jejak error.
  const jam = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, guests: 1,
    name: 'Probe Jam', phone: '0800', notes: '',
    qty: { tiket: 1, selam: 2 }, hours: 3,
  });
  if (jam.body.id) created.push(jam.body.id);
  // 25.000×1 (tidak dikali jam) + 50.000×2×3 jam = 325.000
  check('total per jam benar (325000)', jam.body.amount === 325000, `dapat ${jam.body.amount}`);
  const docJam = (await adminDb().doc(`bookings/${jam.body.id}`).get()).data();
  const barisTiket = docJam.items.find((i) => i.id === 'tiket');
  const barisSelam = docJam.items.find((i) => i.id === 'selam');
  check('item non-jam tidak membawa durasi', barisTiket.hours === undefined, `${barisTiket.hours}`);
  check('durasi disnapshot ke baris sewa', barisSelam.hours === 3, `${barisSelam.hours}`);

  // 2b. Durasi juga batas kepercayaan — angkanya datang mentah dari jaringan.
  const jamGila = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, guests: 1,
    name: 'Probe Jam', phone: '0800', notes: '', qty: { selam: 1 }, hours: 1e9,
  });
  if (jamGila.body.id) created.push(jamGila.body.id);
  check('durasi raksasa dibatasi 24 jam', jamGila.body.amount === 50000 * 24, `dapat ${jamGila.body.amount}`);
  // Dilepas SEBELUM booking berikutnya, bukan sesudah: nilai baliknya sudah
  // diperiksa, dan jatah belum-bayar akun ini cuma tiga.
  await lepas(jamGila.body.id);

  const jamNol = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, guests: 1,
    name: 'Probe Jam', phone: '0800', notes: '', qty: { selam: 1 }, hours: 0,
  });
  if (jamNol.body.id) created.push(jamNol.body.id);
  check('durasi 0 tidak menggratiskan', jamNol.body.amount === 50000, `dapat ${jamNol.body.amount}`);
  await lepas(jamNol.body.id);

  // 2c. No. HP: nomor pertama jadi bawaan profil, dan booking berikutnya tidak
  // perlu mengirimnya lagi. Kalau salah satu setengahnya putus, yang muncul
  // bukan error melainkan kolom yang tiba-tiba wajib diisi ulang.
  const profil1 = (await adminDb().doc(`users/${UID_USER}`).get()).data();
  check('no. HP pertama tersimpan ke profil', profil1.phone === '0800', String(profil1.phone));

  const tanpaHp = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, qty: { tiket: 1 },
  });
  if (tanpaHp.body.id) created.push(tanpaHp.body.id);
  check('booking tanpa no. HP diterima', tanpaHp.status === 200, `status ${tanpaHp.status}`);
  const docHp = (await adminDb().doc(`bookings/${tanpaHp.body.id}`).get()).data();
  check('no. HP diambil dari profil', docHp?.phone === '0800', String(docHp?.phone));
  await lepas(tanpaHp.body.id);

  // Nomor lain untuk satu booking tidak mengganti bawaan profilnya —
  // memesankan untuk orang lain sekali bukan berarti pindah nomor.
  const hpLain = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, phone: '0899', qty: { tiket: 1 },
  });
  if (hpLain.body.id) created.push(hpLain.body.id);
  // Diperiksa terpisah: booking yang justru DITOLAK juga meninggalkan profil
  // tidak tertimpa, dan tanpa baris ini kegagalan itu terbaca sebagai lolos.
  check('booking dengan nomor lain dibuat', hpLain.status === 200, `status ${hpLain.status} ${hpLain.body.error ?? ''}`);
  const profil2 = (await adminDb().doc(`users/${UID_USER}`).get()).data();
  check('bawaan profil tidak tertimpa nomor booking lain', profil2.phone === '0800', String(profil2.phone));
  await lepas(hpLain.body.id);

  // 2b. Email belum diverifikasi → ditolak server, bukan cuma disembunyikan UI.
  const UID_MENTAH = 'probe-mentah-' + Date.now();
  await adminAuth().createUser({ uid: UID_MENTAH, email: `${UID_MENTAH}@probe.local` });
  await adminDb().doc(`users/${UID_MENTAH}`).set({ role: 'user' });
  const tokMentah = await idTokenFor(UID_MENTAH);
  const mentah = await post(tokMentah, {
    action: 'create', destinationId: DEST, date: besok, guests: 1,
    name: 'P', phone: '08', notes: '', qty: { tiket: 1 },
  });
  check('email belum diverifikasi ditolak', mentah.status === 403, mentah.body.error);
  await adminDb().doc(`users/${UID_MENTAH}`).delete();
  await adminAuth().deleteUser(UID_MENTAH);

  // 3. Tanggal lampau ditolak.
  const lampau = await post(tokUser, {
    action: 'create', destinationId: DEST, date: kemarin, guests: 1,
    name: 'P', phone: '08', notes: '', qty: { tiket: 1 },
  });
  check('tanggal lampau ditolak', lampau.status === 400, lampau.body.error);

  // 4. Item palsu → tidak ada yang bisa dipesan.
  const palsu = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, guests: 1,
    name: 'P', phone: '08', notes: '', qty: { itemKarangan: 5 },
  });
  check('item karangan ditolak', palsu.status === 400, palsu.body.error);

  // 5. Check-in tiket BELUM DIBAYAR → ditolak (ini bug "QR gratis" yang ditutup).
  const tokPetugas = await idTokenFor(UID_PETUGAS);
  const ciUnpaid = await post(tokPetugas, { action: 'checkin', bookingId: id });
  check('check-in belum bayar ditolak', ciUnpaid.body.outcome === 'unpaid', ciUnpaid.body.outcome);

  // 6. User biasa tidak boleh check-in.
  const ciUser = await post(tokUser, { action: 'checkin', bookingId: id });
  check('user biasa tidak bisa check-in', ciUser.status === 403, `status ${ciUser.status}`);

  // 7. Terbitkan tagihan → menahan kursi, TAPI belum lunas.
  const tagih = await post(tokUser, { action: 'pay', bookingId: id });
  check('tagihan QRIS terbit', tagih.status === 200 && !!tagih.body.token, JSON.stringify(tagih.body));
  const docTahan = (await adminDb().doc(`bookings/${id}`).get()).data();
  check('menerbitkan tagihan TIDAK melunasi',
    docTahan.paymentStatus === 'pending' && docTahan.status === 'pending',
    `${docTahan.status}/${docTahan.paymentStatus}`);
  check('kursinya ditahan berbatas waktu', docTahan.holdUntil > Date.now(), `${docTahan.holdUntil}`);

  // INTI: selama tagihan hidup, isinya beku. Tanpa ini, booking 350rb bisa
  // diubah jadi berapa pun lalu dibayar dengan tagihan lama yang murah.
  const ubahSaatBayar = await post(tokUser, {
    action: 'update', bookingId: id, date: besok,
    phone: '08', notes: '', qty: { tiket: 50 },
  });
  check('tidak bisa diubah selagi tagihan hidup',
    ubahSaatBayar.body.error === 'payment-pending', ubahSaatBayar.body.error);
  const batalSaatBayar = await post(tokUser, { action: 'cancel', bookingId: id });
  check('tidak bisa dibatalkan selagi tagihan hidup',
    batalSaatBayar.body.error === 'payment-pending', batalSaatBayar.body.error);

  // Tekan bayar lagi = token yang SAMA, bukan tagihan kedua.
  const tagih2 = await post(tokUser, { action: 'pay', bookingId: id });
  check('tekan bayar lagi memakai tagihan yang sama',
    tagih2.body.token === tagih.body.token, 'token berbeda = kursi tertahan dobel');

  // Notifikasi palsu ditolak — ini satu-satunya autentikasi webhook.
  const palsuTtd = await webhook({
    order_id: docTahan.orderId, gross_amount: `${docTahan.amount}.00`,
    signature_key: 'a'.repeat(128),
  });
  check('webhook tanda tangan palsu ditolak', palsuTtd.status === 403, `status ${palsuTtd.status}`);
  const belumLunas = (await adminDb().doc(`bookings/${id}`).get()).data();
  check('tanda tangan palsu tidak melunasi apa pun',
    belumLunas.paymentStatus === 'pending', belumLunas.paymentStatus);

  // Jumlah yang tidak cocok dengan tagihan ditolak — sabuk pengaman kedua
  // kalau penjaga 'payment-pending' di atas suatu saat bocor.
  const jumlahBeda = await webhook({ order_id: docTahan.orderId, gross_amount: '1000.00' });
  check('webhook jumlah tidak cocok tidak melunasi',
    jumlahBeda.body.hasil === 'jumlah-beda', JSON.stringify(jumlahBeda.body));

  // Sekarang yang asli.
  const lunas = await webhook({ order_id: docTahan.orderId, gross_amount: `${docTahan.amount}.00` });
  check('webhook sah melunasi', lunas.body.hasil === 'lunas', JSON.stringify(lunas.body));
  const doc2 = (await adminDb().doc(`bookings/${id}`).get()).data();
  check('setelah webhook jadi confirmed+paid',
    doc2.status === 'confirmed' && doc2.paymentStatus === 'paid',
    `${doc2.status}/${doc2.paymentStatus}`);
  check('penahanan dilepas setelah lunas', !doc2.holdUntil, `${doc2.holdUntil}`);

  // 8. Notifikasi yang sama datang dua kali tidak boleh menulis ulang.
  const ulang = await webhook({ order_id: docTahan.orderId, gross_amount: `${docTahan.amount}.00` });
  check('webhook diulang idempoten', ulang.body.hasil === 'sudah-lunas', JSON.stringify(ulang.body));
  const bayar2 = await post(tokUser, { action: 'pay', bookingId: id });
  check('bayar ulang tidak dobel', bayar2.body.error === 'already-paid', bayar2.body.error);

  // 9. Orang lain tidak bisa membayar/membatalkan booking ini.
  const tokLain = await idTokenFor(UID_PETUGAS);
  const cancelLain = await post(tokLain, { action: 'cancel', bookingId: id });
  check('orang lain tidak bisa membatalkan', cancelLain.status === 403, `status ${cancelLain.status}`);

  // 10. Check-in sekarang lolos, dan yang kedua ditolak (satu QR sekali masuk).
  const ci1 = await post(tokPetugas, { action: 'checkin', bookingId: id });
  check('check-in lunas berhasil', ci1.body.outcome === 'success', ci1.body.outcome);
  const ci2 = await post(tokPetugas, { action: 'checkin', bookingId: id });
  check('check-in kedua ditolak', ci2.body.outcome === 'already-used', ci2.body.outcome);

  // 11. Tiket yang sudah dipakai tidak bisa dibatalkan.
  const cancelUsed = await post(tokUser, { action: 'cancel', bookingId: id });
  check('batal setelah check-in ditolak', cancelUsed.status === 409, cancelUsed.body.error);

  // ── Ubah booking sebelum dibayar ──
  //
  // Pakai `tiket` yang tanpa batas: blok stok di bawah menghitung kapal/kursi/
  // selam, dan booking uji coba di sini tidak boleh ikut menggeser angkanya.
  const ubahAwal = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok,
    phone: '0800', notes: 'awal', qty: { tiket: 1 },
  });
  const idUbah = ubahAwal.body.id;
  if (idUbah) created.push(idUbah);

  // INTI: sama seperti create, harga & status tidak boleh datang dari klien.
  const ubah = await post(tokUser, {
    action: 'update', bookingId: idUbah, date: besok,
    phone: '0899', notes: 'diubah', qty: { tiket: 3 },
    amount: 1, items: [{ label: 'Gratis', price: 0, qty: 1 }], // <- upaya curang
    status: 'confirmed', paymentStatus: 'paid', userId: 'orang-lain',
    destinationId: 'destinasi-lain',
  });
  check('ubah booking berhasil', ubah.status === 200, JSON.stringify(ubah.body));
  check('total dihitung ulang server (75000)', ubah.body.amount === 75000, `dapat ${ubah.body.amount}`);

  const docUbah = (await adminDb().doc(`bookings/${idUbah}`).get()).data();
  check('items ditulis ulang server saat ubah',
    docUbah.items.length === 1 && docUbah.items[0].qty === 3 && docUbah.amount === 75000,
    JSON.stringify(docUbah.items));
  check('ubah tidak menaikkan status/pembayaran',
    docUbah.status === 'pending' && docUbah.paymentStatus === 'unpaid',
    `${docUbah.status}/${docUbah.paymentStatus}`);
  check('destinasi tidak ikut berpindah', docUbah.destinationId === DEST, docUbah.destinationId);
  check('catatan & telepon ikut tersimpan',
    docUbah.notes === 'diubah' && docUbah.phone === '0899',
    `${docUbah.phone}/${docUbah.notes}`);

  // Booking orang lain tidak bisa diubah — penjagaan yang sama dengan cancel.
  const ubahLain = await post(tokPetugas, {
    action: 'update', bookingId: idUbah, date: besok,
    phone: '08', notes: '', qty: { tiket: 1 },
  });
  check('orang lain tidak bisa mengubah', ubahLain.status === 403, `status ${ubahLain.status}`);

  // Yang sudah dibayar terkunci: `id` sudah lunas (dan malah sudah dipakai
  // masuk) di blok-blok di atas.
  const ubahLunas = await post(tokUser, {
    action: 'update', bookingId: id, date: besok,
    phone: '08', notes: '', qty: { tiket: 1 },
  });
  check('booking lunas tidak bisa diubah', ubahLunas.body.error === 'already-paid', ubahLunas.body.error);

  // Penjagaan yang sama dengan create, karena jalurnya memang sama-sama menulis.
  const ubahLampau = await post(tokUser, {
    action: 'update', bookingId: idUbah, date: kemarin,
    phone: '08', notes: '', qty: { tiket: 1 },
  });
  check('ubah ke tanggal lampau ditolak', ubahLampau.status === 400, ubahLampau.body.error);

  const ubahKosong = await post(tokUser, {
    action: 'update', bookingId: idUbah, date: besok,
    phone: '08', notes: '', qty: { itemKarangan: 9 },
  });
  check('ubah jadi tanpa item ditolak', ubahKosong.status === 400, ubahKosong.body.error);

  // ── Kuota / stok per item ──

  // Booking sewa 2 set × 3 jam dilunasi, supaya bisa dibuktikan yang terpakai
  // 2 (jumlah setnya) dan bukan 6 (set × jam). Kalau jam ikut memakan stok,
  // alat yang masih ada di gudang akan tampil habis.
  await lunasi(tokUser, jam.body.id);

  // GET sisa stok: tanpa autentikasi, dan cuma angka agregat.
  const av = await (await fetch(`${API}?dest=${DEST}&date=${besok}`)).json();
  const byId = Object.fromEntries(av.items.map((a) => [a.id, a]));
  // Satu kapal sudah terjual di tes pembayaran di atas, jadi sisanya 2 - 1.
  check('GET sisa stok tanpa login', byId.kapal?.remaining === 1, JSON.stringify(byId.kapal));
  check('sisa = stok - terjual', byId.kapal?.stock === 2 && byId.kapal?.booked === 1, JSON.stringify(byId.kapal));
  check('item tanpa stok = tanpa batas', byId.tiket?.remaining === null, JSON.stringify(byId.tiket));
  check('stok 0 = habis, bukan tanpa batas', byId.tutup?.remaining === 0, JSON.stringify(byId.tutup));
  check('jam TIDAK memakan stok (2 set × 3 jam = 2 terpakai)',
    byId.selam?.booked === 2 && byId.selam?.remaining === 1,
    JSON.stringify(byId.selam));

  // Item berstok 0 tidak bisa dipesan sama sekali.
  const tutup = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, guests: 1,
    name: 'P', phone: '08', notes: '', qty: { tutup: 1 },
  });
  check('item berstok 0 ditolak', tutup.status === 409, tutup.body.error);

  // Minta melebihi sisa langsung ditolak saat membuat booking.
  const lebih = await post(tokUser, {
    action: 'create', destinationId: DEST, date: besok, guests: 1,
    name: 'P', phone: '08', notes: '', qty: { kapal: 2 },
  });
  check('minta 2 padahal sisa 1 ditolak', lebih.status === 409, lebih.body.error);

  // ── INTI: balapan pembayaran ──
  //
  // Stok kursi 2, belum terjual sama sekali. Bikin 4 booking (@1 kursi) — semuanya lolos,
  // karena booking yang belum dibayar memang tidak menahan stok. Lalu keempatnya
  // MENERBITKAN TAGIHAN SERENTAK. Tepat 2 boleh lolos; kalau lebih, kuotanya jebol.
  //
  // Titik pengikatnya sekarang penerbitan tagihan, bukan pelunasan — dan justru
  // di situlah letak seluruh gunanya: kalau empat orang sama-sama dapat QR untuk
  // dua kursi, dua di antaranya membayar uang sungguhan untuk kursi yang tidak
  // ada, dan itu jadi kasus refund, bukan sekadar pesan galat.
  //
  // Empat AKUN berbeda, bukan satu akun empat kali: sejak booking belum-bayar
  // dibatasi 3 per akun, satu akun tidak akan sampai ke booking keempat — dan
  // empat orang memang yang sebenarnya diwakili di sini.
  const balap = [];
  const tokBalap = [];
  for (let i = 0; i < 4; i++) {
    const tok = await userBaru(`balap${i}`);
    const b = await post(tok, {
      action: 'create', destinationId: DEST, date: besok, guests: 1,
      name: 'Balap', phone: '08', notes: '', qty: { kursi: 1 },
    });
    balap.push(b.body.id);
    tokBalap.push(tok);
    created.push(b.body.id);
  }
  check('4 booking belum bayar semua lolos', balap.every(Boolean), 'stok tidak ditahan sebelum bayar');

  const hasilBayar = await Promise.all(
    balap.map((id, i) => post(tokBalap[i], { action: 'pay', bookingId: id })),
  );
  const sukses = hasilBayar.filter((r) => r.status === 200).length;
  const ditolak = hasilBayar.filter((r) => r.body.error === 'full').length;
  check('tagihan serentak: tepat 2 lolos', sukses === 2, `${sukses} lolos`);
  check('sisanya ditolak karena penuh', ditolak === 2, `${ditolak} ditolak`);

  // Verifikasi ke DATABASE, bukan cuma percaya nilai balik route. Yang dihitung
  // termasuk yang masih menahan: kursinya sudah tidak bisa dijual lagi walau
  // uangnya belum masuk, dan itulah yang sedang dibuktikan.
  const lunasIdx = balap.map((_, i) => i).filter((i) => hasilBayar[i].status === 200);
  const lunasIds = lunasIdx.map((i) => balap[i]);
  for (const bid of lunasIds) {
    const d = (await adminDb().doc(`bookings/${bid}`).get()).data();
    await webhook({ order_id: d.orderId, gross_amount: `${d.amount}.00` });
  }
  const terjual = (await adminDb().collection('bookings')
    .where('destinationId', '==', DEST).where('date', '==', besok)
    .where('paymentStatus', '==', 'paid').get())
    .docs.flatMap((d) => d.data().items ?? [])
    .filter((it) => it.id === 'kursi')
    .reduce((s, it) => s + it.qty, 0);
  check('kursi terjual di DB tepat 2 (= stok)', terjual === 2, `terjual ${terjual}`);

  // Pembatalan mengembalikan stok. Dibatalkan oleh pemiliknya sendiri —
  // booking ini sekarang milik salah satu boneka balapan, bukan tokUser.
  await post(tokBalap[lunasIdx[0]], { action: 'cancel', bookingId: lunasIds[0] });
  const av2 = await (await fetch(`${API}?dest=${DEST}&date=${besok}`)).json();
  const kursi2 = av2.items.find((a) => a.id === 'kursi');
  check('batal mengembalikan stok', kursi2.remaining === 1, `sisa ${kursi2.remaining}`);

  // ── Batas booking belum-bayar per akun ──
  //
  // Penjaga sampah, bukan penjaga uang: yang menahan kursi tetap tagihan 15
  // menit. Yang dijaga di sini adalah satu akun menyemprot booking yang tidak
  // akan pernah dibayar sampai daftar pengelola tidak terbaca lagi.
  //
  // Akun sendiri, bukan tokUser: yang diuji justru angka per akunnya.
  const tokBatas = await userBaru('batas');
  const pesanSatu = () => post(tokBatas, {
    action: 'create', destinationId: DEST, date: besok, phone: '08', qty: { tiket: 1 },
  });

  const batasIds = [];
  for (let i = 0; i < 3; i++) {
    const b = await pesanSatu();
    batasIds.push(b.body.id);
    if (b.body.id) created.push(b.body.id);
  }
  check('3 booking belum bayar masih boleh', batasIds.every(Boolean), batasIds.join(', '));

  const keempat = await pesanSatu();
  check(
    'booking keempat ditolak',
    keempat.status === 409 && keempat.body.error === 'too-many-unpaid',
    `${keempat.status} ${keempat.body.error}`,
  );

  // Jatahnya harus kembali. Kalau tidak, satu akun yang salah pesan tiga kali
  // terkunci selamanya — dan itu bukan penjaga sampah lagi, itu pintu tertutup.
  await post(tokBatas, { action: 'cancel', bookingId: batasIds[0] });
  const lagi = await pesanSatu();
  if (lagi.body.id) created.push(lagi.body.id);
  check('batal mengembalikan jatah', lagi.status === 200, `status ${lagi.status} ${lagi.body.error ?? ''}`);

  // Path injection: id berisi garis miring tidak boleh menunjuk dokumen lain.
  const injeksi = await post(tokUser, {
    action: 'create', destinationId: `${DEST}/x/y`, date: besok, guests: 1,
    name: 'P', phone: '08', notes: '', qty: { tiket: 1 },
  });
  check('id ber-slash ditolak', injeksi.status === 400, injeksi.body.error);

} finally {
  for (const id of created) await adminDb().doc(`bookings/${id}`).delete();
  await adminDb().doc(`destinations/${DEST}`).delete();
  await adminDb().doc(`users/${UID_USER}`).delete();
  await adminDb().doc(`users/${UID_PETUGAS}`).delete();
  await adminAuth().deleteUser(UID_USER);
  await adminAuth().deleteUser(UID_PETUGAS);
  for (const uid of boneka) {
    await adminDb().doc(`users/${uid}`).delete();
    await adminAuth().deleteUser(uid);
  }
}

console.log(`\n${pass} lolos, ${fail} gagal`);
process.exit(fail ? 1 : 0);
