import crypto from 'crypto';
import { lineTotal, type BookingLine } from './destination';

/**
 * Midtrans Snap — membuat transaksi dan memeriksa keaslian webhook.
 *
 * Dipisah dari route karena dua pemanggilnya berjauhan: /api/bookings yang
 * membuat transaksinya, dan /api/payments/midtrans yang menerima kabarnya.
 * Rumus tanda tangan hanya boleh hidup di satu tempat — dua salinan berarti
 * satu di antaranya kelak longgar, dan yang longgar itu pintu masuk uang.
 *
 * Lingkungan ditentukan SATU saklar. Bawaannya sandbox: kalau env var-nya
 * hilang saat deploy, yang terjadi adalah pembayaran uji yang gagal, bukan
 * tagihan sungguhan ke kartu orang.
 */
const PRODUKSI = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const HOST = PRODUKSI ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';

/**
 * Alamat snap.js dikirim ke klien bersama tokennya, bukan dibaca ulang di sana
 * dari env NEXT_PUBLIC_. Halaman tidak bisa memuat skrip produksi untuk token
 * sandbox (atau sebaliknya) kalau keduanya berasal dari satu keputusan.
 */
export const SNAP_JS = `${HOST}/snap/snap.js`;

/** Lama kursi ditahan selama pembayaran berjalan. Disamakan dengan expiry Snap. */
export const HOLD_MENIT = 15;

function serverKey(): string {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error('MIDTRANS_SERVER_KEY belum diisi');
  return key;
}

/** Basic auth Midtrans: server key sebagai username, password kosong. */
function authHeader(): string {
  return 'Basic ' + Buffer.from(`${serverKey()}:`).toString('base64');
}

/** Potong ke batas panjang Midtrans; lebih dari itu ditolak 400 tanpa penjelasan. */
function potong(v: unknown, max: number): string {
  return String(v ?? '').slice(0, max);
}

/**
 * Alamat webhook, dikirim PER TRANSAKSI lewat header X-Override-Notification.
 *
 * Bukan lewat "Payment Notification URL" di dashboard, karena halaman itu sudah
 * tidak ada di MAP — yang tersisa cuma Settings › General dan Snap Preferences.
 * Selain itu cara ini lebih baik dari sisi mana pun: alamatnya ikut bersama
 * transaksinya, jadi tidak ada keadaan tersembunyi di luar repo yang harus
 * diingat ulang setiap ganti lingkungan.
 *
 * VERCEL_PROJECT_PRODUCTION_URL disediakan Vercel sendiri dan menunjuk domain
 * produksi bahkan dari deployment preview — itu memang yang diinginkan: satu
 * penerima webhook yang tetap, bukan alamat preview yang mati minggu depan.
 *
 * null di lokal (env-nya tidak ada). Di situ headernya tidak dikirim sama
 * sekali, dan memang tidak perlu: Midtrans tidak bisa menjangkau localhost,
 * jadi jalur lunasnya diuji dengan notifikasi buatan dari bookings.probe.mjs.
 */
export function notificationUrl(): string | null {
  const eksplisit = process.env.MIDTRANS_NOTIFICATION_URL;
  if (eksplisit) return eksplisit;
  const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return domain ? `https://${domain}/api/payments/midtrans` : null;
}

export interface SnapParams {
  orderId: string;
  amount: number;
  items: BookingLine[];
  name: string;
  phone: string;
  destinationName: string;
}

/**
 * Buat transaksi Snap, kembalikan tokennya.
 *
 * `enabled_payments: ['other_qris']` = QR generik berlogo banyak penerbit, dan
 * kalau disebut eksplisit begini dia tetap muncul di layar sempit. Dibatasi
 * QRIS saja bukan karena metode lain tidak jalan, melainkan karena penahanan
 * kursi 15 menit hanya masuk akal untuk pembayaran yang selesai dalam hitungan
 * menit — nomor virtual account bisa dipegang berjam-jam.
 */
export async function createSnapTransaction(p: SnapParams): Promise<string> {
  const notif = notificationUrl();
  const res = await fetch(`${HOST}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader(),
      ...(notif ? { 'X-Override-Notification': notif } : {}),
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: p.orderId,
        gross_amount: Math.round(p.amount),
      },
      enabled_payments: ['other_qris'],
      expiry: { unit: 'minute', duration: HOLD_MENIT },
      // Harga per baris SUDAH dikali jam, dan jumlahnya harus sama persis
      // dengan gross_amount — kalau meleset serupiah pun Midtrans menolak
      // seluruh permintaannya. Sewa per jam yang dikirim mentah (price saja,
      // tanpa hours) adalah cara paling gampang meleset di sini.
      item_details: p.items.map((l) => ({
        id: potong(l.id, 50),
        name: potong(l.label, 50),
        price: Math.round(lineTotal(l) / (l.qty || 1)),
        quantity: l.qty,
      })),
      customer_details: {
        first_name: potong(p.name, 20),
        phone: potong(p.phone, 19),
      },
      // Muncul di dashboard Midtrans, memudahkan pengelola mencocokkan
      // pembayaran dengan destinasinya tanpa membuka aplikasi ini.
      custom_field1: potong(p.destinationName, 255),
    }),
  });

  const data = (await res.json()) as { token?: string; error_messages?: string[] };
  if (!res.ok || !data.token) {
    throw new Error(data.error_messages?.join('; ') || `midtrans-${res.status}`);
  }
  return data.token;
}

/** Bentuk notifikasi yang dipakai — sisanya diabaikan. */
export interface SnapNotification {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
}

/**
 * Benarkah notifikasi ini dari Midtrans?
 *
 * Route webhook TIDAK memverifikasi ID token seperti route lain — Midtrans
 * tidak punya akun di aplikasi ini. Tanda tangan inilah satu-satunya
 * autentikasinya, jadi lolos di sini setara dengan "boleh menandai lunas".
 *
 * timingSafeEqual, bukan `===`: perbandingan biasa berhenti di karakter
 * pertama yang beda, dan selisih waktunya cukup untuk menebak tanda tangan
 * satu karakter demi satu karakter.
 */
export function verifySignature(n: SnapNotification): boolean {
  const kirim = String(n.signature_key ?? '');
  const hitung = crypto
    .createHash('sha512')
    .update(`${n.order_id ?? ''}${n.status_code ?? ''}${n.gross_amount ?? ''}${serverKey()}`)
    .digest('hex');
  if (kirim.length !== hitung.length) return false;
  return crypto.timingSafeEqual(Buffer.from(kirim), Buffer.from(hitung));
}

/**
 * Terjemahkan status Midtrans jadi tiga keputusan yang dimengerti aplikasi.
 *
 * `capture` ikut dianggap lunas: itu status kartu yang dananya sudah diambil
 * dan akan settle sendiri. `pending` sengaja tidak memindahkan apa pun —
 * kursinya sudah tertahan sejak tokennya dibuat.
 */
export function bacaStatus(n: SnapNotification): 'lunas' | 'gagal' | 'menunggu' {
  const s = n.transaction_status;
  if (s === 'settlement' || s === 'capture') {
    // fraud_status hanya ada pada kartu; kalau ada dan bukan 'accept', dananya
    // ditahan untuk ditinjau dan belum boleh diperlakukan sebagai lunas.
    return n.fraud_status && n.fraud_status !== 'accept' ? 'menunggu' : 'lunas';
  }
  if (s === 'deny' || s === 'cancel' || s === 'expire' || s === 'failure') return 'gagal';
  return 'menunggu';
}
