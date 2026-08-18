/** Format angka ke Rupiah tanpa desimal, mis. 150000 → "Rp 150.000". */
export function formatIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

/**
 * Baca koordinat dari teks yang disalin Google Maps ("1.4508, 125.0917") —
 * klik kanan di peta lalu klik koordinatnya menyalin persis format ini.
 * null bila kosong, formatnya lain, atau di luar rentang lat/lng yang sah.
 */
export function parseCoords(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Tautan wa.me dari nomor Indonesia yang ditulis bebas ("0812…", "+62 812…",
 * "62812…"). null bila nomornya terlalu pendek untuk masuk akal, supaya
 * pemanggil bisa menyembunyikan tombolnya alih-alih membuka chat yang gagal.
 */
export function waLink(phone: string, text?: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  const intl = digits.startsWith('62')
    ? digits
    : digits.startsWith('0')
      ? `62${digits.slice(1)}`
      : `62${digits}`;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/**
 * Tanggal ringkas dari Timestamp Firestore, mis. "30 Jul 2026". Masuk sebagai
 * unknown karena antarmuka Firestore di proyek ini menyimpan timestamp begitu.
 * null bila nilainya bukan timestamp — dokumen lama, field yang belum terisi,
 * atau tulisan yang belum tersinkron dari server.
 */
export function formatTimestamp(value: unknown): string | null {
  const d = (value as { toDate?: () => Date } | null | undefined)?.toDate?.();
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Tanggal YYYY-MM-DD menurut zona waktu LOKAL pengguna.
 *
 * `toISOString().slice(0, 10)` TIDAK boleh dipakai untuk ini: itu tanggal UTC,
 * jadi di WITA (UTC+8) sebelum pukul 08:00 pagi ia memulangkan tanggal kemarin.
 * Akibatnya nyata di dua tempat — batas minimal input tanggal booking mundur
 * sehari, dan angka "sisa hari ini" di halaman destinasi jadi milik hari yang
 * sudah lewat. en-CA dipilih karena satu-satunya locale umum yang formatnya
 * memang YYYY-MM-DD.
 *
 * Dipusatkan di sini karena tiga permukaan harus sepakat soal "hari ini":
 * halaman booking, halaman destinasi, dan strip tanggal.
 */
export function isoDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA');
}

/**
 * Tanggal YYYY-MM-DD menurut WIT (UTC+9) — zona Indonesia yang paling dulu
 * berganti hari.
 *
 * Untuk kode SERVER, yang tidak pernah tahu zona penggunanya: di Vercel
 * isoDate() memulangkan tanggal UTC, dan UTC tertinggal 7–9 jam di belakang
 * seluruh Indonesia.
 *
 * Zona paling timur dipilih sengaja, karena fungsi ini dipakai untuk MELEPAS
 * jatah booking belum-bayar. Kartunya menghilang dari daftar "booking
 * berlangsung" pada tengah malam LOKAL pengguna; karena WIT berganti hari
 * paling awal, jatahnya lepas paling lambat berbarengan dengan kartunya
 * hilang, tidak pernah setelahnya. Kalau dibalik memakai UTC, ada jendela
 * sampai 9 jam tiap hari saat orang ditolak "sudah 3" padahal yang kelihatan
 * di layarnya cuma 2 — persis keluhan yang fungsi ini ada untuk menutupnya.
 *
 * Bandingkan dengan penolakan 'past-date' di create(), yang justru memakai UTC:
 * di sana yang harus dihindari kebalikannya, yaitu menolak tanggal yang di
 * tempat pengguna masih berjalan.
 */
export function hariIniWIT(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * `count` tanggal berturut-turut mulai dari `start` (default hari ini), maju
 * ke depan saja.
 *
 * Sengaja tanpa arah mundur: server menolak booking bertanggal lampau, jadi
 * kartu kemarin di strip cuma tombol yang dijamin gagal. Penambahan lewat
 * setDate() supaya pergantian bulan ikut benar tanpa aritmetika milidetik.
 */
export function nextDays(count: number, start: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(isoDate(d));
  }
  return out;
}

/**
 * Bentuk simpan email penonton kamera: sama persis dengan klaim `email` di ID
 * token (huruf kecil, tanpa spasi tepi). Rules mencocokkannya dengan operator
 * `in` yang membandingkan string persis — tanpa ini, email berhuruf besar
 * tersimpan apa adanya dan aksesnya ditolak diam-diam.
 *
 * Tinggal di sini, bukan di firestore.ts, supaya format.check.ts bisa
 * menjalankannya dengan `node` polos — firestore.ts meng-import Firebase SDK.
 */
export function normalizeViewerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Ambil string yang sudah dirapikan & dibatasi panjangnya. */
export function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Id dokumen dari klien, divalidasi sebelum dipakai menyusun path Firestore.
 * String kosong berarti gagal — pemanggil wajib memeriksanya.
 *
 * Tanpa ini `doc(\`users/${id}\`)` bisa dibelokkan dengan menyelipkan garis
 * miring: path Firestore itu bersegmen, dan id seperti "abc/pengajuan/xyz"
 * menghasilkan `users/abc/pengajuan/xyz` — dokumen di subkoleksi yang sama
 * sekali lain, yang lalu terbaca atau terhapus alih-alih yang dimaksud.
 *
 * Pindah ke sini dari app/api/bookings/route.ts: penjaganya sudah benar di
 * sana, tapi dua route lain (delete-user, notify-approval) menyusun path dari
 * id mentah karena tidak punya akses ke salinan yang sama. Satu definisi, satu
 * perilaku — sama alasannya dengan rumus harga di lib/destination.
 */
export function docId(v: unknown): string {
  const s = str(v, 128);
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : '';
}
