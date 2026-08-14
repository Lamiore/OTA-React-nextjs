/**
 * Halaman 404. Server component — tidak ada yang interaktif di sini, jadi tidak
 * perlu ikut ke bundle klien.
 *
 * Paling sering kena: tautan destinasi lama yang dokumennya sudah dihapus
 * pengelola, dibagikan di WhatsApp dan diklik berbulan-bulan kemudian.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-shore-50 px-6 text-center">
      <p className="font-mono text-sm text-navy-soft">404</p>
      <h1 className="font-serif text-2xl font-medium text-navy">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-sm leading-relaxed text-navy-soft">
        Tautannya mungkin sudah berubah, atau destinasinya sudah tidak
        ditayangkan lagi oleh pengelolanya.
      </p>
      <a href="/beranda" className="btn-primary mt-2 px-5 py-2.5 text-sm">
        Ke beranda
      </a>
    </main>
  );
}
