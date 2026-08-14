import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { docId } from '@/lib/format';

export const runtime = 'nodejs';

/**
 * Hapus akun sekaligus: Auth + dokumen users/{uid}. Hapus lewat Console cuma
 * kena Auth-nya, dokumen Firestore-nya tertinggal dan menumpuk di daftar
 * pengguna — makanya penghapusan harus lewat sini.
 *
 * Auth yang sudah tidak ada diabaikan, jadi rute ini sekalian membersihkan
 * sisa akun yang terlanjur dihapus dari Console.
 *
 * Hanya admin yang boleh memanggil: wajib kirim Firebase ID token di header
 * Authorization, dan role pemanggil dicek ke Firestore lewat Admin SDK.
 */
export async function DELETE(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let callerUid: string;
  try {
    callerUid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const caller = await adminDb().doc(`users/${callerUid}`).get();
  if (caller.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // docId(), bukan pembacaan mentah: `uid` di bawah menyusun path dokumen, dan
  // path Firestore bersegmen — "abc/pengajuan/xyz" menunjuk dokumen di
  // subkoleksi lain, yang lalu ikut terhapus. Digerbangi admin, tapi penjaganya
  // sudah ada dan tidak ada alasan route ini tidak memakainya.
  const uid = docId(new URL(req.url).searchParams.get('uid'));
  if (!uid) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  if (uid === callerUid) {
    return NextResponse.json({ error: 'self-delete' }, { status: 400 });
  }

  try {
    await adminAuth().deleteUser(uid);
  } catch (err) {
    // Sudah dihapus dari Console duluan — lanjut bersihkan dokumennya.
    if ((err as { code?: string }).code !== 'auth/user-not-found') {
      console.error('[delete-user] deleteUser', err);
      return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
    }
  }

  await adminDb().doc(`users/${uid}`).delete();
  return NextResponse.json({ ok: true });
}
