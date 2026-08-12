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
