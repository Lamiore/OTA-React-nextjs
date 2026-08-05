'use client';

import { useUserRole } from './useAuth';
import { canManageCameras } from './firestore';

/**
 * Boleh-tidaknya seseorang melihat menu Monitoring: pengelola & admin saja.
 *
 * Pengguna biasa tidak punya menu ini sama sekali, termasuk yang emailnya sudah
 * dimasukkan pemilik kamera ke `viewers`. Bukan kelalaian — kamera yang boleh
 * ditontonnya sudah muncul di halaman destinasi yang bersangkutan, jadi menu
 * terpisah cuma jadi pintu kedua ke halaman yang isinya menunjuk balik ke sana.
 *
 * Hak menonton tetap dijaga firestore.rules di dokumen kameranya; menu ini soal
 * navigasi, bukan soal izin.
 */
export function useCameraAccess(): { allowed: boolean; loading: boolean } {
  const { role, loading } = useUserRole();
  return { allowed: canManageCameras(role), loading };
}
