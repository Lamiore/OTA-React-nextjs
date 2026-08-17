import nodemailer from 'nodemailer';

// SMTP sendiri (Brevo/Resend/dll) — dipakai semua email keluar aplikasi.
export function mailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/**
 * Buang tanda kutip yang mengapit nilai env.
 *
 * `.env.local` menulis SMTP_FROM sebagai `"Nusa <alamat@contoh.com>"` dan
 * dotenv melepas kutipnya sebelum kode ini melihatnya. Dashboard Vercel TIDAK:
 * yang diketik di sana masuk apa adanya. Jadi nilai yang sama persis, disalin
 * bulat-bulat dari berkas ke dashboard, berperilaku berbeda di dua tempat —
 * dan bedanya baru terasa jauh di hilir.
 *
 * Yang terjadi kalau kutipnya ikut: nodemailer membaca seluruh `"Nusa
 * <alamat@contoh.com>"` sebagai bagian-lokal yang dikutip, lalu mengirim
 * `MAIL FROM:<"Nusa  alamat"@contoh.com>`, dan SMTP-nya menjawab
 * `451 4.0.0 Invalid from`. Tidak ada satu kata pun di pesan itu yang
 * menunjuk ke tanda kutip, dan lokal tetap jalan mulus — perpaduan paling
 * mahal untuk dilacak.
 */
export function tanpaKutip(v: string): string {
  return v.replace(/^\s*["']|["']\s*$/g, '').trim();
}

export const MAIL_FROM = tanpaKutip(process.env.SMTP_FROM ?? '') || 'Nusa <no-reply@nusa.app>';
