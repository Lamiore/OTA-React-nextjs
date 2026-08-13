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
  qty: Record<string, unknown>
): BookingLine[] {
  return items.flatMap((it) => {
    const n = Math.floor(Number(qty[it.id] ?? 0));
    if (!Number.isFinite(n) || n <= 0) return [];
    // Harganya sendiri ikut diperiksa. Isinya memang datang dari admin, bukan
    // dari pemesan, tapi satu dokumen destinasi lama yang harganya tersimpan
    // sebagai teks sudah cukup untuk membuat total jadi NaN — dan NaN yang
    // lolos ke tagihan jauh lebih sulit dilacak daripada item yang hilang.
    if (!Number.isFinite(it.price) || it.price < 0) return [];
    return [{ id: it.id, label: it.label, price: it.price, qty: Math.min(n, MAX_QTY) }];
  });
}

/** Total rupiah dari baris tagihan. */
export function bookingTotal(lines: BookingLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.qty, 0);
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
