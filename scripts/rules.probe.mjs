/**
 * Probe firestore.rules sebagai PENGGUNA ASLI, bukan Admin SDK.
 *
 * Admin SDK melewati rules sepenuhnya, jadi menulis lewat dia tidak membuktikan
 * apa pun. Di sini Admin SDK dipakai hanya untuk dua hal: menyiapkan boneka
 * (akun + dokumen) dan mencetak custom token. Seluruh tulis/baca yang diuji
 * lewat Web SDK, dari akun yang sudah masuk — persis jalur yang dipakai browser.
 *
 * Bonekanya dibuat lalu dihapus di `finally`. `parentId` induk boneka sengaja
 * menunjuk dokumen yang tidak ada, supaya selama beberapa detik itu dia tidak
 * ikut tampil di beranda maupun di halaman destinasi mana pun.
 *
 * Jalankan: node rules.probe.mjs
 */
import { readFileSync } from 'node:fs';
import { cert, initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, query, setDoc, updateDoc, where } from 'firebase/firestore';

// ── env ──
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const webConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const adminApp = initAdminApp({
  credential: cert(JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))),
});
const adb = getAdminFirestore(adminApp);
const aauth = getAdminAuth(adminApp);

// ── boneka ──
const P = 'zzprobe';
const UID_A = `${P}_pengelola_a`; // punya induk boneka + kamera boneka
const UID_B = `${P}_pengelola_b`; // pengelola lain — untuk uji serobot
const UID_C = `${P}_user_c`; // pengguna biasa, bukan penonton siapa pun

const PARENT_A = `${P}_parent_a`;
const PARENT_B = `${P}_parent_b`;
const TOPLEVEL_A = `${P}_toplevel_a`; // milik A, TANPA parentId
const CHILD_A = `${P}_child_a`; // milik A, punya parentId — boleh dihapus A
const NEW_OK = `${P}_new_ok`;
const NEW_BAD = `${P}_new_bad`;
const BOOK_C = `${P}_booking_c`; // booking milik C — dipakai uji tulis-sendiri
const BOOK_A = `${P}_booking_a`; // booking milik A — dipakai uji baca punya orang
const CAM_PUB = `${P}_cam_public`;
const CAM_PRIV = `${P}_cam_private`;

const users = [
  [UID_A, 'pengelola'],
  [UID_B, 'pengelola'],
  [UID_C, 'user'],
];

async function seed() {
  for (const [uid, role] of users) {
    await aauth.createUser({ uid, email: `${uid}@probe.invalid` }).catch((e) => {
      if (e.code !== 'auth/uid-already-exists') throw e;
    });
    await adb.doc(`users/${uid}`).set({ role, email: `${uid}@probe.invalid` });
  }
  // parentId menunjuk dokumen yang tidak ada: bukan tingkat atas (tidak di
  // beranda) dan induknya tidak ada (tidak di halaman siapa pun).
  const hidden = { parentId: `${P}_nowhere`, location: 'PROBE' };
  await adb.doc(`destinations/${PARENT_A}`).set({ ...hidden, name: 'ZZ PROBE A', managerUid: UID_A });
  await adb.doc(`destinations/${PARENT_B}`).set({ ...hidden, name: 'ZZ PROBE B', managerUid: UID_B });
  await adb.doc(`destinations/${CHILD_A}`).set({ parentId: PARENT_A, location: 'PROBE', name: 'ZZ PROBE anak A', managerUid: UID_A });
  await adb.doc(`destinations/${TOPLEVEL_A}`).set({ name: 'ZZ PROBE toplevel A', location: 'PROBE', managerUid: UID_A });
  // Booking boneka ditulis Admin SDK (klien memang sudah tidak boleh membuatnya).
  // Sengaja 'used' + 'paid': dua uji terpenting di bawah adalah pemilik tiket
  // menulis balik status 'used' menjadi 'confirmed' untuk masuk dua kali, dan
  // menandai lunas sendiri tanpa membayar.
  const booking = (uid) => ({
    userId: uid, destinationId: PARENT_A, destinationName: 'ZZ PROBE A',
    date: '2099-01-01', guests: 1, name: 'ZZ Probe', phone: '08', notes: '',
    items: [{ id: 'tiket', label: 'Tiket', price: 25000, qty: 1 }], amount: 25000,
    status: 'used', paymentStatus: 'paid',
  });
  await adb.doc(`bookings/${BOOK_C}`).set(booking(UID_C));
  await adb.doc(`bookings/${BOOK_A}`).set(booking(UID_A));
  await adb.doc(`cameras/${CAM_PUB}`).set({ ownerUid: UID_A, status: 'approved', isPublic: true, viewers: [] });
  // status 'pending', BUKAN 'approved': uji eskalasi di bawah menulis
  // status:'approved', dan affectedKeys() hanya memuat kolom yang nilainya
  // benar-benar berubah — kalau seed-nya sudah 'approved', tulisan itu jadi
  // no-op yang lolos hasOnly() tanpa membuktikan apa pun.
  await adb.doc(`cameras/${CAM_PRIV}`).set({ ownerUid: UID_A, status: 'pending', isPublic: false, viewers: [] });
}

async function cleanup() {
  const docs = [
    ...[PARENT_A, PARENT_B, CHILD_A, TOPLEVEL_A, NEW_OK, NEW_BAD].map((id) => `destinations/${id}`),
    ...[CAM_PUB, CAM_PRIV].map((id) => `cameras/${id}`),
    ...[BOOK_C, BOOK_A, `${P}_selundupan`].map((id) => `bookings/${id}`),
    ...users.map(([uid]) => `users/${uid}`),
  ];
  await Promise.all(docs.map((p) => adb.doc(p).delete().catch(() => {})));
  await Promise.all(users.map(([uid]) => aauth.deleteUser(uid).catch(() => {})));
}

/** Satu app Web SDK per akun: signIn berikutnya tidak menendang yang sebelumnya. */
async function signIn(uid) {
  const app = initializeApp(webConfig, `${P}-${uid}-${Date.now()}`);
  await signInWithCustomToken(getAuth(app), await aauth.createCustomToken(uid));
  return { app, db: getFirestore(app) };
}

// ── kasus ──
let pass = 0;
let fail = 0;

/** `expect`: 'allow' = operasinya harus berhasil, 'deny' = harus permission-denied. */
async function probe(expect, name, fn) {
  let got;
  try {
    await fn();
    got = 'allow';
  } catch (e) {
    got = e?.code === 'permission-denied' ? 'deny' : `error:${e?.code ?? e?.message}`;
  }
  const ok = got === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}  (harap ${expect}, dapat ${got})`);
}

const child = (over = {}) => ({
  name: 'ZZ PROBE spot',
  location: 'PROBE',
  parentId: PARENT_A,
  managerUid: UID_A,
  ...over,
});

async function run(round) {
  console.log(`\n── putaran ${round} ──`);
  const A = await signIn(UID_A);
  const B = await signIn(UID_B);
  const C = await signIn(UID_C);

  // destinations create — cabang pengelola
  await probe('allow', 'A menambah spot di dalam destinasinya sendiri', () =>
    setDoc(doc(A.db, 'destinations', NEW_OK), child())
  );
  await probe('deny', 'B menyisipkan spot ke dalam destinasi milik A', () =>
    setDoc(doc(B.db, 'destinations', NEW_BAD), child({ managerUid: UID_B }))
  );
  await probe('deny', 'A menitipkan spot atas nama pengelola lain (managerUid B)', () =>
    setDoc(doc(A.db, 'destinations', NEW_BAD), child({ managerUid: UID_B }))
  );
  await probe('deny', 'A menyelipkan stationId milik perangkat lain', () =>
    setDoc(doc(A.db, 'destinations', NEW_BAD), child({ stationId: 'bahoi' }))
  );
  await probe('deny', 'A menyelipkan cameraIds', () =>
    setDoc(doc(A.db, 'destinations', NEW_BAD), child({ cameraIds: ['x'] }))
  );
  await probe('deny', 'A membuat destinasi tingkat atas (tanpa parentId)', () =>
    setDoc(doc(A.db, 'destinations', NEW_BAD), child({ parentId: '' }))
  );
  await probe('deny', 'A membuat spot tanpa nama', () =>
    setDoc(doc(A.db, 'destinations', NEW_BAD), child({ name: '' }))
  );
  await probe('deny', 'C (pengguna biasa) membuat spot', () =>
    setDoc(doc(C.db, 'destinations', NEW_BAD), child({ managerUid: UID_C }))
  );

  // destinations delete — cabang pengelola
  await probe('deny', 'A menghapus destinasi kelolaannya sendiri (tingkat atas)', () =>
    deleteDoc(doc(A.db, 'destinations', TOPLEVEL_A))
  );
  await probe('deny', 'B menghapus spot milik A', () =>
    deleteDoc(doc(B.db, 'destinations', CHILD_A))
  );
  await probe('allow', 'A menghapus spot di dalam destinasinya', () =>
    deleteDoc(doc(A.db, 'destinations', CHILD_A))
  );

  // cameras read — cabang isPublic
  await probe('allow', 'C membaca kamera publik', () =>
    getDoc(doc(C.db, 'cameras', CAM_PUB)).then((s) => {
      if (!s.exists()) throw new Error('dokumen hilang');
    })
  );
  await probe('deny', 'C membaca kamera khusus yang emailnya tidak terdaftar', () =>
    getDoc(doc(C.db, 'cameras', CAM_PRIV))
  );

  // cameras update — cabang viewers/isPublic
  await probe('allow', 'A menyalakan mode publik kameranya sendiri', () =>
    updateDoc(doc(A.db, 'cameras', CAM_PRIV), { isPublic: true })
  );
  await probe('deny', 'B menyalakan mode publik kamera milik A', () =>
    updateDoc(doc(B.db, 'cameras', CAM_PUB), { isPublic: false })
  );
  await probe('deny', 'A menyetujui kameranya sendiri lewat jalur isPublic', () =>
    updateDoc(doc(A.db, 'cameras', CAM_PRIV), { isPublic: true, status: 'approved' })
  );
  await probe('deny', 'A menyetujui kameranya sendiri langsung (status saja)', () =>
    updateDoc(doc(A.db, 'cameras', CAM_PRIV), { status: 'approved' })
  );
  await probe('deny', 'A menyerobot kamera lewat ownerUid', () =>
    updateDoc(doc(A.db, 'cameras', CAM_PRIV), { ownerUid: UID_B })
  );
  await probe('deny', 'A menulis isPublic bukan-bool', () =>
    updateDoc(doc(A.db, 'cameras', CAM_PRIV), { isPublic: 'ya' })
  );

  // ── bookings ──
  //
  // Seluruh penulisan koleksi ini pindah ke /api/bookings (Admin SDK, yang
  // melewati rules). Yang dibuktikan di sini: klien benar-benar tidak punya
  // jalan pintas lewat SDK, dan tiga lubang lama sudah tertutup.

  // Lubang 1 — harga dikarang sendiri. Dulu 'create: if request.auth != null',
  // jadi siapa pun bisa menulis booking Rp 0 langsung dari console browser.
  await probe('deny', 'C membuat booking langsung lewat SDK', () =>
    setDoc(doc(C.db, 'bookings', `${P}_selundupan`), {
      userId: UID_C, destinationId: PARENT_A, destinationName: 'ZZ PROBE A',
      date: '2099-01-01', guests: 1, name: 'ZZ', phone: '08', notes: '',
      items: [], amount: 0, status: 'confirmed', paymentStatus: 'paid',
    })
  );

  // Lubang 2 — satu QR dipakai berkali-kali. Dulu pemilik booking boleh
  // meng-update dokumennya sendiri, jadi status 'used' bisa ditulis balik.
  await probe('deny', 'C mengembalikan tiketnya sendiri dari used ke confirmed', () =>
    updateDoc(doc(C.db, 'bookings', BOOK_C), { status: 'confirmed' })
  );

  // Lubang 3 — menandai lunas sendiri tanpa membayar.
  await probe('deny', 'C menandai bookingnya sendiri lunas', () =>
    updateDoc(doc(C.db, 'bookings', BOOK_C), { paymentStatus: 'paid' })
  );

  await probe('deny', 'C mengubah jumlah tagihan bookingnya sendiri', () =>
    updateDoc(doc(C.db, 'bookings', BOOK_C), { amount: 0 })
  );
  await probe('deny', 'C menghapus bookingnya sendiri', () =>
    deleteDoc(doc(C.db, 'bookings', BOOK_C))
  );
  await probe('deny', 'B menyerobot booking milik C', () =>
    updateDoc(doc(B.db, 'bookings', BOOK_C), { status: 'cancelled' })
  );

  // Baca. Booking sendiri boleh; milik orang lain tidak — dulu rules-nya cuma
  // 'request.auth != null', jadi nama & nomor HP semua pemesan terbuka.
  await probe('allow', 'C membaca bookingnya sendiri', () =>
    getDoc(doc(C.db, 'bookings', BOOK_C))
  );
  await probe('deny', 'C membaca booking milik orang lain', () =>
    getDoc(doc(C.db, 'bookings', BOOK_A))
  );
  await probe('deny', 'C menyapu seluruh koleksi bookings', () =>
    getDocs(collection(C.db, 'bookings'))
  );
  await probe('deny', 'C menyapu booking atas nama orang lain', () =>
    getDocs(query(collection(C.db, 'bookings'), where('userId', '==', UID_A)))
  );

  // Kueri berfilter milik sendiri harus tetap jalan — ini yang dipakai
  // BookingHistory dan NotificationBell. Kalau ini ikut tertolak, rules-nya
  // kelewat ketat dan halaman booking pengguna jadi kosong.
  await probe('allow', 'C menyapu bookingnya sendiri (userId == dirinya)', () =>
    getDocs(query(collection(C.db, 'bookings'), where('userId', '==', UID_C)))
  );

  // Petugas tetap boleh membaca semuanya — ScanPanel & statistik dasbor.
  await probe('allow', 'A (pengelola) membaca booking milik C', () =>
    getDoc(doc(A.db, 'bookings', BOOK_C))
  );
  // ...tapi tetap tidak boleh menulis: check-in pun harus lewat server.
  await probe('deny', 'A (pengelola) check-in langsung lewat SDK', () =>
    updateDoc(doc(A.db, 'bookings', BOOK_C), { status: 'used' })
  );

  await Promise.all([deleteApp(A.app), deleteApp(B.app), deleteApp(C.app)]);
}

try {
  for (const round of [1, 2]) {
    await seed(); // boneka dikembalikan utuh: putaran 1 menghapus CHILD_A
    await run(round);
  }
  console.log(`\n${fail === 0 ? 'SEMUA LOLOS' : 'ADA YANG GAGAL'} — ${pass} lolos, ${fail} gagal`);
} finally {
  await cleanup();
  console.log('boneka dibersihkan');
}
process.exit(fail === 0 ? 0 : 1);
