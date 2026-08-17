import assert from 'assert';
import nodemailer from 'nodemailer';
import { tanpaKutip } from './mailer';

/**
 * Uji mandiri lib/mailer — jalankan: npx tsx lib/mailer.check.ts
 *
 * jsonTransport: tidak menyentuh jaringan dan tidak mengirim apa pun. Yang
 * diperiksa amplop SMTP yang DIHASILKAN nodemailer dari sebuah nilai
 * SMTP_FROM — persis titik tempat kutip yang ikut terbawa berubah menjadi
 * `451 4.0.0 Invalid from` di produksi pada 17 Agustus 2026, sementara lokal
 * tetap jalan mulus karena dotenv sudah melepas kutipnya lebih dulu.
 */

const BENAR = 'kirim@contoh.com';

async function amplopDari(smtpFrom: string): Promise<string> {
  const t = nodemailer.createTransport({ jsonTransport: true });
  const info = await t.sendMail({
    from: tanpaKutip(smtpFrom) || 'Nusa <no-reply@nusa.app>',
    to: 'contoh@contoh.test',
    subject: 'x',
    text: 'x',
  });
  return String(info.envelope.from);
}

async function main() {
  // Bentuk bersih tidak boleh berubah sedikit pun.
  assert.equal(await amplopDari(`Nusa <${BENAR}>`), BENAR);

  // INTI: nilai yang disalin bulat-bulat dari .env.local ke dashboard Vercel.
  // Tanpa penangkalnya, amplopnya jadi `"Nusa  kirim"@contoh.com`.
  assert.equal(
    await amplopDari(`"Nusa <${BENAR}>"`),
    BENAR,
    'kutip ganda yang ikut terbawa tidak boleh membengkokkan alamatnya',
  );
  assert.equal(await amplopDari(`'Nusa <${BENAR}>'`), BENAR, 'kutip tunggal juga');
  assert.equal(await amplopDari(`  "Nusa <${BENAR}>"  `), BENAR, 'beserta spasi di tepinya');
  assert.equal(await amplopDari(`"${BENAR}"`), BENAR, 'alamat telanjang tanpa nama tampilan');

  // Kosong jatuh ke cadangan, bukan ke amplop tanpa pengirim.
  assert.equal(await amplopDari(''), 'no-reply@nusa.app');
  assert.equal(await amplopDari('""'), 'no-reply@nusa.app', 'kutip kosong = kosong');

  // Kutip di TENGAH dibiarkan: itu alamat aneh, tapi bukan urusan fungsi ini,
  // dan memangkasnya diam-diam akan mengirim ke alamat yang berbeda dari yang
  // ditulis orangnya.
  assert.equal(tanpaKutip('Nu"sa <x@y.com>'), 'Nu"sa <x@y.com>');

  console.log('mailer.ts OK');
}

main();
