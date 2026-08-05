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
