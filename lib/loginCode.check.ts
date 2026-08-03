/**
 * Cek logika kode login — gerbang satu-satunya yang menahan orang masuk ke
 * akun orang lain sekarang password sudah dihapus. Kalau kedaluwarsa atau
 * batas tebakan rusak, kode 6 digit bisa dibrute-force sampai ketemu.
 *
 * Jalankan: node lib/loginCode.check.ts
 */
import assert from "node:assert/strict";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  checkCode,
  emailKey,
  hashCode,
  isEmail,
  nameFromEmail,
  newCode,
  normalizeEmail,
  resendBlocked,
  type StoredCode,
} from "./loginCode.ts";

const now = 1_700_000_000_000;
const email = "Budi@Example.com";
const code = "482917";
const fresh = (over: Partial<StoredCode> = {}): StoredCode => ({
  hash: hashCode(code, email),
  createdAt: now,
  attempts: 0,
  ...over,
});

// ── Normalisasi ──
assert.equal(normalizeEmail("  Budi@Example.COM "), "budi@example.com");
assert.equal(emailKey("BUDI@example.com"), emailKey("budi@example.com "));
assert.ok(isEmail("budi@example.com"));
assert.ok(!isEmail("budi@example"), "domain tanpa titik ditolak");
assert.ok(!isEmail("budi example.com"), "tanpa @ ditolak");

// ── Nama dari email ──
assert.equal(nameFromEmail("budi@example.com"), "Budi");
assert.equal(nameFromEmail("budi.santoso@example.com"), "Budi Santoso");
assert.equal(nameFromEmail("irham_aadiyaat@icloud.com"), "Irham Aadiyaat");
assert.equal(nameFromEmail("siti-nur.halimah@example.com"), "Siti Nur Halimah");
assert.equal(nameFromEmail("  BUDI.Santoso@Example.COM "), "Budi Santoso");
assert.equal(nameFromEmail("budi123@example.com"), "Budi123");
assert.equal(nameFromEmail("budi+ota@example.com"), "Budi Ota");
assert.equal(nameFromEmail("...@example.com"), "...", "tanpa kata tersisa, pakai apa adanya");
assert.ok(nameFromEmail("a@example.com").length > 0, "nama tidak boleh kosong");

// ── Bentuk kode ──
for (let i = 0; i < 200; i++) {
  const c = newCode();
  assert.match(c, /^\d{6}$/, `kode harus 6 digit, dapat "${c}"`);
}

// ── Kecocokan ──
assert.equal(checkCode(fresh(), hashCode(code, email), now), "ok");
assert.equal(
  checkCode(fresh(), hashCode(" 482917 ", "budi@example.com"), now),
  "ok",
  "spasi dan huruf besar tidak boleh bikin gagal",
);
assert.equal(checkCode(fresh(), hashCode("482918", email), now), "wrong");
assert.equal(
  checkCode(fresh(), hashCode(code, "orang.lain@example.com"), now),
  "wrong",
  "kode milik email lain tidak boleh diterima",
);
assert.equal(checkCode(null, hashCode(code, email), now), "none");

// ── Kedaluwarsa ──
assert.equal(checkCode(fresh(), hashCode(code, email), now + CODE_TTL_MS), "ok");
assert.equal(
  checkCode(fresh(), hashCode(code, email), now + CODE_TTL_MS + 1),
  "expired",
);
assert.equal(
  checkCode(fresh({ attempts: MAX_ATTEMPTS }), hashCode(code, email), now + CODE_TTL_MS + 1),
  "expired",
  "kode mati diperiksa duluan, jangan habiskan jatah tebakan",
);

// ── Batas tebakan ──
assert.equal(
  checkCode(fresh({ attempts: MAX_ATTEMPTS - 1 }), hashCode(code, email), now),
  "ok",
  "tebakan terakhir masih boleh benar",
);
assert.equal(
  checkCode(fresh({ attempts: MAX_ATTEMPTS }), hashCode(code, email), now),
  "locked",
  "lewat batas tebakan, kode benar pun ditolak",
);

// ── Jeda kirim ulang ──
assert.equal(resendBlocked(null, now), false);
assert.equal(resendBlocked(fresh(), now), true);
assert.equal(resendBlocked(fresh(), now + RESEND_COOLDOWN_MS - 1), true);
assert.equal(resendBlocked(fresh(), now + RESEND_COOLDOWN_MS), false);

console.log("loginCode.check.ts — semua cek lolos");
