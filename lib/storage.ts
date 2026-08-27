import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase.ts";

/** Batas ukuran satu foto. Angkanya harus sama dengan yang di storage.rules —
 *  dijaga oleh lib/storage.check.ts, yang membaca kedua berkasnya. */
export const MAX_FOTO_BYTES = 10 * 1024 * 1024;

/** Berkas yang mau diunggah, seperlunya saja — supaya bisa dicek tanpa DOM. */
type BerkasFoto = { name: string; type: string; size: number };

/**
 * Alasan sebuah berkas ditolak, atau null kalau boleh diunggah.
 *
 * Dicek di klien bukan karena rules kurang dipercaya, tapi supaya penolakannya
 * terbaca: kalau dibiarkan sampai ke Storage, yang muncul cuma
 * "storage/unauthorized" setelah berkasnya terlanjur terkirim.
 */
export function fotoError(file: BerkasFoto): string | null {
  if (!file.type.startsWith("image/")) return "Berkas ini bukan gambar.";
  if (file.size > MAX_FOTO_BYTES) {
    return `Ukuran foto ${(file.size / 1024 / 1024).toFixed(1)} MB, maksimal ${MAX_FOTO_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}

/**
 * Unggah satu foto ke `destinasi/` dan kembalikan URL unduhannya.
 *
 * Yang disimpan di Firestore tetap berupa string URL persis seperti dulu
 * (`image`, `images[]`, `priceItems[].image`), jadi halaman publik dan dokumen
 * lama yang berisi tautan luar tidak perlu diubah sama sekali.
 */
export async function uploadFoto(file: File): Promise<string> {
  if (!storage) throw new Error("Firebase Storage belum dikonfigurasi.");
  const salah = fotoError(file);
  if (salah) throw new Error(salah);
  // Nama acak, bukan nama asli berkas: nama asli bisa mengandung karakter yang
  // merusak jalur, dan dua orang mengunggah "foto.jpg" tidak boleh saling timpa.
  // ponytail: tanpa kompresi — kalau foto 10 MB mulai bikin galeri berat,
  // resize lewat canvas sebelum unggah.
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const objek = ref(storage, `destinasi/${crypto.randomUUID()}.${ext}`);
  await uploadBytes(objek, file, { contentType: file.type });
  return getDownloadURL(objek);
}
