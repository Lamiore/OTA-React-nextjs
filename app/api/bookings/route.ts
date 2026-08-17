import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { docId, str } from '@/lib/format';
import {
  availability,
  bookedPerItem,
  bookingLines,
  bookingTotal,
  getPriceItems,
  overStock,
  type BookingForCount,
  type BookingLine,
} from '@/lib/destination';
import { createSnapTransaction, HOLD_MENIT, SNAP_JS } from '@/lib/midtrans';

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

type Ctx = { uid: string; role: string };

/**
 * Batas booking belum-bayar yang boleh menggantung sekaligus per akun.
 *
 * Bukan penjaga uang — yang menjaga stok adalah penahanan 15 menit di cabang
 * "pay". Ini penjaga sampah: tanpa batas, satu akun bisa menyemprot ratusan
 * booking yang tidak akan pernah dibayar, dan daftar pengelola tenggelam. Yang
 * dibatasi cuma yang MENGGANTUNG — membayar atau membatalkan langsung
 * mengembalikan jatahnya, jadi orang yang benar-benar memesan tidak pernah
 * menyentuh angka ini.
 */
const MAX_UNPAID = 3;

function bad(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// `str` dan `docId` pindah ke lib/format.ts — dua route lain (delete-user,
// notify-approval) menyusun path dari id mentah karena tidak punya akses ke
// salinan yang ada di sini. Alasan lengkapnya ditulis di sana.

/**
 * Booking yang menahan kursi pada satu destinasi + tanggal — dasar hitungan stok.
 *
 * Dua golongan ikut: yang sudah lunas, dan yang sedang dibayar. Yang kedua
 * masuk sejak Midtrans dipasang — uang diambil sebelum webhook memberi tahu
 * kita, jadi kursinya harus ditahan selama jendela itu.
 *
 * `in` dua nilai, bukan dua query terpisah: Firestore menjalankannya sebagai
 * gabungan query kesamaan, jadi syarat index-nya sama saja dengan sebelumnya.
 *
 * Batas waktu penahanan TIDAK disaring di sini melainkan di bookedPerItem,
 * sama seperti pembatalan — filter ketidaksamaan menuntut composite index yang
 * belum ada, dan menyaringnya di memori jauh lebih murah daripada mengurus itu.
 */
function stokQuery(destinationId: string, date: string) {
  return adminDb()
    .collection('bookings')
    .where('destinationId', '==', destinationId)
    .where('date', '==', date)
    .where('paymentStatus', 'in', ['paid', 'pending']);
}

/**
 * Ada pembayaran yang sedang berjalan untuk booking ini?
 *
 * Penjaga yang menutup lubang eskalasi: tanpa ini, booking 500rb bisa diubah
 * jadi 2 juta SESUDAH transaksi Midtrans-nya dibuat, lalu dibayar dengan
 * tagihan lama. Tanda tangan webhooknya akan sah sempurna — Midtrans jujur
 * melaporkan jumlah yang kita sendiri beritahukan kepadanya.
 */
function pembayaranHidup(b: FirebaseFirestore.DocumentData): boolean {
  return b.paymentStatus === 'pending' && Number(b.holdUntil) > Date.now();
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
  if (!destinationId) return bad('bad-request', 400);

  const date = str(url.searchParams.get('date'), 10);
  // `days` = mode strip: sisa untuk BANYAK tanggal sekaligus. Tanpa itu,
  // perilakunya persis seperti sebelumnya (satu tanggal) — halaman destinasi
  // yang sudah tayang memakai bentuk itu dan tidak ikut berubah.
  const banyakTanggal = url.searchParams.get('days') === '1';
  if (!banyakTanggal && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('bad-request', 400);

  const destSnap = await adminDb().doc(`destinations/${destinationId}`).get();
  if (!destSnap.exists) return bad('destination-notfound', 404);
  const items = getPriceItems(destSnap.data() ?? {});

  if (!banyakTanggal) {
    const paid = await stokQuery(destinationId, date).get();
    const booked = bookedPerItem(paid.docs.map((d) => d.data() as BookingForCount));
    return NextResponse.json({ items: availability(items, booked) });
  }

  // Satu query untuk semua tanggal, lalu dikelompokkan di sini.
  //
  // Bukan query rentang, dan bukan pula belasan query sehari-satu. Rentang
  // (`date >= x && date <= y` bersama dua filter kesamaan) menuntut composite
  // index yang belum ada sama sekali di koleksi ini — query kesamaan saja
  // dilayani index bawaan lewat zigzag merge, jadi menjatuhkan filter tanggal
  // justru membuatnya tetap bebas index.
  //
  // ponytail: konsekuensinya seluruh booking berbayar destinasi ini terbaca,
  // bukan cuma tanggal yang diminta. Aman selama satu destinasi punya puluhan
  // sampai ratusan booking. Ganti jadi filter rentang + composite index kalau
  // satu destinasi sudah menyimpan ribuan.
  const semua = await adminDb()
    .collection('bookings')
    .where('destinationId', '==', destinationId)
    .where('paymentStatus', 'in', ['paid', 'pending'])
    .get();

  const perTanggal: Record<string, BookingForCount[]> = {};
  for (const d of semua.docs) {
    const b = d.data() as BookingForCount & { date?: string };
    if (typeof b.date !== 'string') continue;
    (perTanggal[b.date] ??= []).push(b);
  }

  // Hanya tanggal yang PUNYA penjualan yang dikirim. Tanggal yang tidak
  // disebut berarti belum ada yang terjual, dan klien sudah tahu artinya
  // "stok penuh" — mengirim seluruh kalender kosong cuma memperbesar balasan.
  const days: Record<string, ReturnType<typeof availability>> = {};
  for (const tanggal of Object.keys(perTanggal)) {
    days[tanggal] = availability(items, bookedPerItem(perTanggal[tanggal]));
  }

  return NextResponse.json({ items: availability(items, {}), days });
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
    case 'update':
      return update(ctx, body);
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
 * Nama yang dicetak di tiket — dibaca dari akun, bukan dari body permintaan.
 * Layar booking sudah tidak menawarkan kolomnya, dan yang dicocokkan petugas di
 * gerbang justru nama ini.
 *
 * Sumbernya Auth, bukan dokumen users: Profil › Pengaturan hanya menulis
 * displayName di Auth, jadi `users/{uid}.name` bisa tertinggal berbulan-bulan
 * dan tiketnya keluar dengan nama lama.
 */
async function namaPemesan(uid: string): Promise<string> {
  const akun = await adminAuth().getUser(uid);
  // Fallback bagian email sebelum "@" — sama dengan nama awal yang dipasang
  // saat akun dibuat (lihat verify-code). Akun tanpa nama sama sekali tidak
  // boleh berarti booking yang gagal terkirim.
  return str(akun.displayName, 120) || str(akun.email, 120).split('@')[0];
}

/**
 * No. HP kontak, plus penyimpanan nomor pertama ke profil.
 *
 * Kolomnya di layar sudah terisi dari profil, tapi yang menentukan tetap
 * server: prefill yang belum sempat termuat (jaringan lambat, bacaan gagal)
 * tidak boleh berubah jadi 'missing-field' padahal nomornya jelas ada.
 *
 * Ditulis balik HANYA kalau profilnya masih kosong. Nomor yang sengaja diatur
 * di Pengaturan Akun tidak boleh diam-diam tertimpa oleh satu booking yang
 * nomornya dipinjam dari orang lain.
 */
async function nomorHp(uid: string, diminta: string): Promise<string> {
  const ref = adminDb().doc(`users/${uid}`);
  const tersimpan = str((await ref.get()).data()?.phone, 32);
  if (!diminta) return tersimpan;
  // merge, bukan update(): dokumen users yang belum ada melempar di update()
  // dan itu akan menggagalkan seluruh bookingnya cuma karena menyimpan bawaan.
  if (!tersimpan) await ref.set({ phone: diminta }, { merge: true });
  return diminta;
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
  const notes = str(body.notes, 500);
  const qty = (body.qty ?? {}) as Record<string, unknown>;

  if (!destinationId) return bad('missing-field', 400);
  if (typeof qty !== 'object' || Array.isArray(qty)) return bad('bad-qty', 400);

  // Tanggal: bentuk ketat + tidak boleh sebelum hari ini menurut UTC. UTC
  // sengaja: semua zona Indonesia ada di depannya, jadi batas ini tidak pernah
  // salah menolak booking untuk hari yang di tempat pengguna masih berjalan.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('bad-date', 400);
  if (date < new Date().toISOString().slice(0, 10)) return bad('past-date', 400);

  // Dihitung sebelum apa pun ditulis. Batalan tidak ikut — dokumennya tetap
  // 'unpaid' selamanya, jadi menghitungnya berarti jatah yang habis sekali lalu
  // tidak pernah kembali. Disaring di memori, bukan lewat `!=` di query, karena
  // ketidaksamaan menuntut composite index yang belum ada (sama alasannya
  // dengan stokQuery).
  const gantung = await adminDb()
    .collection('bookings')
    .where('userId', '==', ctx.uid)
    .where('paymentStatus', 'in', ['unpaid', 'pending'])
    .get();
  const belumBayar = gantung.docs.filter((d) => d.data().status !== 'cancelled').length;
  if (belumBayar >= MAX_UNPAID) {
    return NextResponse.json({ error: 'too-many-unpaid', max: MAX_UNPAID }, { status: 409 });
  }

  const phone = await nomorHp(ctx.uid, str(body.phone, 32));
  if (!phone) return bad('missing-field', 400);

  const name = await namaPemesan(ctx.uid);

  const destSnap = await adminDb().doc(`destinations/${destinationId}`).get();
  if (!destSnap.exists) return bad('destination-notfound', 404);
  const dest = destSnap.data() ?? {};

  // body.hours dilempar mentah — resolveHours di dalam bookingLines yang
  // membersihkannya, di tempat yang sama dengan pembersihan jumlah. Ditaruh di
  // sini juga, angka jam dari klien akan punya dua penjaga yang bisa berbeda.
  const items = bookingLines(getPriceItems(dest), qty, body.hours);
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
  const stokSnap = await stokQuery(destinationId, date).get();
  const booked = bookedPerItem(stokSnap.docs.map((d) => d.data() as BookingForCount));
  const penuh = overStock(items, getPriceItems(dest), booked);
  if (penuh.length > 0) {
    return NextResponse.json({ error: 'full', full: penuh }, { status: 409 });
  }

  const ref = await adminDb().collection('bookings').add({
    userId: ctx.uid,
    destinationId,
    destinationName: dest.name ?? '',
    date,
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
 * Ubah booking yang BELUM dibayar: tanggal, item, jumlah, durasi, telepon,
 * catatan. Menggantikan "batalkan lalu pesan ulang" — yang sebelumnya jadi
 * satu-satunya cara menambah satu tiket.
 *
 * Yang TIDAK bisa diubah, dan alasannya:
 * - Destinasi. Dibaca dari dokumennya sendiri, tidak pernah dari body: pindah
 *   destinasi berarti daftar harga, stok, dan pengelola yang lain sama sekali —
 *   itu booking baru, bukan perubahan.
 * - Harga & total. Dihitung ulang server dari daftar harga destinasi, persis
 *   seperti di create. Bagian ini yang membuat "ubah" tidak jadi pintu belakang
 *   untuk menulis `amount` sendiri.
 * - Status & pembayaran. Tidak disentuh sama sekali di sini.
 *
 * Di dalam transaksi, bukan baca-lalu-tulis biasa. Tanpa itu, pembayaran yang
 * masuk di tab lain tepat setelah pemeriksaan `paymentStatus` akan menemukan
 * item & tagihannya berubah SESUDAH uangnya diterima.
 */
async function update(ctx: Ctx, body: Record<string, unknown>) {
  const id = docId(body.bookingId);
  const date = str(body.date, 10);
  const notes = str(body.notes, 500);
  const qty = (body.qty ?? {}) as Record<string, unknown>;

  if (!id) return bad('missing-field', 400);
  if (typeof qty !== 'object' || Array.isArray(qty)) return bad('bad-qty', 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('bad-date', 400);
  if (date < new Date().toISOString().slice(0, 10)) return bad('past-date', 400);

  // Di luar transaksi: nomorHp menulis sendiri, dan transaksi di bawah bisa
  // diulang berkali-kali saat berebut dokumen yang sama.
  const phone = await nomorHp(ctx.uid, str(body.phone, 32));
  if (!phone) return bad('missing-field', 400);

  // Ikut diperbarui: kalau namanya diganti di Profil sejak booking dibuat,
  // yang tersimpan di sini harus ikut, bukan tertinggal sebagai satu-satunya
  // tempat nama lama masih hidup.
  const name = await namaPemesan(ctx.uid);
  const ref = adminDb().doc(`bookings/${id}`);

  const outcome = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: 'notfound' as const };
    const b = snap.data() ?? {};
    if (b.userId !== ctx.uid) return { kind: 'forbidden' as const };
    if (b.status === 'cancelled') return { kind: 'cancelled' as const };
    if (b.paymentStatus === 'paid') return { kind: 'already-paid' as const };
    // Inti penjagaannya: selama transaksi Midtrans-nya masih hidup, isinya
    // dibekukan. Kalau tidak, tagihan yang sedang dibuka pembeli tidak lagi
    // mewakili apa yang akan diterimanya. Bukan penolakan permanen — begitu
    // penahanannya kedaluwarsa, booking ini bisa diubah lagi seperti biasa.
    if (pembayaranHidup(b)) return { kind: 'payment-pending' as const };

    const destSnap = await tx.get(adminDb().doc(`destinations/${b.destinationId}`));
    if (!destSnap.exists) return { kind: 'destination-notfound' as const };
    const priceItems = getPriceItems(destSnap.data() ?? {});

    const items = bookingLines(priceItems, qty, body.hours);
    if (items.length === 0) return { kind: 'no-items' as const };
    const amount = bookingTotal(items);
    if (!Number.isFinite(amount) || amount < 0) return { kind: 'bad-amount' as const };

    // Stok diperiksa untuk tanggal BARU, bukan `b.date` yang sedang diganti.
    //
    // Booking ini sendiri dikeluarkan lewat id, bukan lewat penalaran status.
    // Dulu cukup beralasan "yang dihitung hanya yang lunas, dan yang sedang
    // diubah belum" — sejak `pending` ikut menahan kursi, alasan itu tidak
    // berlaku lagi dan booking bisa dinyatakan penuh oleh dirinya sendiri.
    const stokSnap = await tx.get(stokQuery(b.destinationId, date));
    const booked = bookedPerItem(
      stokSnap.docs.filter((d) => d.id !== id).map((d) => d.data() as BookingForCount),
    );
    const penuh = overStock(items, priceItems, booked);
    if (penuh.length > 0) return { kind: 'full' as const, full: penuh };

    tx.update(ref, { date, name, phone, notes, items, amount });
    return { kind: 'success' as const, amount };
  });

  if (outcome.kind === 'notfound') return bad('notfound', 404);
  if (outcome.kind === 'forbidden') return bad('forbidden', 403);
  if (outcome.kind === 'cancelled') return bad('cancelled', 409);
  // Terminal, bukan "coba lagi": booking yang sudah lunas tidak boleh berubah
  // isinya, dan layar yang menampilkannya sudah basi.
  if (outcome.kind === 'already-paid') return bad('already-paid', 409);
  // Sementara, bukan terminal: layar menyuruh menyelesaikan atau menunggu
  // pembayarannya kedaluwarsa, lalu mengubahnya lagi.
  if (outcome.kind === 'payment-pending') return bad('payment-pending', 409);
  if (outcome.kind === 'destination-notfound') return bad('destination-notfound', 404);
  if (outcome.kind === 'no-items') return bad('no-items', 400);
  if (outcome.kind === 'bad-amount') return bad('bad-amount', 500);
  if (outcome.kind === 'full') {
    return NextResponse.json({ error: 'full', full: outcome.full }, { status: 409 });
  }
  return NextResponse.json({ id, amount: outcome.amount });
}

/**
 * Buka pembayaran: tahan kursinya, lalu buat transaksi Snap.
 *
 * Fungsi ini TIDAK menandai lunas — itu wewenang webhook, satu-satunya pihak
 * yang tahu uangnya benar-benar masuk. Yang dulu terjadi di sini (paid +
 * confirmed) sekarang ada di /api/payments/midtrans.
 *
 * Di sinilah kuota ditegakkan.
 *
 * Titik pengikatnya bergeser dari "menekan bayar" ke "membuat tagihan", dan
 * harus begitu: gateway mengambil uang sebelum memberi tahu kita, jadi kursi
 * sudah harus jadi milik orang ini sejak QR-nya terbit. Hitungannya di DALAM
 * transaksi — Admin SDK memakai transaksi berkunci di server, jadi query di
 * sini benar-benar menahan pesaing (diuji 8 pembayaran serentak pada stok 2,
 * tepat 2 yang lolos, lima ronde berturut-turut; lihat scripts/bookings.probe.mjs).
 *
 * Panggilan ke Midtrans sengaja DI LUAR transaksi. Transaksi Firestore bisa
 * diulang otomatis saat bentrok, dan mengulang panggilan jaringan di dalamnya
 * berarti menerbitkan beberapa tagihan untuk satu booking. Urutannya: klaim
 * penahanannya dulu, terbitkan tagihan setelahnya, lepaskan penahanan kalau
 * penerbitannya gagal.
 */
async function pay(ctx: Ctx, body: Record<string, unknown>) {
  const id = docId(body.bookingId);
  if (!id) return bad('missing-field', 400);

  const ref = adminDb().doc(`bookings/${id}`);

  const outcome = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: 'notfound' as const };
    const b = snap.data() ?? {};
    if (b.userId !== ctx.uid) return { kind: 'forbidden' as const };
    if (b.status === 'cancelled') return { kind: 'cancelled' as const };
    if (b.paymentStatus === 'paid') return { kind: 'already-paid' as const };

    // Popup ditutup lalu tombol ditekan lagi: kembalikan token yang SAMA.
    // Menerbitkan token baru akan menahan kursinya dua kali untuk satu orang,
    // dan tagihan lama tetap hidup di sisi Midtrans sampai kedaluwarsa.
    if (pembayaranHidup(b) && b.snapToken) {
      return { kind: 'reuse' as const, token: b.snapToken as string };
    }

    const destSnap = await tx.get(adminDb().doc(`destinations/${b.destinationId}`));
    const stokSnap = await tx.get(stokQuery(b.destinationId, b.date));
    // Booking ini sendiri tidak boleh ikut dihitung — penahanannya yang lama
    // (yang sudah kedaluwarsa) akan menyatakan dirinya penuh saat dicoba lagi.
    const booked = bookedPerItem(
      stokSnap.docs.filter((d) => d.id !== id).map((d) => d.data() as BookingForCount),
    );
    const penuh = overStock(b.items ?? [], getPriceItems(destSnap.data() ?? {}), booked);
    if (penuh.length > 0) return { kind: 'full' as const, full: penuh };

    // order_id tidak boleh dipakai ulang di Midtrans. Percobaan kedua setelah
    // QR pertama kedaluwarsa butuh nomor baru, kalau tidak permintaannya
    // ditolak dan tombolnya jadi mati tanpa sebab yang terlihat.
    const attempt = Number(b.payAttempt ?? 0) + 1;
    tx.update(ref, {
      paymentStatus: 'pending',
      holdUntil: Date.now() + HOLD_MENIT * 60_000,
      orderId: `${id}-${attempt}`,
      payAttempt: attempt,
      snapToken: null,
    });
    return {
      kind: 'charge' as const,
      attempt,
      params: {
        orderId: `${id}-${attempt}`,
        amount: Number(b.amount ?? 0),
        items: (b.items ?? []) as BookingLine[],
        name: String(b.name ?? ''),
        phone: String(b.phone ?? ''),
        destinationName: String(b.destinationName ?? ''),
      },
    };
  });

  if (outcome.kind === 'notfound') return bad('notfound', 404);
  if (outcome.kind === 'forbidden') return bad('forbidden', 403);
  if (outcome.kind === 'cancelled') return bad('cancelled', 409);
  if (outcome.kind === 'already-paid') return bad('already-paid', 409);
  if (outcome.kind === 'full') {
    // 409, bukan 500: bukan kesalahan, kursinya memang keburu diambil orang
    // lain antara booking dibuat dan tombol Bayar ditekan.
    return NextResponse.json({ error: 'full', full: outcome.full }, { status: 409 });
  }
  if (outcome.kind === 'reuse') {
    return NextResponse.json({ token: outcome.token, snapUrl: SNAP_JS });
  }

  let token: string;
  try {
    token = await createSnapTransaction(outcome.params);
  } catch (err) {
    // Penahanannya dilepas lagi — dibiarkan, kursinya mati 15 menit untuk
    // tagihan yang tidak pernah ada, dan pemesannya tidak bisa mencoba ulang.
    await ref.update({ paymentStatus: 'unpaid', holdUntil: null, orderId: null });
    console.error('[bookings] snap gagal', err);
    return bad('gateway-error', 502);
  }

  await ref.update({ snapToken: token });
  return NextResponse.json({ token, snapUrl: SNAP_JS });
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
 * bareng endpoint refund Midtrans; sampai itu ada, membatalkan tiket yang
 * sudah dibayar berarti uangnya harus dikembalikan pengelola secara manual.
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
    // Sama seperti di update: selama QRIS-nya masih hidup, booking ini beku.
    // Membatalkannya sekarang berarti uang bisa masuk untuk booking yang sudah
    // tidak ada — dan itu langsung jadi kasus refund yang belum ada jalurnya.
    // Admin pun tidak dikecualikan: yang bermasalah uangnya, bukan wewenangnya.
    if (pembayaranHidup(b)) return 'payment-pending';
    tx.update(ref, { status: 'cancelled' });
    return 'success';
  });

  if (outcome === 'notfound') return bad('notfound', 404);
  if (outcome === 'forbidden') return bad('forbidden', 403);
  if (outcome === 'already-used') return bad('already-used', 409);
  if (outcome === 'payment-pending') return bad('payment-pending', 409);
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
