import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { str } from '@/lib/format';
import { AGREEMENT, LAND_RIGHTS, validateRoleRequest } from '@/lib/verification';

export const runtime = 'nodejs';

/**
 * Satu-satunya pintu tulis `users/{uid}.verification` dari sisi pengaju.
 *
 * Dulu formulir ini menulis langsung lewat SDK dari browser, dan rules hanya
 * menjaga KAPAN boleh menulis — perpindahan status 'invited' → 'pending' —
 * bukan APA yang ditulis. Catatan panjang di firestore.rules menyebut celahnya
 * sendiri: isi formulirnya "datang dari klien dan dipercaya apa adanya".
 *
 * Yang bisa dilakukan pemegang tiket 'invited' sebelum perubahan ini: menulis
 * `agreementVersion` berisi versi yang tidak pernah terbit, `declaredRights:
 * true` tanpa pernah mencentang apa pun, dan `landRights` di luar daftar resmi.
 * Yang membuatnya lebih dari sekadar data kotor: `agreedAt` distempel
 * serverTimestamp(), jadi WAKTUNYA otoritatif sementara ISINYA tidak — catatan
 * yang tampak tepercaya padahal versi yang disebutnya dikarang oleh orang yang
 * menyetujuinya. Untuk dokumen yang Pasal 2 ayat 4-nya dipakai sebagai dasar
 * pencabutan, itu tidak bisa dibiarkan.
 *
 * Sekarang `agreementVersion` datang dari AGREEMENT di server, bukan dari body.
 * Itu inti perubahannya: yang tercatat selalu versi yang benar-benar berlaku
 * saat pengajuan dikirim, apa pun yang dikirim browser.
 */

/** Batas panjang tiap kolom, cocokkan dengan yang wajar di formulir. */
const MAX = {
  fullName: 120,
  phone: 32,
  organization: 160,
  destination: 120,
  destinationLocation: 120,
  destinationDescription: 1000,
} as const;

function bad(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return bad('unauthorized', 401);

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return bad('unauthorized', 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad('bad-request', 400);
  }

  // Gerbang yang sama dengan yang dulu dijaga rules: formulir hanya boleh
  // dikirim dari tiket yang memang dibukakan admin. Membuka tiket sendiri tetap
  // mustahil — 'invited' hanya bisa ditulis admin (openRoleRequest).
  const ref = adminDb().doc(`users/${uid}`);
  const current = (await ref.get()).data();
  if (current?.verification?.status !== 'invited') return bad('not-invited', 403);

  const input = {
    fullName: str(body.fullName, MAX.fullName),
    phone: str(body.phone, MAX.phone),
    organization: str(body.organization, MAX.organization),
    destination: str(body.destination, MAX.destination),
    destinationLocation: str(body.destinationLocation, MAX.destinationLocation),
    destinationDescription: str(body.destinationDescription, MAX.destinationDescription),
    landRights: str(body.landRights, 120),
    declaredRights: body.declaredRights === true,
    agreed: body.agreed === true,
  };

  // Validasi yang SAMA persis dengan yang dipakai formulir — satu fungsi, dua
  // tempat pakai. Kalau keduanya punya salinan sendiri, cukup satu yang lupa
  // diperbarui untuk membuat server menerima apa yang layar tolak, atau
  // sebaliknya. Kunci kamus dikembalikan apa adanya supaya formulir bisa
  // menampilkan pesan yang sama seperti saat validasi di layar gagal.
  const invalid = validateRoleRequest(input);
  if (invalid) return bad(invalid, 400);

  // Teks bebas tidak diterima: `landRights` wajib salah satu dari daftar resmi.
  // Di layar ini sudah <select>, tapi <select> bukan penjaga — ia cuma tampilan.
  if (!(LAND_RIGHTS as readonly string[]).includes(input.landRights)) {
    return bad('verifyForm.landRightsRequired', 400);
  }

  await ref.update({
    verification: {
      fullName: input.fullName,
      phone: input.phone,
      organization: input.organization,
      destination: input.destination,
      destinationLocation: input.destinationLocation,
      destinationDescription: input.destinationDescription,
      landRights: input.landRights,
      // Disimpan setelah dipastikan benar-benar dicentang (validateRoleRequest
      // menolak yang false), bukan disalin dari body.
      declaredRights: true,
      // DARI SERVER, bukan dari body — inti seluruh perubahan ini.
      agreementVersion: AGREEMENT.pengelola.version,
      status: 'pending',
      submittedAt: FieldValue.serverTimestamp(),
      agreedAt: FieldValue.serverTimestamp(),
    },
  });

  return NextResponse.json({ ok: true });
}
