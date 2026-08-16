import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { bacaStatus, verifySignature, type SnapNotification } from '@/lib/midtrans';

export const runtime = 'nodejs';

/**
 * Webhook Midtrans — satu-satunya tempat booking boleh jadi 'paid'.
 *
 * SENGAJA TANPA verifyIdToken, tidak seperti route lain di aplikasi ini:
 * Midtrans tidak punya akun di sini. Tanda tangan SHA512 pada badan
 * permintaannya yang jadi autentikasi, dan lolos dari situ setara persis
 * dengan "boleh menerbitkan tiket". Karena itu tidak ada satu pun jalan keluar
 * di bawah yang melewatkan pemeriksaannya.
 *
 * Yang TIDAK dipercaya dari notifikasi ini:
 * - Jumlahnya. Dicocokkan dengan `amount` booking saat itu juga. Midtrans
 *   melaporkan jumlah yang KITA beritahukan padanya, jadi tagihan yang dibuat
 *   saat booking masih 500rb tetap melapor 500rb walau bookingnya sudah
 *   berubah jadi 2 juta. Penjaga di update/cancel menutup jalannya dari hulu;
 *   baris ini yang menangkapnya kalau penjaga itu kelak bocor.
 * - Nomor booking-nya sendiri. order_id dicocokkan dengan yang tersimpan,
 *   supaya notifikasi tagihan lama yang kedaluwarsa tidak menganulir tagihan
 *   baru yang sedang berjalan.
 *
 * Selalu 200 selama tanda tangannya sah, termasuk untuk hal yang tidak kita
 * urus. Midtrans mengulang kiriman yang tidak dibalas 200, dan pengulangan
 * abadi untuk booking yang memang sudah tidak ada cuma jadi bising.
 */
export async function POST(req: Request) {
  let n: SnapNotification;
  try {
    n = (await req.json()) as SnapNotification;
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  if (!verifySignature(n)) {
    console.warn('[midtrans] tanda tangan tidak sah', n.order_id);
    return NextResponse.json({ error: 'bad-signature' }, { status: 403 });
  }

  const orderId = String(n.order_id ?? '');
  // order_id = "<bookingId>-<percobaan>". Yang dibuang cuma nomor percobaannya.
  const bookingId = orderId.replace(/-\d+$/, '');
  if (!bookingId) return NextResponse.json({ ok: true, skip: 'no-order-id' });

  const status = bacaStatus(n);
  if (status === 'menunggu') return NextResponse.json({ ok: true, skip: 'pending' });

  const ref = adminDb().doc(`bookings/${bookingId}`);
  const hasil = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'notfound';
    const b = snap.data() ?? {};

    // Idempoten: notifikasi yang sama boleh datang berkali-kali, dan yang
    // kedua tidak boleh menulis ulang apa pun.
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

  if (hasil === 'jumlah-beda') {
    // Uang sudah diterima untuk tagihan yang tidak cocok dengan bookingnya —
    // tidak boleh diam-diam jadi tiket, dan tidak boleh diam-diam hilang.
    console.error('[midtrans] jumlah tidak cocok, ditahan manual', orderId, n.gross_amount);
  }
  return NextResponse.json({ ok: true, hasil });
}
