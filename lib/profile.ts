/**
 * Kelengkapan profil — satu daftar periksa, dipakai dua layar.
 *
 * Pengaturan Akun menggambar batangnya, lonceng notifikasi memutuskan perlu
 * muncul atau tidak. Dua tempat itu HARUS memakai hitungan yang sama: batang
 * 100% yang lonceng masih menganggap kurang adalah bug yang tidak bisa
 * dijelaskan ke pengguna, dan dua salinan rumus adalah cara paling gampang
 * sampai ke sana.
 *
 * Tanpa impor Firebase supaya bisa diuji tanpa jaringan sama sekali; yang
 * masuk cuma nilai mentahnya.
 *
 * Menambah/mengurangi syarat = mengubah SATU larik di bawah. Syaratnya wajib
 * yang benar-benar bisa dipenuhi sendiri dari Pengaturan Akun — kalau ada satu
 * saja yang tidak (mis. foto profil, yang cuma ikut dari akun Google), batangnya
 * tidak akan pernah sampai 100% dan lonceng itu jadi peringatan abadi yang tidak
 * bisa dimatikan siapa pun.
 */

export interface ProfilInput {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  nik?: string | null;
  emailVerified?: boolean;
}

/**
 * NIK sah secara BENTUK — 16 angka, itu saja.
 *
 * Ini BUKAN verifikasi identitas dan tidak boleh dipakai seolah-olah begitu.
 * Yang membuktikan nomornya benar-benar milik orang yang mengetiknya cuma
 * pencocokan ke Dukcapil, dan itu tidak ada di sini. Gunanya cuma satu:
 * menghalangi ketikan asal memenuhi batang kelengkapan.
 */
export function nikBerbentukSah(v: string | null | undefined): boolean {
  return /^\d{16}$/.test(String(v ?? '').trim());
}

export interface SyaratProfil {
  /** Kunci i18n label syaratnya. */
  key: string;
  done: boolean;
}

const isi = (v: string | null | undefined) => String(v ?? '').trim().length > 0;

export function syaratProfil(p: ProfilInput): SyaratProfil[] {
  return [
    { key: 'complete.name', done: isi(p.name) },
    { key: 'complete.phone', done: isi(p.phone) },
    { key: 'complete.city', done: isi(p.city) },
    // Bentuknya yang dipakai, bukan sekadar "ada isinya": kolom berisi "123"
    // yang menghitung 100% membuat batang ini berbohong tentang satu-satunya
    // hal yang bisa diperiksa dari nomor ini.
    { key: 'complete.nik', done: nikBerbentukSah(p.nik) },
    { key: 'complete.email', done: p.emailVerified === true },
  ];
}

export interface Kelengkapan {
  items: SyaratProfil[];
  /** 0–100, bulat. */
  persen: number;
  /** Jumlah syarat yang belum terpenuhi. 0 = lengkap. */
  kurang: number;
}

export function kelengkapanProfil(p: ProfilInput): Kelengkapan {
  const items = syaratProfil(p);
  const selesai = items.filter((i) => i.done).length;
  // Dibulatkan ke bawah, bukan ke terdekat: 3 dari 4 syarat harus terbaca 75%,
  // dan yang penting, apa pun yang belum lengkap tidak boleh menampilkan 100%.
  const persen = Math.floor((selesai / items.length) * 100);
  return { items, persen, kurang: items.length - selesai };
}
