/**
 * Cek teks Indonesia yang ditulis langsung di komponen, bukan lewat t().
 *
 * i18n.check.ts hanya memastikan tiap kunci punya kedua bahasa — dia lolos
 * bahkan saat sebuah kalimat tidak pernah jadi kunci sama sekali. Itu justru
 * bug yang sering terjadi: layar Inggris menampilkan kalimat Indonesia tanpa
 * error apa pun. Cek ini menutup celah itu.
 *
 * Heuristik, bukan parser: cari kata Indonesia di dalam literal string dan teks
 * JSX, setelah komentar dibuang (komentar di repo ini memang berbahasa
 * Indonesia). Kalau ada temuan palsu, tambahkan ke ALLOW.
 *
 * Jalankan: node lib/i18nHardcoded.check.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/**
 * Hanya folder yang memang sudah diterjemahkan. Dashboard admin/pengelola dan
 * halaman perjanjian sengaja di luar: dashboard dipakai mitra lokal (lihat
 * catatan di i18n.ts), dan perjanjian adalah dokumen yang disetujui orang
 * secara hukum — versi terjemahannya memunculkan pertanyaan mana yang berlaku.
 */
const SCAN_DIRS = [
  "components/profile",
  "components/cameras",
  "components/destinations",
  "components/chat",
  "app/monitoring",
];

/**
 * Bukan kalimat antarmuka: nama merek, dan nilai mentah status kesehatan yang
 * dikirim server deteksi (dipakai sebagai kunci map, labelnya diterjemahkan
 * terpisah lewat health.*).
 */
const ALLOW = new Set([
  "Nusa",
  "WhatsApp",
  "Google",
  "Email",
  "Dashboard",
  "Sehat",
  "Kurang Sehat",
  "Mengalami Pemutihan",
  "Tidak Diketahui",
]);

const ID_WORDS =
  /\b(yang|dan|untuk|kamu|tidak|sudah|belum|bisa|akan|atau|dengan|dari|saat|agar|supaya|kirim|masuk|keluar|simpan|hapus|ubah|tambah|batal|pilih|semua|sedang|hanya|milik|punya|cek|coba|gagal|berhasil|silakan|kembali|lihat|kelola|tersedia|nama|alamat|nomor|tanggal|harga|jumlah|catatan|ulasan|pesan|terkirim|dulu|juga|oleh|daftar|pantau|ajukan|menunggu|ditolak|disetujui|persetujuan|instansi|penerima|pendaftar|wilayah|deteksi|tercatat|diketahui|dikelola|pengiriman|lengkap|pengguna|destinasi|bantuan|dukungan|kesehatan|karang|riwayat|statistik|siaran|jaringan)\b/i;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const findings: string[] = [];

for (const scanDir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, scanDir))) {
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, i) => {
      // Buang panggilan t('...') dulu supaya kuncinya sendiri tidak terbaca.
      const rest = line.replace(/t\(\s*['"][^'"]*['"][^)]*\)/g, "");
      const candidates = [
        ...[...rest.matchAll(/'([^']{4,})'/g)].map((m) => m[1]),
        ...[...rest.matchAll(/"([^"]{4,})"/g)].map((m) => m[1]),
        ...[...rest.matchAll(/>\s*([^<>{}\n]{4,}?)\s*</g)].map((m) => m[1]),
      ];
      // Teks JSX telanjang satu baris penuh (kalimat panjang yang dibungkus).
      const bare = rest.trim();
      if (bare.length > 3 && !/[<>{}=;'"`(){}]/.test(bare) && /[a-zA-Z]/.test(bare)) {
        candidates.push(bare);
      }
      for (const text of candidates) {
        const clean = text.trim();
        if (ALLOW.has(clean)) continue;
        if (!ID_WORDS.test(clean)) continue;
        if (/^[a-z-]+$/.test(clean)) continue; // className / nama prop
        if (/^(https?:|\/|@|#)/.test(clean)) continue;
        if (/[<>{}]/.test(clean)) continue;
        findings.push(
          `${relative(ROOT, file)}:${i + 1}  ${clean.slice(0, 70)}`,
        );
      }
    });
  }
}

assert.equal(
  findings.length,
  0,
  `teks Indonesia hardcoded (pakai t('kunci') supaya ikut berganti bahasa):\n` +
    findings.map((f) => "  " + f).join("\n") +
    "\n",
);

console.log(
  `i18nHardcoded.check.ts OK — ${SCAN_DIRS.length} folder bersih dari teks hardcoded`,
);
