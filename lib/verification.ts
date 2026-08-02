/**
 * Aturan form pengajuan naik role. Sengaja tanpa import apa pun supaya
 * verification.check.ts bisa dijalankan `node` polos tanpa bundler — sama
 * alasannya dengan format.ts.
 */

/**
 * Perjanjian per role: versi yang berlaku, tautan halamannya, dan namanya.
 * Satu tempat supaya form, halaman perjanjian, dan catatan persetujuan tidak
 * pernah menyebut versi atau tautan yang berbeda. Naikkan `version` bila isi
 * dokumen yang bersangkutan berubah.
 */
export const AGREEMENT = {
  mitra: {
    version: "1.0",
    path: "/syarat-mitra",
    label: "Perjanjian Mitra",
  },
  pengelola: {
    version: "1.0",
    path: "/syarat-pengelola",
    label: "Perjanjian Pengelola",
  },
} as const;

export interface RoleRequestInput {
  fullName: string;
  phone: string;
  organization: string;
  requestedRole: "mitra" | "pengelola";
  /** Hanya diisi pengajuan pengelola. */
  destination?: string;
  /** Alamat kirim paket sensor — wajib untuk pengelola, tak dipakai mitra
   *  (kamera mitra dipasang petugas Nusa, bukan dikirim). */
  shippingAddress?: string;
  postalCode?: string;
  /** Penerima paket bila bukan pendaftar sendiri; kosong = pakai pendaftar. */
  recipientName?: string;
  recipientPhone?: string;
  /** Centang perjanjian yang sesuai rolenya. */
  agreed?: boolean;
}

/**
 * Penerima paket yang sebenarnya. Penerima terpisah itu opsional — kalau kosong
 * paketnya jatuh ke pendaftar. Dipusatkan di sini supaya kartu status pengaju
 * dan panel admin tidak pernah menampilkan penerima yang berbeda.
 */
export function packageRecipient(v: {
  fullName: string;
  phone: string;
  recipientName?: string;
  recipientPhone?: string;
}) {
  return {
    name: v.recipientName?.trim() || v.fullName,
    phone: v.recipientPhone?.trim() || v.phone,
  };
}

/**
 * Pesan kesalahan pertama yang ditemukan, atau null bila pengajuan boleh
 * dikirim. Urutannya disengaja: kolom wajib dan destinasi diperiksa duluan,
 * persetujuan paling akhir — supaya orang tidak disuruh menyetujui perjanjian
 * untuk form yang belum lengkap.
 */
export function validateRoleRequest(input: RoleRequestInput): string | null {
  if (
    !input.fullName.trim() ||
    !input.phone.trim() ||
    !input.organization.trim()
  ) {
    return "Semua kolom wajib diisi.";
  }
  if (input.requestedRole === "pengelola") {
    if (!input.destination) {
      return "Pilih destinasi yang ingin dikelola.";
    }
    if (!input.shippingAddress?.trim()) {
      return "Alamat pengiriman paket sensor wajib diisi.";
    }
    // Ekspedisi menolak kode pos yang tidak lima angka; ditahan di sini supaya
    // paketnya tidak gagal kirim setelah pengajuan disetujui.
    if (!/^\d{5}$/.test(input.postalCode?.trim() ?? "")) {
      return "Kode pos harus 5 angka.";
    }
  }
  if (!input.agreed) {
    return `Kamu harus menyetujui ${AGREEMENT[input.requestedRole].label} dulu.`;
  }
  return null;
}
