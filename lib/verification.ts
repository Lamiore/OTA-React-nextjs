/**
 * Aturan form pengajuan naik role. Sengaja tanpa import apa pun supaya
 * verification.check.ts bisa dijalankan `node` polos tanpa bundler — sama
 * alasannya dengan format.ts.
 */

/**
 * `label` sengaja tidak diterjemahkan: itu nama dokumen yang isinya memang
 * berbahasa Indonesia (halaman /syarat-*), dan dokumen itulah yang disetujui
 * secara hukum. Menerjemahkan namanya saja akan menyiratkan ada versi Inggris
 * yang setara — tidak ada.
 *
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
    // 1.2: destinasi tidak lagi ditetapkan admin dari daftar yang sudah ada —
    // pengaju menuliskan sendiri destinasinya dan dokumennya dibuat otomatis
    // saat pengajuan disetujui. Pasal 1 dan 3 ikut berubah, jadi versinya naik.
    version: "1.2",
    path: "/syarat-pengelola",
    label: "Perjanjian Pengelola",
  },
} as const;

/**
 * Dasar hak seseorang mengelola lokasi yang diusulkannya. Ini pengganti unggah
 * berkas: yang dicatat pernyataannya, bukti fisiknya diminta admin lewat
 * WhatsApp sebelum pengajuan disetujui.
 */
export const LAND_RIGHTS = [
  "Lahan milik sendiri atau keluarga",
  "Izin dari pemilik lahan",
  "Izin atau penunjukan pemerintah desa/kelurahan",
  "Izin dinas pariwisata atau pengelola kawasan",
  "Kelompok sadar wisata (Pokdarwis) atau BUMDes",
] as const;

export interface RoleRequestInput {
  fullName: string;
  phone: string;
  organization: string;
  requestedRole: "mitra" | "pengelola";
  /** Nama destinasi yang diketik pengaju. Dokumennya dibuat otomatis saat
   *  pengajuan disetujui — pengaju tidak memilih dari daftar yang sudah ada. */
  destination?: string;
  destinationLocation?: string;
  destinationDescription?: string;
  /** Salah satu LAND_RIGHTS. */
  landRights?: string;
  /** Centang pernyataan berhak mengelola lokasi yang diajukan. */
  declaredRights?: boolean;
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
 * Kunci kamus untuk kesalahan pertama yang ditemukan, atau null bila pengajuan
 * boleh dikirim. Mengembalikan kunci, bukan kalimat jadi, supaya pesannya ikut
 * berganti saat bahasa antarmuka diganti — file ini tetap tanpa import agar
 * verification.check.ts bisa dijalankan `node` polos.
 *
 * Urutannya disengaja: kolom wajib dan destinasi diperiksa duluan, persetujuan
 * paling akhir — supaya orang tidak disuruh menyetujui perjanjian untuk form
 * yang belum lengkap.
 */
export function validateRoleRequest(input: RoleRequestInput): string | null {
  if (
    !input.fullName.trim() ||
    !input.phone.trim() ||
    !input.organization.trim()
  ) {
    return "verifyForm.allFieldsRequired";
  }
  if (input.requestedRole === "pengelola") {
    // Destinasi selalu ditulis sendiri: dokumennya dibuat saat disetujui, jadi
    // keempat kolom ini wajib — tanpa salah satunya dokumen tidak bisa dibuat.
    if (!input.destination?.trim()) {
      return "verifyForm.newDestNameRequired";
    }
    if (!input.destinationLocation?.trim()) {
      return "verifyForm.newDestLocationRequired";
    }
    if (!input.destinationDescription?.trim()) {
      return "verifyForm.newDestDescRequired";
    }
    if (!input.landRights) {
      return "verifyForm.landRightsRequired";
    }
    if (!input.shippingAddress?.trim()) {
      return "verifyForm.shippingRequired";
    }
    // Ekspedisi menolak kode pos yang tidak lima angka; ditahan di sini supaya
    // paketnya tidak gagal kirim setelah pengajuan disetujui.
    if (!/^\d{5}$/.test(input.postalCode?.trim() ?? "")) {
      return "verifyForm.postalCodeInvalid";
    }
  }
  // Pernyataan hak diperiksa sebelum persetujuan perjanjian: yang satu soal
  // fakta pengaju, yang lain soal isi dokumen — jangan digabung jadi satu.
  if (input.requestedRole === "pengelola" && !input.declaredRights) {
    return "verifyForm.declareRightsRequired";
  }
  if (!input.agreed) {
    // Dua kunci terpisah, bukan satu kunci dengan sisipan nama perjanjian:
    // menyusun kalimat dari potongan tidak selalu benar di bahasa lain.
    return input.requestedRole === "pengelola"
      ? "verifyForm.mustAgreePengelola"
      : "verifyForm.mustAgreeMitra";
  }
  return null;
}
