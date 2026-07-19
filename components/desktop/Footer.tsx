import Link from 'next/link';

// Ft5 · Statement — satu kalimat penutup di pita laut-dalam (bukan sitemap 4 kolom).
export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      {/* Bloom teal — cahaya dari kedalaman, satu aksen sesuai genre atmospheric. */}
      <div className="pointer-events-none absolute -bottom-28 left-1/2 h-72 w-[42rem] max-w-[90vw] -translate-x-1/2 rounded-full bg-teal-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
        <p className="max-w-[20ch] font-serif text-4xl font-medium leading-[1.03] tracking-tight text-white sm:text-5xl lg:text-6xl">
          Laut dalam Sulawesi{' '}
          <span className="text-[#8FE6DB]">menanti untuk diselami.</span>
        </p>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-t border-white/12 pt-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500">
              <span className="font-serif text-sm font-semibold text-white">L</span>
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight text-white">
              Lautara
            </span>
          </div>

          <nav className="flex items-center gap-6 text-[13px] text-white/60">
            <Link href="/beranda" className="transition-colors hover:text-white">Beranda</Link>
            <Link href="/booking" className="transition-colors hover:text-white">Booking</Link>
            <Link href="/profile" className="transition-colors hover:text-white">Profil</Link>
          </nav>

          <span className="text-[12px] text-white/40">
            &copy; 2026 Lautara · Sulawesi Utara
          </span>
        </div>
      </div>
    </footer>
  );
}
