'use client';

import { useEffect } from 'react';

/**
 * Jaring pengaman untuk seluruh halaman di bawah layout ini.
 *
 * Sebelum ini tidak ada satu pun error boundary: satu exception yang lolos dari
 * komponen mana pun berujung layar putih bertuliskan "Application error: a
 * client-side exception has occurred", tanpa jalan kembali selain menutup tab.
 * Bahwa itu bukan kekhawatiran teoretis sudah dibuktikan stopScanner() di
 * ScanPanel — penjaga itu ada persis karena html5-qrcode pernah menjatuhkan
 * seluruh halaman dari dalam cleanup useEffect.
 *
 * Teksnya sengaja TIDAK lewat useLang(). Fallback tidak boleh bergantung pada
 * provider yang justru bisa jadi penyebab errornya; kalau LangProvider yang
 * gagal, t() di sini ikut melempar dan boundary-nya sendiri yang jatuh.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log lokal supaya penyebabnya masih bisa dilihat di konsol lapangan —
    // `digest` yang tampil di layar tidak memuat pesan aslinya.
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-shore-50 px-6 text-center">
      <h1 className="font-serif text-2xl font-medium text-navy">Ada yang tidak beres</h1>
      <p className="max-w-sm text-sm leading-relaxed text-navy-soft">
        Halaman ini gagal dimuat. Sinyal di lokasi wisata sering putus-putus —
        coba muat ulang dulu sebelum menganggapnya rusak.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="btn-primary px-5 py-2.5 text-sm">
          Coba lagi
        </button>
        <a href="/beranda" className="btn-ghost px-5 py-2.5 text-sm">
          Ke beranda
        </a>
      </div>
      {error.digest && (
        <p className="mt-2 font-mono text-2xs text-navy-soft">Kode: {error.digest}</p>
      )}
    </main>
  );
}
