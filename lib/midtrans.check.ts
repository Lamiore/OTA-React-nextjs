import assert from 'assert';
import crypto from 'crypto';
import { verifySignature, bacaStatus, notificationUrl } from './midtrans';

/**
 * Uji mandiri lib/midtrans — jalankan: npx tsx lib/midtrans.check.ts
 *
 * Server key dipalsukan di sini supaya berkas ini tidak pernah butuh
 * .env.local dan tidak pernah menyentuh Midtrans sungguhan. Aman ditaruh
 * setelah import karena midtrans.ts membaca env-nya saat dipanggil, bukan saat
 * dimuat — kalau itu berubah jadi konstanta modul, baris ini ikut mati.
 */
process.env.MIDTRANS_SERVER_KEY = 'kunci-uji';

// ── Tanda tangan ──
//
// Ini satu-satunya autentikasi webhook. Kalau baris di bawah bergeser dan
// verifikasinya jadi longgar, siapa pun yang tahu alamat webhooknya bisa
// menerbitkan tiket tanpa membayar — dan tidak ada error yang muncul.

const sah = (order: string, code: string, amount: string) =>
  crypto.createHash('sha512').update(`${order}${code}${amount}kunci-uji`).digest('hex');

const notif = {
  order_id: 'abc123-1',
  status_code: '200',
  gross_amount: '185000.00',
  signature_key: sah('abc123-1', '200', '185000.00'),
};

assert.equal(verifySignature(notif), true, 'tanda tangan yang benar diterima');

assert.equal(
  verifySignature({ ...notif, gross_amount: '1000.00' }),
  false,
  'jumlah diubah tanpa menghitung ulang tanda tangan = ditolak',
);
assert.equal(
  verifySignature({ ...notif, order_id: 'booking-lain-1' }),
  false,
  'order_id diubah = ditolak',
);
assert.equal(verifySignature({ ...notif, signature_key: '' }), false, 'tanda tangan kosong ditolak');
assert.equal(verifySignature({}), false, 'notifikasi kosong ditolak');
assert.equal(
  verifySignature({ ...notif, signature_key: 'x'.repeat(128) }),
  false,
  'tanda tangan sepanjang yang benar tapi isinya salah = ditolak',
);

// ── Terjemahan status ──
//
// Salah di sini artinya tiket terbit untuk pembayaran yang gagal, atau uang
// masuk tanpa tiket. Dua-duanya tidak muncul sebagai error.

assert.equal(bacaStatus({ transaction_status: 'settlement' }), 'lunas');
assert.equal(bacaStatus({ transaction_status: 'capture', fraud_status: 'accept' }), 'lunas');
assert.equal(
  bacaStatus({ transaction_status: 'capture', fraud_status: 'challenge' }),
  'menunggu',
  'dana ditahan untuk ditinjau belum boleh jadi tiket',
);
for (const s of ['deny', 'cancel', 'expire', 'failure']) {
  assert.equal(bacaStatus({ transaction_status: s }), 'gagal', `${s} = gagal`);
}
assert.equal(bacaStatus({ transaction_status: 'pending' }), 'menunggu');
assert.equal(
  bacaStatus({}),
  'menunggu',
  'status tak dikenal jatuh ke menunggu, bukan lunas — kalau Midtrans menambah status baru, bawaannya harus yang tidak menerbitkan tiket',
);

// ── Alamat webhook ──
//
// Salah di sini = Midtrans mengirim kabar lunas ke alamat yang salah (atau
// tidak sama sekali), pembeli membayar, dan tiketnya tidak pernah terbit.

delete process.env.MIDTRANS_NOTIFICATION_URL;
delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
assert.equal(notificationUrl(), null, 'di lokal tidak ada alamat, header tidak dikirim');

process.env.VERCEL_PROJECT_PRODUCTION_URL = 'ota-react-nextjs.vercel.app';
assert.equal(
  notificationUrl(),
  'https://ota-react-nextjs.vercel.app/api/payments/midtrans',
  'di Vercel alamatnya dirakit sendiri dari domain produksi',
);

// Yang eksplisit menang — jalan keluar kalau domainnya kelak pindah.
process.env.MIDTRANS_NOTIFICATION_URL = 'https://contoh.test/hook';
assert.equal(notificationUrl(), 'https://contoh.test/hook');

console.log('midtrans.ts OK');
