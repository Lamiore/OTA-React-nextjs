/**
 * Logika kode login 6 digit (masuk tanpa password). Dipakai dua route:
 * /api/auth/request-code (bikin + kirim) dan /api/auth/verify-code (periksa).
 *
 * Kode aslinya tidak pernah disimpan — yang masuk Firestore cuma hash-nya,
 * jadi bocornya isi koleksi `loginCodes` tidak bisa dipakai masuk.
 * Import hanya modul bawaan Node supaya loginCode.check.ts bisa dijalankan
 * `node` polos tanpa bundler — sama alasannya dengan format.ts.
 */
import { createHash, randomInt } from "node:crypto";

/** Umur kode. Cukup buat pindah ke aplikasi email dan balik lagi. */
export const CODE_TTL_MS = 10 * 60 * 1000;
/** Jeda minimum antar permintaan kode untuk satu email. */
export const RESEND_COOLDOWN_MS = 60 * 1000;
/** Tebakan salah maksimum sebelum kodenya dibuang. */
export const MAX_ATTEMPTS = 5;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Format email seadanya — cukup buat menolak input yang jelas bukan email. */
export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/**
 * ID dokumen di `loginCodes`. Pakai hash, bukan emailnya, supaya daftar
 * dokumen tidak jadi daftar alamat email yang bisa dipanen.
 */
export function emailKey(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Email ikut di-hash bersama kodenya: kode untuk A tidak berlaku untuk B. */
export function hashCode(code: string, email: string): string {
  return createHash("sha256")
    .update(`${normalizeEmail(email)}:${code.trim()}`)
    .digest("hex");
}

/**
 * Nama awal dari bagian email sebelum "@". Layar masuk tidak menanyakan nama,
 * jadi tanpa ini tiap akun baru lahir tanpa nama sama sekali. Pemisah yang
 * lazim dipakai orang (titik, garis bawah, strip, plus) jadi spasi dan tiap
 * kata dikapitalkan supaya terbaca sebagai nama, bukan sebagai username.
 * Bisa diganti sendiri di Profil › Pengaturan.
 */
export function nameFromEmail(email: string): string {
  const local = normalizeEmail(email).split("@")[0];
  const words = local.split(/[._\-+]+/).filter(Boolean);
  // Email yang bagian depannya cuma tanda baca ("...@x.com") tidak menyisakan
  // kata apa pun — pakai apa adanya daripada mengembalikan nama kosong.
  if (words.length === 0) return local;
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export interface StoredCode {
  hash: string;
  createdAt: number;
  attempts: number;
}

export type CodeVerdict = "ok" | "none" | "expired" | "locked" | "wrong";

/**
 * Putusan atas kode yang dikirim user. Urutannya disengaja: kedaluwarsa dan
 * terkunci diperiksa sebelum kecocokan, supaya kode mati tidak bisa dipakai
 * menghabiskan jatah tebakan — dan supaya tebakan ke-6 tidak pernah dinilai
 * benar walau angkanya kebetulan pas.
 */
export function checkCode(
  stored: StoredCode | null,
  submittedHash: string,
  now: number,
): CodeVerdict {
  if (!stored) return "none";
  if (now - stored.createdAt > CODE_TTL_MS) return "expired";
  if (stored.attempts >= MAX_ATTEMPTS) return "locked";
  return submittedHash === stored.hash ? "ok" : "wrong";
}

/**
 * Kode yang masih muda menahan permintaan berikutnya. Ini satu-satunya rem
 * pada route request-code — tanpa ini endpoint itu jadi relay email terbuka
 * yang juga bisa membuat akun massal.
 */
export function resendBlocked(stored: StoredCode | null, now: number): boolean {
  return !!stored && now - stored.createdAt < RESEND_COOLDOWN_MS;
}
