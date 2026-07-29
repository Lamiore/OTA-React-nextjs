/**
 * Aturan form pengajuan naik role. Sengaja tanpa import apa pun supaya
 * verification.check.ts bisa dijalankan `node` polos tanpa bundler — sama
 * alasannya dengan format.ts.
 */

/** Versi Perjanjian Pengelola yang berlaku. Dinaikkan bila isinya berubah. */
export const PENGELOLA_AGREEMENT_VERSION = "1.0";

export interface RoleRequestInput {
  fullName: string;
  phone: string;
  organization: string;
  requestedRole: "mitra" | "pengelola";
  /** Hanya diisi pengajuan pengelola. */
  destination?: string;
  /** Centang Perjanjian Pengelola; tidak berlaku bagi pengajuan mitra. */
  agreed?: boolean;
}

/**
 * Pesan kesalahan pertama yang ditemukan, atau null bila pengajuan boleh
 * dikirim. Urutannya disengaja: kolom kosong diperiksa duluan, baru syarat
 * khusus pengelola — supaya orang tidak disuruh menyetujui perjanjian untuk
 * form yang belum diisi.
 */
export function validateRoleRequest(input: RoleRequestInput): string | null {
  if (
    !input.fullName.trim() ||
    !input.phone.trim() ||
    !input.organization.trim()
  ) {
    return "Semua kolom wajib diisi.";
  }
  if (input.requestedRole !== "pengelola") return null;
  if (!input.destination) return "Pilih destinasi yang ingin dikelola.";
  if (!input.agreed) return "Kamu harus menyetujui Perjanjian Pengelola dulu.";
  return null;
}
