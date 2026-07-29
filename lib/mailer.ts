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

export const MAIL_FROM = process.env.SMTP_FROM ?? 'Lautara <no-reply@lautara.app>';
