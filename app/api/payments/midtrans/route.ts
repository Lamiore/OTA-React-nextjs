import { NextResponse } from 'next/server';
import { verifySignature, type SnapNotification } from '@/lib/midtrans';
import { terapkanStatus } from '@/lib/pembayaran';

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
 *
 * Keputusan apa yang ditulis ke bookingnya ada di terapkanStatus (lib/
 * pembayaran), dipakai bareng aksi 'sync' yang menanyakan status ke Midtrans
 * saat webhook-nya tidak pernah sampai.
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

  const hasil = await terapkanStatus(bookingId, n);
  return NextResponse.json({ ok: true, hasil });
}
