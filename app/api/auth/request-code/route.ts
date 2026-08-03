import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { mailer, MAIL_FROM } from '@/lib/mailer';
import {
  CODE_TTL_MS,
  emailKey,
  hashCode,
  isEmail,
  newCode,
  normalizeEmail,
  resendBlocked,
  type StoredCode,
} from '@/lib/loginCode';

export const runtime = 'nodejs';

// Kirim kode login 6 digit ke email. Tidak ada password di sistem ini: kode
// inilah buktinya orang memang pegang alamat email itu.
//
// Balasannya selalu { ok: true } untuk email berformat benar — daftar atau
// belum. Kalau endpoint ini membedakan keduanya, siapa pun bisa memakainya
// untuk mengecek email mana yang punya akun di Nusa.
//
// ponytail: rem-nya cuma jeda 60 detik per email (resendBlocked). Cukup
// menahan spam kirim-ulang; tambah rate-limit per-IP kalau ada yang
// menggilir ribuan alamat berbeda.
export async function POST(req: Request) {
  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  if (typeof email !== 'string' || !isEmail(email)) {
    return NextResponse.json({ error: 'email-invalid' }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  const ref = adminDb().collection('loginCodes').doc(emailKey(normalized));

  const snap = await ref.get();
  const stored = snap.exists ? (snap.data() as StoredCode) : null;
  if (resendBlocked(stored, Date.now())) {
    return NextResponse.json({ error: 'cooldown' }, { status: 429 });
  }

  const code = newCode();
  await ref.set({
    hash: hashCode(code, normalized),
    createdAt: Date.now(),
    attempts: 0,
  });

  const minutes = Math.round(CODE_TTL_MS / 60000);
  try {
    await mailer().sendMail({
      from: MAIL_FROM,
      to: normalized,
      subject: `${code} — kode masuk Nusa`,
      text: `Kode masuk Nusa kamu: ${code}\n\nKetik kode ini di halaman yang sedang terbuka. Berlaku ${minutes} menit.\n\nAbaikan email ini kalau kamu tidak meminta kode.`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f2f3d">
          <h2 style="font-weight:600">Kode masuk kamu</h2>
          <p style="color:#3f5a66;line-height:1.6">Ketik kode ini di halaman Nusa yang sedang terbuka.</p>
          <p style="margin:28px 0;font-size:34px;font-weight:700;letter-spacing:10px;color:#0d9488">${code}</p>
          <p style="color:#7a8b93;font-size:13px">Berlaku ${minutes} menit.</p>
          <p style="color:#7a8b93;font-size:13px">Abaikan email ini kalau kamu tidak meminta kode — tanpa kode ini tidak ada yang bisa masuk.</p>
        </div>`,
    });
  } catch (err) {
    console.error('[request-code] sendMail', err);
    // Kode tak terkirim jadi sampah yang menghalangi percobaan berikutnya
    // selama 60 detik — buang supaya user bisa langsung coba lagi.
    await ref.delete().catch(() => {});
    return NextResponse.json({ error: 'send-failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
