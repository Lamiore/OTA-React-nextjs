import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { mailer, MAIL_FROM } from '@/lib/mailer';

export const runtime = 'nodejs';

const COPY = {
  mitra: {
    subject: 'Pengajuan mitra disetujui — Nusa',
    title: 'Akun kamu sekarang Mitra',
    body: 'Pengajuan verifikasi mitra kamu sudah disetujui admin. Kamu bisa mendaftarkan dan memantau kamera milikmu lewat menu Kamera.',
    cta: 'Buka Halaman Kamera',
    path: '/kamera',
  },
  pengelola: {
    subject: 'Pengajuan pengelola disetujui — Nusa',
    title: 'Akun kamu sekarang Pengelola',
    body: 'Pengajuan jadi pengelola sudah disetujui admin. Menu Dashboard sekarang terbuka untuk mengelola destinasi, booking, dan kamera di wilayahmu. Penetapan destinasi dilakukan admin.',
    cta: 'Buka Dashboard',
    path: '/dashboard',
  },
} as const;

/**
 * Email pemberitahuan saat admin menyetujui pengajuan mitra/pengelola.
 * Hanya admin yang boleh memanggil: wajib kirim Firebase ID token di header
 * Authorization, dan role pemanggil dicek ke Firestore lewat Admin SDK.
 */
export async function POST(req: Request) {
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

  let uid: unknown;
  let role: unknown;
  try {
    ({ uid, role } = await req.json());
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (typeof uid !== 'string' || (role !== 'mitra' && role !== 'pengelola')) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const target = await adminAuth().getUser(uid).catch(() => null);
  if (!target?.email) return NextResponse.json({ error: 'no-email' }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const c = COPY[role];
  const link = `${appUrl}${c.path}`;

  try {
    await mailer().sendMail({
      from: MAIL_FROM,
      to: target.email,
      subject: c.subject,
      text: `Halo${target.displayName ? ' ' + target.displayName : ''},\n\n${c.body}\n\n${link}\n\n— Nusa`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f2f3d">
          <h2 style="font-weight:600">${c.title}</h2>
          <p style="color:#3f5a66;line-height:1.6">Halo${target.displayName ? ' ' + target.displayName : ''}, ${c.body}</p>
          <p style="margin:28px 0">
            <a href="${link}" style="background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;display:inline-block">${c.cta}</a>
          </p>
          <p style="color:#7a8b93;font-size:13px">Atau salin tautan ini:<br>${link}</p>
        </div>`,
    });
  } catch (err) {
    console.error('[notify-approval] sendMail', err);
    return NextResponse.json({ error: 'send-failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
