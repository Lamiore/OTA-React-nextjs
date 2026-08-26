import { adminDb } from './firebaseAdmin.ts';
import { bacaStatus, type SnapNotification } from './midtrans.ts';

export type HasilBayar =
  | 'lunas'
  | 'sudah-lunas'
  | 'dibatalkan'
  | 'menunggu'
  | 'order-basi'
  | 'jumlah-beda'
  | 'notfound';

/**
 * Terapkan kabar status Midtrans ke satu booking. SATU-SATUNYA tempat booking
 * boleh jadi 'paid'.
 *
 * Dipanggil dua arah, dan sengaja lewat fungsi yang sama:
 * - DORONG — webhook /api/payments/midtrans, badan permintaan dari Midtrans
 *   yang tanda tangannya sudah diperiksa route itu.
 * - TARIK — aksi 'sync' di /api/bookings, jawaban cekStatus() dari panggilan
 *   keluar kita sendiri. Klien hanya menyebut bookingId; status pembayaran
 *   TIDAK PERNAH datang dari badan permintaan klien.
 *
 * Dua arah harus mengambil keputusan yang sama persis — salinan kedua dari
 * aturan ini adalah salinan yang kelak longgar, dan yang longgar itu pintu
 * masuk tiket gratis.
 */
export async function terapkanStatus(
  bookingId: string,
  n: SnapNotification,
): Promise<HasilBayar> {
  const orderId = String(n.order_id ?? '');
  const status = bacaStatus(n);
  if (status === 'menunggu') return 'menunggu';

  const ref = adminDb().doc(`bookings/${bookingId}`);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'notfound';
    const b = snap.data() ?? {};

    // Idempoten: notifikasi yang sama boleh datang berkali-kali, dan yang
    // kedua tidak boleh menulis ulang apa pun. Berlaku juga saat webhook dan
    // sync kebetulan tiba bersamaan untuk satu pembayaran.
    if (b.paymentStatus === 'paid') return 'sudah-lunas';
    if (b.orderId !== orderId) {
      // Tagihan kedaluwarsa yang baru melapor = rutin, tidak perlu berisik.
      // Tapi tagihan lama yang LUNAS berarti QRIS dibayar di detik-detik
      // terakhir sementara pemesannya sudah menekan bayar lagi: uangnya masuk,
      // tiketnya tidak terbit, dan tanpa baris ini tidak ada jejak sama sekali.
      if (status === 'lunas') console.error('[midtrans] pembayaran untuk tagihan lama', orderId);
      return 'order-basi';
    }

    if (status === 'gagal') {
      // Kembali ke keadaan sebelum tombol bayar ditekan. Penahanan kursinya
      // ikut lepas di sini, tidak perlu menunggu holdUntil habis sendiri.
      tx.update(ref, { paymentStatus: 'unpaid', holdUntil: null, snapToken: null });
      return 'dibatalkan';
    }

    const dibayar = Number(n.gross_amount);
    const tagihan = Number(b.amount ?? 0);
    // Toleransi 1 rupiah: Midtrans mengirim "185000.00" sebagai string desimal.
    if (!Number.isFinite(dibayar) || Math.abs(dibayar - tagihan) > 1) {
      // Uang sudah diterima untuk tagihan yang tidak cocok dengan bookingnya —
      // tidak boleh diam-diam jadi tiket, dan tidak boleh diam-diam hilang.
      console.error('[midtrans] jumlah tidak cocok, ditahan manual', orderId, n.gross_amount);
      return 'jumlah-beda';
    }

    tx.update(ref, {
      paymentStatus: 'paid',
      paymentMethod: String(n.payment_type ?? 'qris'),
      paidAt: new Date(),
      status: 'confirmed',
      holdUntil: null,
      snapToken: null,
    });
    return 'lunas';
  });
}
