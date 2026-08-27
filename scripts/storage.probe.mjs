/**
 * Probe storage.rules sebagai PENGGUNA ASLI, bukan Admin SDK.
 *
 * Sama semangatnya dengan rules.probe.mjs: Admin SDK melewati rules sepenuhnya,
 * jadi dia dipakai cuma untuk mencetak custom token, menyiapkan boneka, dan
 * membersihkan berkas sisa. Semua unggahan yang diuji lewat Web SDK dari akun
 * yang sudah masuk — persis jalur yang dipakai FotoUpload di browser.
 *
 * Rules butuh waktu menyebar setelah `firebase deploy --only storage`: probe
 * yang dijalankan beberapa detik sesudah deploy bisa memberi hasil ruleset lama.
 * Karena itu dijalankan dua putaran berjarak; kalau hasilnya beda, tunggu
 * sebentar lalu ulangi.
 *
 * Jalankan: node scripts/storage.probe.mjs
 */
import { readFileSync } from 'node:fs';
import { setTimeout as tunggu } from 'node:timers/promises';
import { cert, initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';

// ── env ──
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const BUCKET = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const webConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: BUCKET,
};

const adminApp = initAdminApp({
  credential: cert(JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))),
  storageBucket: BUCKET,
});
const adb = getAdminFirestore(adminApp);
const aauth = getAdminAuth(adminApp);
const abucket = getAdminStorage(adminApp).bucket();

// ── boneka ──
const P = 'zzprobe';
// Satu boneka per role: yang membedakan izin unggah adalah `role` di
// users/{uid}, dibaca rules lewat cross-service firestore.get().
const AKUN = [
  [`${P}_foto_admin`, 'admin'],
  [`${P}_foto_pengelola`, 'pengelola'],
  [`${P}_foto_user`, 'user'],
];
const [[UID_ADMIN], [UID_PENGELOLA], [UID_USER]] = AKUN;
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);
/** Berkas yang sempat naik — dihapus di finally lewat Admin SDK, karena rules
 *  sengaja tidak memberi hak delete ke klien mana pun. */
const naik = [];

let pass = 0;
let fail = 0;

async function seed() {
  for (const [uid, role] of AKUN) {
    await aauth.createUser({ uid, email: `${uid}@probe.invalid` }).catch((e) => {
      if (e.code !== 'auth/uid-already-exists') throw e;
    });
    await adb.doc(`users/${uid}`).set({ role, email: `${uid}@probe.invalid` });
  }
}

async function cleanup() {
  await Promise.all(naik.map((p) => abucket.file(p).delete().catch(() => {})));
  await Promise.all(AKUN.map(([uid]) => adb.doc(`users/${uid}`).delete().catch(() => {})));
  await Promise.all(AKUN.map(([uid]) => aauth.deleteUser(uid).catch(() => {})));
}

async function anonApp() {
  const app = initializeApp(webConfig, `${P}-anon-${Date.now()}`);
  return { app, st: getStorage(app) };
}

async function signedApp(uid) {
  const app = initializeApp(webConfig, `${P}-${uid}-${Date.now()}`);
  await signInWithCustomToken(getAuth(app), await aauth.createCustomToken(uid));
  return { app, st: getStorage(app) };
}

async function probe(expect, name, fn) {
  let hasil;
  try {
    await fn();
    hasil = 'allow';
  } catch {
    hasil = 'deny';
  }
  const ok = hasil === expect;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${name} — ${hasil} (harus ${expect})`);
}

/** Unggah lewat Web SDK; jalurnya dicatat supaya bisa disapu belakangan. */
function unggah(st, path, data = PNG, type = 'image/png') {
  naik.push(path);
  return uploadBytes(ref(st, path), data, { contentType: type });
}

async function run(putaran) {
  console.log(`\n── putaran ${putaran} ──`);
  const tag = `${Date.now()}-${putaran}`;
  const anon = await anonApp();
  const admin = await signedApp(UID_ADMIN);
  const pengelola = await signedApp(UID_PENGELOLA);
  const user = await signedApp(UID_USER);

  // Tulis: hanya admin & pengelola, hanya ke destinasi/, hanya gambar wajar.
  await probe('deny', 'anon mengunggah ke destinasi/', () =>
    unggah(anon.st, `destinasi/${P}-anon-${tag}.png`),
  );
  // Login saja tidak cukup — inilah yang dijaga cross-service firestore.get().
  await probe('deny', 'pengguna biasa (role user) mengunggah', () =>
    unggah(user.st, `destinasi/${P}-user-${tag}.png`),
  );
  await probe('allow', 'pengelola mengunggah ke destinasi/', () =>
    unggah(pengelola.st, `destinasi/${P}-peng-${tag}.png`),
  );
  await probe('allow', 'admin mengunggah ke destinasi/', () =>
    unggah(admin.st, `destinasi/${P}-adm-${tag}.png`),
  );
  await probe('deny', 'admin mengunggah ke prefix lain', () =>
    unggah(admin.st, `lain/${P}-${tag}.png`),
  );
  await probe('deny', 'admin mengunggah berkas bukan gambar', () =>
    unggah(admin.st, `destinasi/${P}-${tag}.txt`, new TextEncoder().encode('halo'), 'text/plain'),
  );
  await probe('deny', 'admin mengunggah 11 MB', () =>
    unggah(admin.st, `destinasi/${P}-besar-${tag}.png`, new Uint8Array(11 * 1024 * 1024), 'image/png'),
  );

  // Baca: foto boleh dibuka siapa saja — itu memang gunanya di halaman publik.
  const publik = `destinasi/${P}-baca-${tag}.png`;
  await abucket.file(publik).save(Buffer.from(PNG), { contentType: 'image/png' });
  naik.push(publik);
  // Lewat getDownloadURL lalu fetch polos, bukan getBlob: itu jalur yang
  // sebenarnya dipakai — komponen menyimpan URL-nya, lalu <img> mengambilnya
  // tanpa SDK dan tanpa auth sama sekali. getBlob hanya jalan di browser.
  await probe('allow', 'anon membuka foto di destinasi/', async () => {
    const url = await getDownloadURL(ref(anon.st, publik));
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
  });

  // ...tapi bukan menelusuri isinya: `list` sengaja tidak diberikan.
  await probe('deny', 'anon mendaftar isi destinasi/', () => listAll(ref(anon.st, 'destinasi')));
  await probe('deny', 'admin mendaftar isi destinasi/', () =>
    listAll(ref(admin.st, 'destinasi')),
  );

  // Hapus tidak pernah diberikan ke klien — berkas lama disapu dari server.
  await probe('deny', 'admin menghapus foto lewat SDK', () =>
    deleteObject(ref(admin.st, publik)),
  );

  await Promise.all([anon, admin, pengelola, user].map(({ app }) => deleteApp(app)));
}

try {
  await seed();
  for (const putaran of [1, 2]) {
    if (putaran > 1) await tunggu(20_000); // jeda: hasil yang sama dua kali baru meyakinkan
    await run(putaran);
  }
  console.log(`\n${fail === 0 ? 'SEMUA LOLOS' : 'ADA YANG GAGAL'} — ${pass} lolos, ${fail} gagal`);
} finally {
  await cleanup();
  console.log('boneka dibersihkan');
}
process.exit(fail === 0 ? 0 : 1);
