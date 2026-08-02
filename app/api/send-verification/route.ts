import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { mailer, MAIL_FROM } from '@/lib/mailer';

export const runtime = 'nodejs';

// Kirim email verifikasi lewat SMTP sendiri (Brevo/Resend/dll) — bukan email
// bawaan Firebase yang sering nyasar spam / di-drop.
//
// generateEmailVerificationLink() melempar auth/user-not-found kalau email
// belum terdaftar, jadi endpoint ini cuma bisa mengirim ke akun yang benar-benar
// ada — batas alami dari penyalahgunaan.
// ponytail: tanpa rate-limit per-IP. Tambah kalau ada spam kirim-ulang.
export async function POST(req: Request) {
  let email: string | undefined;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email-required' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  let link: string;
  try {
    link = await adminAuth().generateEmailVerificationLink(email, {
      url: `${appUrl}/profile`,
    });
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    // user-not-found: jangan bocorkan apakah email terdaftar — balas ok.
    if (code === 'auth/user-not-found') return NextResponse.json({ ok: true });
    console.error('[send-verification] generateLink', err);
    return NextResponse.json({ error: 'link-failed' }, { status: 500 });
  }

  try {
    await mailer().sendMail({
      from: MAIL_FROM,
      to: email,
      subject: 'Verifikasi email — Nusa',
      text: `Halo,\n\nKlik link berikut untuk memverifikasi email kamu di Nusa:\n${link}\n\nAbaikan email ini kalau kamu tidak mendaftar.`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f2f3d">
          <h2 style="font-weight:600">Verifikasi email kamu</h2>
          <p style="color:#3f5a66;line-height:1.6">Klik tombol di bawah untuk mengaktifkan akun Nusa kamu.</p>
          <p style="margin:28px 0">
            <a href="${link}" style="background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;display:inline-block">Verifikasi Email</a>
          </p>
          <p style="color:#7a8b93;font-size:13px">Atau salin tautan ini:<br>${link}</p>
          <p style="color:#7a8b93;font-size:13px">Abaikan email ini kalau kamu tidak mendaftar.</p>
        </div>`,
    });
  } catch (err) {
    console.error('[send-verification] sendMail', err);
    return NextResponse.json({ error: 'send-failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
