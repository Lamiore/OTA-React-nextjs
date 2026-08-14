/**
 * Turunan murni dari dokumen destinasi. Sengaja tanpa import apa pun supaya
 * destination.check.ts bisa dijalankan `node` polos tanpa bundler — sama
 * alasannya dengan format.ts dan verification.ts. firestore.ts tidak bisa
 * dipakai untuk ini karena dia meng-import SDK Firebase.
 */

/** Bentuk minimal yang dibutuhkan; dokumen aslinya punya jauh lebih banyak. */
export interface DestinationCameras {
  /** Bentuk sekarang: satu destinasi boleh punya banyak kamera. */
  cameraIds?: string[];
  /** Bentuk lama: satu kamera per destinasi. */
  cameraId?: string;
}

/**
 * Daftar id dokumen kamera destinasi, dari bentuk baru maupun lama.
 *
 * Dipusatkan di sini karena tiga pemanggil (halaman destinasi, panel admin,
 * dan LiveMonitorPanel) harus sepakat: kalau salah satu saja membaca
 * `cameraId` langsung, destinasi yang sudah disimpan dengan banyak kamera akan
 * kehilangan semuanya kecuali yang pertama di tempat itu.
 */
export function destinationCameraIds(d: DestinationCameras): string[] {
  // Sengaja `!== undefined`, bukan `.length`: array kosong itu keputusan admin
  // ("destinasi ini tanpa kamera"), sedangkan field yang tidak ada berarti
  // dokumennya belum pernah disimpan editor baru. Kalau keduanya disamakan,
  // admin yang melepas kamera terakhir akan melihat kamera lamanya hidup lagi
  // dari `cameraId` yang tertinggal.
  if (d.cameraIds !== undefined) return d.cameraIds.filter(Boolean);
  return d.cameraId ? [d.cameraId] : [];
}

/** Bentuk minimal hubungan induk–anak; dokumen aslinya punya jauh lebih banyak. */
export interface DestinationParent {
  /** Id destinasi induk. Kosong/tidak ada = destinasi ini berdiri sendiri. */
  parentId?: string;
}

/**
 * Destinasi yang berhak jadi kartu di beranda — "toko"-nya, bukan isi tokonya.
 *
 * Destinasi di dalam destinasi (spot yang ditambahkan pengelola provinsi)
 * disimpan sebagai dokumen destinasi biasa supaya halaman detail, booking,
 * ulasan, dan kamera dipakai ulang apa adanya. Konsekuensinya: tiap permukaan
 * yang membaca koleksi ini secara utuh ikut memajang mereka kalau tidak
 * disaring — beranda berjejer isi toko, dan wilayah anak mencetak chip filter
 * sendiri.
 *
 * Sengaja truthy, bukan `parentId === undefined`: saringan ini tidak bisa
 * dititipkan ke query Firestore (`where('parentId','==',null)` tidak cocok
 * dengan dokumen yang tidak punya field itu sama sekali — yaitu semua destinasi
 * lama), jadi nilainya datang apa adanya dari dokumen, termasuk string kosong
 * yang juga berarti tingkat atas.
 */
export function isTopLevel(d: DestinationParent): boolean {
  return !d.parentId;
}

/** Bentuk minimal untuk menelusuri rantai induk. */
export interface DestinationNode extends DestinationParent {
  id: string;
}

/**
 * Destinasi yang boleh dipilih sebagai induk `docId` — yaitu semuanya kecuali
 * `docId` sendiri dan apa pun yang sudah ada di dalamnya.
 *
 * Kalau keduanya tidak dibuang, admin bisa menaruh A di dalam B sementara B
 * ada di dalam A: dua-duanya lenyap dari beranda (bukan lagi tingkat atas)
 * sementara halaman masing-masing saling memajang satu sama lain, dan tidak
 * ada satu pun permukaan yang tersisa untuk membatalkannya.
 *
 * `docId` null (sedang menambah, bukan menyunting) berarti belum ada dokumen
 * yang bisa jadi induknya sendiri — semua boleh.
 */
/**
 * Id semua destinasi yang berada DI DALAM `rootId`, sedalam apa pun rantainya.
 * `rootId` sendiri tidak ikut.
 *
 * Dipakai kartu kawasan untuk merangkum harga: sebuah provinsi tidak menjual
 * apa-apa sendiri, yang punya daftar harga adalah tempat-tempat di dalamnya.
 *
 * `seen` bukan kehati-hatian berlebih. parentOptions baru menjaga yang ditulis
 * sejak sekarang; dokumen lama bisa terlanjur melingkar, dan tanpa penjaga itu
 * satu lingkaran menggantung render yang memanggil fungsi ini.
 */
export function descendantIds<T extends DestinationNode>(
  all: T[],
  rootId: string
): string[] {
  const byParent = new Map<string, T[]>();
  for (const d of all) {
    if (!d.parentId) continue;
    const arr = byParent.get(d.parentId);
    if (arr) arr.push(d);
    else byParent.set(d.parentId, [d]);
  }

  const out: string[] = [];
  const seen = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    for (const child of byParent.get(stack.pop()!) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child.id);
      stack.push(child.id);
    }
  }
  return out;
}

export function parentOptions<T extends DestinationNode>(
  all: T[],
  docId: string | null
): T[] {
  if (!docId) return all;
  const byId = new Map(all.map((d) => [d.id, d]));
  return all.filter((candidate) => {
    // Naik dari calon induk sampai puncak; ketemu docId berarti calon ini ada
    // DI DALAM dokumen yang sedang disunting. `seen` menjaga penelusuran tetap
    // berhenti kalau data lama sudah terlanjur melingkar — tanpa itu satu
    // dokumen melingkar menggantung seluruh dasbor admin saat render.
    const seen = new Set<string>();
    let cur: T | undefined = candidate;
    while (cur && !seen.has(cur.id)) {
      if (cur.id === docId) return false;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return true;
  });
}

// ── Harga & total booking ──
//
// Ada di sini, bukan di firestore.ts, karena route server /api/bookings harus
// menghitung ulang total dari daftar harga asli — dan route itu tidak boleh
// meng-import SDK Firebase sisi klien. Satu rumus dipakai dua tempat: kalau
// ringkasan di layar dan tagihan di server pernah beda, yang salah selalu
// merugikan salah satu pihak dan tidak ada yang tahu sampai ada yang komplain.

/** Batas atas jumlah per item. Sama dengan max pada input jumlah tamu. */
export const MAX_QTY = 100;

/**
 * Batas atas durasi sewa. 24 karena stok item dihitung PER HARI — sewa yang
 * melewati tengah malam sudah memakan kuota hari berikutnya, dan tidak ada
 * apa pun di sini yang mencatat itu.
 */
export const MAX_HOURS = 24;

export interface PriceItem {
  id: string; // key React & edit admin — crypto.randomUUID()
  label: string; // "Tiket Masuk", "Penginapan", "Sewa Alat Diving", ...
  description?: string; // penjelasan singkat item, tampil di kartu daftar harga
  price: number; // rupiah, >= 0
  unit: string; // "/pax", "/malam", "/set" — teks bebas
  /**
   * URL foto item. Terisi = kartunya tampil bergambar seperti kartu destinasi;
   * kosong = kartu teks yang rapat. Opsional per item, jadi satu daftar harga
   * boleh campur — homestay berfoto di sebelah tiket masuk tanpa foto.
   */
  image?: string;
  /**
   * Stok per HARI untuk item ini. Sengaja bertingkat tiga:
   *   undefined → tanpa batas (semua destinasi lama ada di sini, jadi fitur
   *               kuota tidak mengubah apa pun sampai pengelola mengisinya)
   *   0         → habis / tidak dijual hari itu
   *   n > 0     → maksimal n per hari
   *
   * 0 TIDAK berarti tanpa batas. Membalik dua nilai ini diam-diam menjual
   * habis-habisan item yang justru sedang ditutup, jadi keduanya dikunci cek
   * di destination.check.ts.
   */
  stock?: number;
}

/**
 * Item ini disewa per jam — harganya dikali durasi, bukan cuma jumlahnya.
 *
 * Dibaca dari `unit` yang sudah ada, bukan dari field/centang baru: pengelola
 * memang sudah menulis "/jam" di situ untuk sewa alat, jadi tidak ada yang
 * perlu dimigrasi dan tidak ada dua tempat yang bisa berbeda pendapat.
 *
 * Tinggal di sini, bukan di komponen, karena server memakai jawaban yang sama
 * untuk menghitung tagihan — sama alasannya dengan bookingLines. Kalau layar
 * dan server pernah beda menilai satu item per jam atau tidak, tagihannya beda
 * berlipat dan tidak ada yang tahu sampai ada yang komplain.
 *
 * `s?\b` menjaga "jamur" tidak ikut terbaca sebagai jam, sementara "perjam",
 * "/jam", "/hour", "hrs" semuanya kena.
 */
export function isHourly(item: Pick<PriceItem, "unit">): boolean {
  return /(jam|hour|hr)s?\b/i.test(item.unit ?? "");
}

/**
 * Durasi sewa yang sudah dibersihkan. Sama seperti jumlah di bookingLines, ini
 * batas kepercayaan: di server angkanya datang mentah dari body permintaan dan
 * langsung jadi pengali tagihan. Apa pun yang tidak masuk akal jatuh ke 1 —
 * bukan 0, karena 0 jam berarti tagihannya nol untuk barang yang tetap dibawa.
 */
export function resolveHours(v: unknown): number {
  const n = Math.floor(Number(v ?? 1));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_HOURS);
}

/** Bentuk minimal yang dibutuhkan; dokumen aslinya punya jauh lebih banyak. */
export interface DestinationPrices {
  /** Daftar harga multi-item (tiket, penginapan, sewa alat, ...). */
  priceItems?: PriceItem[];
  /** Legacy — harga tunggal lama; hanya dipakai sebagai fallback. */
  priceStart?: number;
}

/** Satu baris tagihan: snapshot label & harga saat booking dibuat. */
export interface BookingLine {
  /**
   * Id item harga asalnya. Dipakai untuk menghitung stok terpakai per item —
   * label tidak bisa dipakai karena pengelola boleh menggantinya kapan saja,
   * dan begitu diganti seluruh hitungan stok item itu ikut hilang.
   *
   * Booking yang dibuat sebelum stok ada tidak punya field ini; baris seperti
   * itu tidak diatribusikan ke item mana pun (lihat bookedPerItem).
   */
  id?: string;
  label: string;
  price: number;
  qty: number;
  /**
   * Lama sewa dalam jam, hanya untuk item per jam. Tidak ada field ini berarti
   * sekali bayar — SEMUA booking lama ada di golongan itu, jadi setiap
   * pembacaan wajib `?? 1` (lihat lineTotal). Nilai `undefined` tidak boleh
   * ikut tersimpan: Firestore menolaknya.
   *
   * Ikut disnapshot ke tiap baris seperti label dan harga, meski dikirim sekali
   * untuk seluruh booking. Kalau tidak, pengelola yang besok mengganti unit
   * item dari "/jam" jadi "/set" membuat tiket yang sudah terbit ikut berubah
   * totalnya.
   */
  hours?: number;
}

/**
 * Sumber kebenaran daftar harga. priceItems yang sudah ada dikembalikan apa
 * adanya — array kosong berarti sengaja tanpa harga. Fallback priceStart
 * hanya untuk dokumen legacy yang belum pernah disimpan editor baru, agar
 * tetap bisa tampil & dibooking tanpa migrasi manual.
 */
export function getPriceItems(dest: DestinationPrices): PriceItem[] {
  if (dest.priceItems) return dest.priceItems;
  if (dest.priceStart && dest.priceStart > 0) {
    return [{ id: "legacy", label: "Tiket Masuk", price: dest.priceStart, unit: "/pax" }];
  }
  return [];
}

/**
 * Baris tagihan dari daftar harga destinasi + jumlah yang dipilih.
 *
 * Jumlahnya dibersihkan di sini, bukan di pemanggil: fungsi ini adalah batas
 * kepercayaan. Di server isinya datang mentah dari body permintaan, jadi
 * pecahan, negatif, NaN, Infinity, dan id item yang tidak ada di destinasi
 * harus gugur di satu tempat yang sama-sama dipakai UI — bukan di dua tempat
 * yang bisa berbeda. Item yang tidak dikenali diabaikan, tidak dilempar:
 * daftar harga bisa berubah setelah halaman dibuka.
 */
export function bookingLines(
  items: PriceItem[],
  qty: Record<string, unknown>,
  hours?: unknown
): BookingLine[] {
  const jam = resolveHours(hours);
  return items.flatMap((it) => {
    const n = Math.floor(Number(qty[it.id] ?? 0));
    if (!Number.isFinite(n) || n <= 0) return [];
    // Harganya sendiri ikut diperiksa. Isinya memang datang dari admin, bukan
    // dari pemesan, tapi satu dokumen destinasi lama yang harganya tersimpan
    // sebagai teks sudah cukup untuk membuat total jadi NaN — dan NaN yang
    // lolos ke tagihan jauh lebih sulit dilacak daripada item yang hilang.
    if (!Number.isFinite(it.price) || it.price < 0) return [];
    const line: BookingLine = {
      id: it.id,
      label: it.label,
      price: it.price,
      qty: Math.min(n, MAX_QTY),
    };
    // Sengaja hanya dipasang kalau itemnya memang per jam. Menaruh `hours: 1`
    // di tiket masuk cuma menambah angka yang harus dijelaskan di layar, dan
    // menaruh `hours: undefined` membuat Firestore melempar saat menyimpan.
    if (isHourly(it)) line.hours = jam;
    return [line];
  });
}

/**
 * Rupiah satu baris. `?? 1` bukan kehati-hatian berlebih: seluruh booking yang
 * sudah ada di database dibuat sebelum ada durasi, dan tanpa itu tiket lama
 * berubah jadi "Rp NaN" begitu perubahan ini naik.
 */
export function lineTotal(line: BookingLine): number {
  return line.price * line.qty * (line.hours ?? 1);
}

/** Total rupiah dari baris tagihan. */
export function bookingTotal(lines: BookingLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

// ── Stok per item per hari ──
//
// Yang menghabiskan stok adalah booking yang SUDAH DIBAYAR dan belum
// dibatalkan. Booking yang menunggu pembayaran sengaja tidak menahan stok:
// kursi tidak ikut mati gara-gara orang yang membuka form lalu pergi.
//
// Konsekuensinya pemeriksaan yang mengikat harus terjadi saat MEMBAYAR, bukan
// saat booking dibuat — kalau tidak, dua orang bisa sama-sama lolos di kursi
// terakhir lalu membayar berdua. Lihat cabang "pay" di /api/bookings.
//
// ponytail: aturan ini utuh selama pembayarannya seketika. Gateway sungguhan
// mengambil uang SEBELUM webhook memberi tahu kita, jadi begitu Midtrans (atau
// gateway mana pun) dipasang, di sini perlu tambahan golongan kedua — kursi
// yang ditahan sementara selama jendela pembayaran, dengan waktu kedaluwarsa.
// Tanpa itu, pembayaran yang sampai belakangan bisa menemukan kursinya sudah
// habis padahal uangnya sudah diterima, dan itu jadi urusan refund.

/** Bentuk minimal booking yang dibutuhkan penghitung stok. */
export interface BookingForCount {
  status?: string;
  paymentStatus?: string;
  items?: BookingLine[];
}

/**
 * Jumlah terjual per id item, dari daftar booking pada SATU tanggal.
 *
 * Pemanggil yang menyaring tanggalnya, bukan fungsi ini — supaya fungsi ini
 * tetap murni dan bisa diuji tanpa Firestore.
 *
 * Yang dijumlahkan `qty` saja, SENGAJA tanpa `hours`. Stok menghitung barangnya
 * — 10 set alat selam tetap 10 set, dipinjam sejam atau enam jam. Mengalikan
 * jam di sini akan menghabiskan stok enam kali lipat untuk satu set yang sama.
 *
 * ponytail: harganya jadi konservatif — dua penyewa yang jamnya tidak bertabrakan
 * (pagi dan sore) tetap memakan dua jatah dari stok hari itu. Arahnya aman (tidak
 * pernah menjual barang yang tidak ada), dan memperbaikinya butuh jam mulai per
 * booking, bukan cuma durasi. Pasang itu kalau pengelola mulai mengeluh alatnya
 * "habis" padahal sudah kembali.
 */
export function bookedPerItem(bookings: BookingForCount[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of bookings) {
    if (b.paymentStatus !== "paid") continue;
    // Dibatalkan setelah dibayar mengembalikan stoknya. Kalau baris ini hilang,
    // pembatalan tidak pernah melepas kursi dan tanggal itu penuh selamanya.
    if (b.status === "cancelled") continue;
    for (const line of b.items ?? []) {
      if (!line.id) continue; // booking lama tanpa id — tidak bisa diatribusikan
      const n = Number(line.qty);
      if (!Number.isFinite(n) || n <= 0) continue;
      out[line.id] = (out[line.id] ?? 0) + n;
    }
  }
  return out;
}

/** Sisa stok satu item. null = tanpa batas. */
export interface ItemAvailability {
  id: string;
  stock: number | null;
  booked: number;
  /** null = tanpa batas. 0 = habis. */
  remaining: number | null;
}

export function availability(
  items: PriceItem[],
  booked: Record<string, number>
): ItemAvailability[] {
  return items.map((it) => {
    const terjual = booked[it.id] ?? 0;
    const stock =
      typeof it.stock === "number" && Number.isFinite(it.stock) && it.stock >= 0
        ? it.stock
        : null;
    return {
      id: it.id,
      stock,
      booked: terjual,
      remaining: stock === null ? null : Math.max(0, stock - terjual),
    };
  });
}

/**
 * Label item yang diminta melebihi sisa stoknya. Array kosong = semuanya muat.
 *
 * Mengembalikan label (bukan id) karena hasilnya langsung dipakai memberi tahu
 * pengguna item mana yang penuh.
 */
export function overStock(
  lines: BookingLine[],
  items: PriceItem[],
  booked: Record<string, number>
): string[] {
  const sisa = new Map(availability(items, booked).map((a) => [a.id, a.remaining]));
  return lines
    .filter((l) => {
      const r = l.id ? sisa.get(l.id) : undefined;
      return typeof r === "number" && l.qty > r;
    })
    .map((l) => l.label);
}

/** Ringkasan satu tanggal untuk strip pemilih tanggal. */
export interface DateFit {
  /**
   * Angka yang dipajang di kartu tanggal: sisa PALING SEDIKIT di antara item
   * yang dipilih. null = tidak ada yang dibatasi, jadi tidak ada angka yang
   * perlu ditulis.
   */
  remaining: number | null;
  /** false = pilihan sekarang tidak muat di tanggal ini. */
  fits: boolean;
}

/**
 * Apakah pilihan sekarang muat pada satu tanggal, dan berapa sisa tersempitnya.
 *
 * Dua jawaban, bukan satu, dan sengaja tidak diturunkan satu dari yang lain.
 * Angka yang dipajang adalah sisa item terlangka; `fits` membandingkan sisa
 * TIAP item dengan jumlah yang diminta untuk item ITU sendiri. Contoh yang
 * membedakan keduanya: item A sisa 10 diminta 12, item B sisa 3 diminta 1 —
 * kartunya harus menulis "Sisa 3" (B memang paling langka) sekaligus tetap
 * mati, karena yang tidak muat justru A. Kalau `fits` ikut dihitung dari angka
 * terkecil saja, tanggal itu tampil bisa dipesan lalu ditolak server.
 *
 * Bekerja di atas ItemAvailability, bukan PriceItem, karena route sudah
 * memulangkan sisa per item — halaman booking tinggal menghitung ulang label
 * tiap kali jumlahnya diubah, tanpa menembak jaringan lagi.
 */
export function dateFit(
  av: ItemAvailability[],
  qty: Record<string, unknown>
): DateFit {
  let remaining: number | null = null;
  let fits = true;
  for (const a of av) {
    const n = Math.floor(Number(qty[a.id] ?? 0));
    if (!Number.isFinite(n) || n <= 0) continue;
    if (a.remaining === null) continue; // tanpa batas: tidak menyempitkan apa pun
    if (remaining === null || a.remaining < remaining) remaining = a.remaining;
    if (n > a.remaining) fits = false;
  }
  return { remaining, fits };
}

/**
 * Rapikan daftar harga sebelum disimpan: buang item tanpa nama, dan buang
 * field `stock` yang tidak diisi.
 *
 * Bagian kedua bukan kerapian — Firestore MENOLAK nilai `undefined` dan
 * melempar saat menyimpan. Input stok mengirim undefined untuk "tanpa batas"
 * (karena 0 sudah berarti tutup), jadi tanpa pembersihan ini setiap penyimpanan
 * destinasi yang punya satu saja item tanpa stok akan gagal.
 */
export function cleanPriceItems(items: PriceItem[]): PriceItem[] {
  return items
    .filter((it) => it.label.trim() !== "")
    .map((it) => {
      if (it.stock === undefined || it.stock === null) {
        // Sengaja hapus kuncinya, bukan menyimpan null: getPriceItems dan
        // availability sama-sama membaca "tidak ada field" sebagai tanpa batas.
        const tanpaStok = { ...it };
        delete tanpaStok.stock;
        return tanpaStok;
      }
      return it;
    });
}
