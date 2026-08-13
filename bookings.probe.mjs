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
 * Jalankan (butuh dev server hidup di port 3111):
 *   npx next dev -p 3111
 *   node bookings.probe.mjs
 */
import { readFileSync } from 'node:fs';
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
async function post(token, body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
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

  // 7. Bayar → naik ke confirmed.
  const bayar = await post(tokUser, { action: 'pay', bookingId: id, method: 'transfer' });
  check('bayar berhasil', bayar.status === 200, JSON.stringify(bayar.body));
  const doc2 = (await adminDb().doc(`bookings/${id}`).get()).data();
  check('setelah bayar jadi confirmed+paid',
    doc2.status === 'confirmed' && doc2.paymentStatus === 'paid',
    `${doc2.status}/${doc2.paymentStatus}`);

  // 8. Bayar dua kali ditolak.
  const bayar2 = await post(tokUser, { action: 'pay', bookingId: id, method: 'transfer' });
  check('bayar ulang tidak dobel', bayar2.body.outcome === 'already-paid', bayar2.body.outcome);

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

  // ── Kuota / stok per item ──

  // GET sisa stok: tanpa autentikasi, dan cuma angka agregat.
  const av = await (await fetch(`${API}?dest=${DEST}&date=${besok}`)).json();
  const byId = Object.fromEntries(av.items.map((a) => [a.id, a]));
  // Satu kapal sudah terjual di tes pembayaran di atas, jadi sisanya 2 - 1.
  check('GET sisa stok tanpa login', byId.kapal?.remaining === 1, JSON.stringify(byId.kapal));
  check('sisa = stok - terjual', byId.kapal?.stock === 2 && byId.kapal?.booked === 1, JSON.stringify(byId.kapal));
  check('item tanpa stok = tanpa batas', byId.tiket?.remaining === null, JSON.stringify(byId.tiket));
  check('stok 0 = habis, bukan tanpa batas', byId.tutup?.remaining === 0, JSON.stringify(byId.tutup));

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
  // MEMBAYAR SERENTAK. Tepat 2 boleh lolos; kalau lebih, kuotanya jebol.
  const balap = [];
  for (let i = 0; i < 4; i++) {
    const b = await post(tokUser, {
      action: 'create', destinationId: DEST, date: besok, guests: 1,
      name: 'Balap', phone: '08', notes: '', qty: { kursi: 1 },
    });
    balap.push(b.body.id);
    created.push(b.body.id);
  }
  check('4 booking belum bayar semua lolos', balap.every(Boolean), 'stok tidak ditahan sebelum bayar');

  const hasilBayar = await Promise.all(
    balap.map((id) => post(tokUser, { action: 'pay', bookingId: id, method: 'transfer' })),
  );
  const sukses = hasilBayar.filter((r) => r.status === 200).length;
  const ditolak = hasilBayar.filter((r) => r.body.error === 'full').length;
  check('bayar serentak: tepat 2 lolos', sukses === 2, `${sukses} lolos`);
  check('sisanya ditolak karena penuh', ditolak === 2, `${ditolak} ditolak`);

  // Verifikasi ke DATABASE, bukan cuma percaya nilai balik route.
  const terjual = (await adminDb().collection('bookings')
    .where('destinationId', '==', DEST).where('date', '==', besok)
    .where('paymentStatus', '==', 'paid').get())
    .docs.flatMap((d) => d.data().items ?? [])
    .filter((it) => it.id === 'kursi')
    .reduce((s, it) => s + it.qty, 0);
  check('kursi terjual di DB tepat 2 (= stok)', terjual === 2, `terjual ${terjual}`);

  // Pembatalan mengembalikan stok.
  const lunasIds = balap.filter((_, i) => hasilBayar[i].status === 200);
  await post(tokUser, { action: 'cancel', bookingId: lunasIds[0] });
  const av2 = await (await fetch(`${API}?dest=${DEST}&date=${besok}`)).json();
  const kursi2 = av2.items.find((a) => a.id === 'kursi');
  check('batal mengembalikan stok', kursi2.remaining === 1, `sisa ${kursi2.remaining}`);

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
}

console.log(`\n${pass} lolos, ${fail} gagal`);
process.exit(fail ? 1 : 0);
