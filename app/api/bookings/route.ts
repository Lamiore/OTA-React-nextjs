import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import {
  availability,
  bookedPerItem,
  bookingLines,
  bookingTotal,
  getPriceItems,
  overStock,
  type BookingForCount,
} from '@/lib/destination';

export const runtime = 'nodejs';

/**
 * Satu-satunya pintu tulis koleksi `bookings`. Rules menutup create/update dari
 * klien sepenuhnya (lihat firestore.rules) — Admin SDK melewati rules, jadi
 * semua perubahan status tiket harus melewati file ini.
 *
 * Empat aksi disatukan dalam satu route, bukan empat file, karena semuanya
 * berbagi bagian yang sama persis: verifikasi ID token, ambil dokumen booking,
 * cek siapa yang berhak. Dipecah, bagian itu tersalin empat kali dan cukup
 * satu salinan yang lupa diperbarui untuk membuka kembali lubang yang sedang
 * ditutup di sini.
 *
 * Stok per item per hari ditegakkan di cabang "pay", bukan "create" — booking
 * yang belum dibayar sengaja tidak menahan kursi. Lihat catatan panjangnya di
 * fungsi pay().
 *
 * Yang TIDAK dipasang, dan kapan perlu dipasang:
 * - Idempotensi (kunci permintaan). Kirim dobel sekarang menghasilkan dua
 *   booking 'pending' yang belum dibayar — tidak merugikan siapa pun, dan
 *   tombolnya sudah dikunci saat submit. Perlu begitu pembayaran sungguhan
 *   masuk: di sana order_id-nya yang jadi kunci.
 * - Batas waktu booking yang menganggur. Belum perlu selama pembayarannya
 *   seketika; begitu gateway sungguhan masuk dan 'pending' bisa bertahan
 *   berjam-jam, daftar "menunggu pembayaran" akan penuh sampah tanpa penyapu.
 */

/** Batas jumlah tamu — cocokkan dengan min/max input di halaman booking. */
const MAX_GUESTS = 100;

type Ctx = { uid: string; role: string };

function bad(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Ambil string yang sudah dirapikan & dibatasi panjangnya. */
function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Id dokumen dari klien, divalidasi sebelum dipakai menyusun path.
 *
 * Tanpa ini `doc(\`destinations/${id}\`)` bisa dibelokkan dengan menyelipkan
 * garis miring — nilai seperti "x/y/users/admin" menunjuk dokumen yang sama
 * sekali lain. Sama alasannya dengan parseTicketId di ScanPanel. Yang
 * diizinkan hanya bentuk id Firestore yang wajar; string kosong berarti gagal.
 */
function docId(v: unknown): string {
  const s = str(v, 128);
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : '';
}

/**
 * Booking berbayar pada satu destinasi + tanggal — dasar hitungan stok.
 *
 * Hanya yang `paid`: booking yang menunggu pembayaran sengaja tidak menahan
 * stok (keputusan produk, lihat catatan di lib/destination). Yang dibatalkan
 * ikut tersaring belakangan di bookedPerItem, bukan di query, supaya tidak
 * perlu filter ketidaksamaan yang menuntut composite index.
 */
function paidQuery(destinationId: string, date: string) {
  return adminDb()
    .collection('bookings')
    .where('destinationId', '==', destinationId)
    .where('date', '==', date)
    .where('paymentStatus', '==', 'paid');
}

/**
 * Sisa stok tiap item destinasi pada satu tanggal.
 *
 * SENGAJA TANPA AUTENTIKASI. Yang dikembalikan cuma angka agregat — stok,
 * terjual, sisa — tanpa nama, telepon, atau id booking siapa pun. Halaman
 * booking menampilkan sisa kursi sebelum pengunjung masuk akun, dan sejak
 * rules menutup akses baca koleksi bookings, browser tidak punya cara lain
 * menghitungnya sendiri.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const destinationId = docId(url.searchParams.get('dest'));
  const date = str(url.searchParams.get('date'), 10);
  if (!destinationId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('bad-request', 400);

  const destSnap = await adminDb().doc(`destinations/${destinationId}`).get();
  if (!destSnap.exists) return bad('destination-notfound', 404);

  const paid = await paidQuery(destinationId, date).get();
  const booked = bookedPerItem(paid.docs.map((d) => d.data() as BookingForCount));

  return NextResponse.json({
    items: availability(getPriceItems(destSnap.data() ?? {}), booked),
  });
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return bad('unauthorized', 401);

  let uid: string;
  let emailVerified: boolean;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
    emailVerified = decoded.email_verified === true;
  } catch {
    return bad('unauthorized', 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad('bad-request', 400);
  }

  // Halaman booking sudah menolak pengguna yang emailnya belum diverifikasi —
  // tapi itu penjagaan di layar, dan seluruh perubahan ini justru soal
  // memindahkan penjagaan dari layar ke server. Tanpa baris ini, gerbangnya
  // masih bisa dilewati dengan memanggil route ini langsung.
  if (!emailVerified) return bad('email-not-verified', 403);

  const role = (await adminDb().doc(`users/${uid}`).get()).data()?.role ?? 'user';
  const ctx: Ctx = { uid, role };

  switch (body.action) {
    case 'create':
      return create(ctx, body);
    case 'pay':
      return pay(ctx, body);
    case 'cancel':
      return cancel(ctx, body);
    case 'checkin':
      return checkin(ctx, body);
    default:
      return bad('bad-action', 400);
  }
}

/**
 * Buat booking. Harga TIDAK diterima dari klien: server membaca dokumen
 * destinasinya sendiri, memakai daftar harga di situ, dan menghitung ulang
 * totalnya lewat rumus yang sama dengan yang dipakai ringkasan di layar
 * (bookingLines/bookingTotal di lib/destination).
 *
 * Statusnya 'pending' + 'unpaid' — belum ada tiket. Dulu di sini langsung
 * 'confirmed', dan itulah kenapa QR bisa terbit tanpa membayar sepeser pun.
 */
async function create(ctx: Ctx, body: Record<string, unknown>) {
  const destinationId = docId(body.destinationId);
  const date = str(body.date, 10);
  const name = str(body.name, 120);
  const phone = str(body.phone, 32);
  const notes = str(body.notes, 500);
  const qty = (body.qty ?? {}) as Record<string, unknown>;

  if (!destinationId || !name || !phone) return bad('missing-field', 400);
  if (typeof qty !== 'object' || Array.isArray(qty)) return bad('bad-qty', 400);

  // Tanggal: bentuk ketat + tidak boleh sebelum hari ini menurut UTC. UTC
  // sengaja: semua zona Indonesia ada di depannya, jadi batas ini tidak pernah
  // salah menolak booking untuk hari yang di tempat pengguna masih berjalan.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('bad-date', 400);
  if (date < new Date().toISOString().slice(0, 10)) return bad('past-date', 400);

  const guests = Math.floor(Number(body.guests));
  if (!Number.isFinite(guests) || guests < 1 || guests > MAX_GUESTS) {
    return bad('bad-guests', 400);
  }

  const destSnap = await adminDb().doc(`destinations/${destinationId}`).get();
  if (!destSnap.exists) return bad('destination-notfound', 404);
  const dest = destSnap.data() ?? {};

  const items = bookingLines(getPriceItems(dest), qty);
  if (items.length === 0) return bad('no-items', 400);
  const amount = bookingTotal(items);
  // Sabuk pengaman terakhir sebelum angka ini jadi tagihan. bookingLines sudah
  // menggugurkan harga rusak, jadi sampai di sini seharusnya mustahil — tapi
  // "seharusnya" bukan alasan yang cukup untuk menyimpannya diam-diam.
  if (!Number.isFinite(amount) || amount < 0) return bad('bad-amount', 500);

  // Cek stok yang RAMAH, bukan yang mengikat. Gunanya menolak lebih awal saat
  // itemnya jelas-jelas sudah penuh, supaya pengunjung tidak mengisi formulir
  // untuk kursi yang tidak ada. Yang mengikat ada di cabang "pay": booking
  // yang belum dibayar tidak menahan stok, jadi antara sini dan pembayaran
  // stoknya masih bisa habis diambil orang lain — dan di sanalah penolakan
  // yang sebenarnya terjadi, di dalam transaksi.
  const paidSnap = await paidQuery(destinationId, date).get();
  const booked = bookedPerItem(paidSnap.docs.map((d) => d.data() as BookingForCount));
  const penuh = overStock(items, getPriceItems(dest), booked);
  if (penuh.length > 0) {
    return NextResponse.json({ error: 'full', full: penuh }, { status: 409 });
  }

  const ref = await adminDb().collection('bookings').add({
    userId: ctx.uid,
    destinationId,
    destinationName: dest.name ?? '',
    date,
    guests,
    name,
    phone,
    notes,
    items,
    amount,
    status: 'pending',
    paymentStatus: 'unpaid',
    createdAt: new Date(),
  });

  return NextResponse.json({ id: ref.id, amount });
}

/**
 * Tandai lunas, lalu naikkan status ke 'confirmed' — di sinilah tiket terbit.
 *
 * Isinya masih tiruan (belum ada gateway), tapi keputusannya sudah di server
 * dan bentuk alurnya sudah benar. Menyambungkan gateway nanti berarti memecah
 * fungsi ini jadi dua: satu membuat transaksi pembayaran, satu lagi webhook
 * yang menjalankan bagian bawah ini setelah dananya benar-benar dikonfirmasi.
 *
 * Di sinilah pula kuota ditegakkan.
 *
 * Karena booking yang belum dibayar tidak menahan stok, pembayaran adalah
 * satu-satunya titik yang tahu pasti berapa kursi sudah terjual. Hitungannya
 * dilakukan DI DALAM transaksi: Admin SDK memakai transaksi berkunci di
 * server, jadi query di sini benar-benar menahan pesaing — sudah diuji dengan
 * 8 pembayaran serentak pada stok 2, dan tepat 2 yang lolos, lima ronde
 * berturut-turut (lihat bookings.probe.mjs).
 *
 * Semua pembacaan harus selesai sebelum penulisan pertama — itu syarat
 * transaksi Firestore, dan urutan di bawah sudah mematuhinya.
 */
async function pay(ctx: Ctx, body: Record<string, unknown>) {
  const id = docId(body.bookingId);
  const method = str(body.method, 40);
  if (!id || !method) return bad('missing-field', 400);

  const ref = adminDb().doc(`bookings/${id}`);

  const outcome = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: 'notfound' as const };
    const b = snap.data() ?? {};
    if (b.userId !== ctx.uid) return { kind: 'forbidden' as const };
    if (b.status === 'cancelled') return { kind: 'cancelled' as const };
    if (b.paymentStatus === 'paid') return { kind: 'already-paid' as const };

    const destSnap = await tx.get(adminDb().doc(`destinations/${b.destinationId}`));
    const paidSnap = await tx.get(paidQuery(b.destinationId, b.date));
    const booked = bookedPerItem(paidSnap.docs.map((d) => d.data() as BookingForCount));
    const penuh = overStock(b.items ?? [], getPriceItems(destSnap.data() ?? {}), booked);
    if (penuh.length > 0) return { kind: 'full' as const, full: penuh };

    tx.update(ref, {
      paymentStatus: 'paid',
      paymentMethod: method,
      paidAt: new Date(),
      status: 'confirmed',
    });
    return { kind: 'success' as const };
  });

  if (outcome.kind === 'notfound') return bad('notfound', 404);
  if (outcome.kind === 'forbidden') return bad('forbidden', 403);
  if (outcome.kind === 'cancelled') return bad('cancelled', 409);
  if (outcome.kind === 'full') {
    // 409, bukan 500: bukan kesalahan, kursinya memang keburu diambil orang
    // lain antara booking dibuat dan tombol Bayar ditekan.
    return NextResponse.json({ error: 'full', full: outcome.full }, { status: 409 });
  }
  return NextResponse.json({ ok: true, outcome: outcome.kind });
}

/**
 * Batalkan booking sendiri.
 *
 * Penjaga yang dulu tidak ada: tiket yang sudah dipakai masuk tidak bisa
 * dibatalkan. Tanpa ini, pengunjung yang sudah di-scan bisa membatalkan
 * tiketnya sesudah masuk dan statistik pengelola ikut salah.
 *
 * ponytail: pembatalan booking yang sudah lunas tetap diizinkan dan uangnya
 * tidak dikembalikan otomatis — belum ada jalur refund sama sekali. Pasang
 * saat gateway sungguhan masuk, bareng dengan endpoint refund-nya.
 */
async function cancel(ctx: Ctx, body: Record<string, unknown>) {
  const id = docId(body.bookingId);
  if (!id) return bad('missing-field', 400);

  const ref = adminDb().doc(`bookings/${id}`);
  const outcome = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'notfound';
    const b = snap.data() ?? {};
    if (b.userId !== ctx.uid && ctx.role !== 'admin') return 'forbidden';
    if (b.status === 'used') return 'already-used';
    tx.update(ref, { status: 'cancelled' });
    return 'success';
  });

  if (outcome === 'notfound') return bad('notfound', 404);
  if (outcome === 'forbidden') return bad('forbidden', 403);
  if (outcome === 'already-used') return bad('already-used', 409);
  return NextResponse.json({ ok: true });
}

/**
 * Check-in tiket oleh petugas (admin/pengelola).
 *
 * Dua hal yang berubah dari versi klien:
 * 1. Transaksinya sekarang benar-benar mengunci. Dulu pemilik tiket boleh
 *    meng-update dokumennya sendiri, jadi status 'used' bisa ditulis balik
 *    jadi 'confirmed' dan satu QR dipakai masuk berkali-kali.
 * 2. Tiket yang belum dibayar ditolak di gerbang. 'pending' sekarang berarti
 *    "menunggu pembayaran" — dulu maknanya sama dengan 'confirmed' dan
 *    diloloskan begitu saja.
 */
async function checkin(ctx: Ctx, body: Record<string, unknown>) {
  if (ctx.role !== 'admin' && ctx.role !== 'pengelola') return bad('forbidden', 403);

  const id = docId(body.bookingId);
  if (!id) return bad('missing-field', 400);

  const ref = adminDb().doc(`bookings/${id}`);
  const outcome = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'notfound';
    const b = snap.data() ?? {};
    if (b.status === 'used') return 'already-used';
    if (b.status === 'cancelled') return 'cancelled';
    if (b.paymentStatus !== 'paid') return 'unpaid';
    tx.update(ref, { status: 'used', checkedInAt: new Date() });
    return 'success';
  });

  return NextResponse.json({ outcome });
}
