/**
 * Alat bantu pengujian: menimpa hash kode masuk untuk satu email dengan kode
 * yang sudah diketahui, supaya alur masuk dapat diuji lewat antarmuka tanpa
 * bergantung pada penerimaan surel.
 *
 *   node scripts/seed-login-code.mjs <email> <kode6digit>
 *   node scripts/seed-login-code.mjs <email> --hapus
 *
 * Hanya dapat dijalankan oleh pemegang kredensial administratif proyek.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const app = initializeApp({ credential: cert(JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))) });
const db = getFirestore(app);

const email = (process.argv[2] || '').trim().toLowerCase();
const arg = process.argv[3];
if (!email || !arg) { console.error('pemakaian: node scripts/seed-login-code.mjs <email> <kode|--hapus>'); process.exit(1); }

const sha = (s) => createHash('sha256').update(s).digest('hex');
const key = sha(email);

if (arg === '--hapus') {
  await db.collection('loginCodes').doc(key).delete().catch(() => {});
  const u = await getAuth(app).getUserByEmail(email).catch(() => null);
  if (u) { await db.doc(`users/${u.uid}`).delete().catch(() => {}); await getAuth(app).deleteUser(u.uid); }
  console.log('dibersihkan:', email);
} else {
  await db.collection('loginCodes').doc(key).set({ hash: sha(`${email}:${arg}`), createdAt: Date.now(), attempts: 0 });
  console.log('kode disetel untuk', email);
}
process.exit(0);
