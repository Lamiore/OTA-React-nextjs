/**
 * Ukur latensi sinkronisasi real-time — bukti untuk KNF-02 dan target 3 detik
 * pada BAB III 3.8.1(b).
 *
 * Jalankan dari akar OTA/:  node scripts/latency.probe.mjs
 *
 * Dua jalur diukur, keduanya meniru pemakaian sungguhan:
 *
 *   1. Realtime Database — perangkat sensor menulis, peramban mendengarkan.
 *   2. Cloud Firestore   — status pemesanan diubah server, peramban pemilik
 *                          pemesanan menerima perubahannya.
 *
 * Penulisan memakai Admin SDK (mewakili sisi server / perangkat), pendengaran
 * memakai Web SDK dengan token pengguna sungguhan (mewakili peramban) — jadi
 * aturan keamanan ikut berlaku, sama seperti pengguna asli.
 *
 * Seluruh data boneka dihapus pada blok finally.
 */
import { readFileSync } from 'node:fs';
import { cert, initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getDatabase as getAdminDatabase } from 'firebase-admin/database';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { getDatabase, ref, onValue, off } from 'firebase/database';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const webCfg = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const adminApp = initAdminApp({
  credential: cert(JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))),
  databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
});
const adb = getAdminFirestore(adminApp);
const artdb = getAdminDatabase(adminApp);
const aauth = getAdminAuth(adminApp);

const UID = 'zzprobe_latency_user';
const STATION = '__probe_latency';
const SAMPEL = 10;

const stat = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const tengah = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return {
    n: s.length,
    min: s[0],
    tengah,
    maks: s[s.length - 1],
    rata: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
  };
};
const baris = (nama, st, target) =>
  `${nama.padEnd(34)} n=${st.n}  min=${String(st.min).padStart(4)}ms  ` +
  `median=${String(st.tengah).padStart(4)}ms  rata=${String(st.rata).padStart(4)}ms  ` +
  `maks=${String(st.maks).padStart(4)}ms  ${st.maks < target ? 'LOLOS' : 'TIDAK LOLOS'} (<${target}ms)`;

let webApp;
const bersihkan = [];

try {
  // ── siapkan pengguna boneka ──
  await aauth.createUser({ uid: UID, email: `${UID}@probe.invalid` }).catch((e) => {
    if (e.code !== 'auth/uid-already-exists') throw e;
  });
  await adb.doc(`users/${UID}`).set({ role: 'user', email: `${UID}@probe.invalid` });
  bersihkan.push(() => adb.doc(`users/${UID}`).delete());
  bersihkan.push(() => aauth.deleteUser(UID));

  webApp = initializeApp(webCfg, 'latency-probe');
  await signInWithCustomToken(getAuth(webApp), await aauth.createCustomToken(UID));
  const wdb = getFirestore(webApp);
  const wrtdb = getDatabase(webApp);

  // ══ 1. Realtime Database ══
  const jalurRtdb = `monitoring/${STATION}/latest`;
  await artdb.ref(jalurRtdb).set({ tempDHT: 0, updatedAt: Date.now() });
  bersihkan.push(() => artdb.ref(`monitoring/${STATION}`).remove());

  const hasilRtdb = [];
  {
    const r = ref(wrtdb, jalurRtdb);
    let tunggu = null;
    onValue(r, (snap) => {
      const v = snap.val();
      if (tunggu && v && v.tandaUji === tunggu.tanda) tunggu.selesai(Date.now() - tunggu.t0);
    });
    await new Promise((r2) => setTimeout(r2, 1200)); // biarkan langganan mapan

    for (let i = 0; i < SAMPEL; i++) {
      const tanda = `t${i}_${Math.random().toString(36).slice(2, 8)}`;
      const p = new Promise((selesai) => {
        tunggu = { tanda, t0: Date.now(), selesai };
      });
      await artdb.ref(jalurRtdb).set({ tempDHT: 20 + i, tandaUji: tanda, updatedAt: Date.now() });
      hasilRtdb.push(await p);
      await new Promise((r2) => setTimeout(r2, 350));
    }
    off(r);
  }

  // ══ 2. Cloud Firestore ══
  const bookingRef = adb.collection('bookings').doc();
  await bookingRef.set({
    userId: UID,
    destinationId: 'probe-dest',
    date: new Date().toISOString().slice(0, 10),
    guests: 1,
    items: [],
    amount: 0,
    status: 'pending',
    paymentStatus: 'unpaid',
  });
  bersihkan.push(() => bookingRef.delete());

  const hasilFs = [];
  {
    let tunggu = null;
    const unsub = onSnapshot(doc(wdb, 'bookings', bookingRef.id), (snap) => {
      const v = snap.data();
      if (tunggu && v && v.tandaUji === tunggu.tanda) tunggu.selesai(Date.now() - tunggu.t0);
    });
    await new Promise((r2) => setTimeout(r2, 1200));

    for (let i = 0; i < SAMPEL; i++) {
      const tanda = `t${i}_${Math.random().toString(36).slice(2, 8)}`;
      const p = new Promise((selesai) => {
        tunggu = { tanda, t0: Date.now(), selesai };
      });
      await bookingRef.update({ tandaUji: tanda, guests: i + 1 });
      hasilFs.push(await p);
      await new Promise((r2) => setTimeout(r2, 350));
    }
    unsub();
  }

  const TARGET = 3000;
  console.log('\nLatensi sinkronisasi real-time — target < 3000 ms (BAB III 3.8.1b)\n');
  console.log(baris('Realtime Database (data sensor)', stat(hasilRtdb), TARGET));
  console.log(baris('Cloud Firestore (status pesanan)', stat(hasilFs), TARGET));
  console.log('\nsampel RTDB (ms)     : ' + hasilRtdb.join(', '));
  console.log('sampel Firestore (ms): ' + hasilFs.join(', '));
} finally {
  for (const f of bersihkan.reverse()) await f().catch(() => {});
  if (webApp) await deleteApp(webApp).catch(() => {});
  console.log('\nboneka dibersihkan');
  process.exit(0);
}
