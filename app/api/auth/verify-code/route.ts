import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import {
  checkCode,
  emailKey,
  hashCode,
  isEmail,
  nameFromEmail,
  normalizeEmail,
  type StoredCode,
} from '@/lib/loginCode';

export const runtime = 'nodejs';

// Tukar kode 6 digit dengan custom token Firebase. Akun dibuat di sini kalau
// emailnya belum pernah masuk — daftar dan masuk jadi satu jalur.
export async function POST(req: Request) {
  let email: unknown;
  let code: unknown;
  try {
    ({ email, code } = await req.json());
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (typeof email !== 'string' || !isEmail(email) || typeof code !== 'string') {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  const ref = adminDb().collection('loginCodes').doc(emailKey(normalized));
  const snap = await ref.get();
  const stored = snap.exists ? (snap.data() as StoredCode) : null;

  const verdict = checkCode(stored, hashCode(code, normalized), Date.now());
  if (verdict !== 'ok') {
    if (verdict === 'wrong') {
      await ref.update({ attempts: FieldValue.increment(1) });
      return NextResponse.json({ error: 'wrong' }, { status: 400 });
    }
    // Kedaluwarsa / kehabisan tebakan: buang kodenya, minta kirim ulang.
    await ref.delete().catch(() => {});
    return NextResponse.json({ error: verdict }, { status: 400 });
  }

  // Sekali pakai. Dihapus sebelum token dibuat supaya kode yang sama tidak
  // bisa ditukar dua kali kalau ada dua permintaan barengan.
  await ref.delete();

  let uid: string;
  try {
    const user = await adminAuth().getUserByEmail(normalized);
    uid = user.uid;
    // Akun lama dari era password bisa saja belum terverifikasi. Orangnya baru
    // membuktikan pegang email ini, jadi tandai verified — kalau tidak, semua
    // gerbang emailVerified (booking, kamera, profil) menolaknya selamanya.
    if (!user.emailVerified) {
      await adminAuth().updateUser(uid, { emailVerified: true });
    }
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') {
      console.error('[verify-code] getUserByEmail', err);
      return NextResponse.json({ error: 'server' }, { status: 500 });
    }
    // Layar masuk tidak menanyakan nama, jadi nama awal diambil dari bagian
    // email sebelum "@" — bisa diganti di Profil › Pengaturan.
    const created = await adminAuth().createUser({
      email: normalized,
      emailVerified: true,
      displayName: nameFromEmail(normalized),
    });
    uid = created.uid;
  }

  const token = await adminAuth().createCustomToken(uid);
  return NextResponse.json({ token });
}
