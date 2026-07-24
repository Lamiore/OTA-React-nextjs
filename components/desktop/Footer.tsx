import Link from 'next/link';

// Ft1 · Mast-headed — wordmark + tagline menjangkar satu pita horizontal, tautan
// kecil di sampingnya. Rule ganda di atas menutup halaman dengan tanda baca yang
// sama seperti masthead membukanya (N6). Menggantikan Ft5 statement: kalimat
// display raksasa + bloom teal itu kosakata atmospheric, bukan editorial.
export default function Footer() {
  return (
    <footer className="mt-auto">
      <div className="h-[3px] border-y border-shore-200" aria-hidden="true" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-baseline gap-x-10 gap-y-4 px-4 py-10 sm:px-6 lg:px-10">
        <div>
          <p className="font-serif text-lg font-semibold tracking-tight text-navy">
            Lautara
          </p>
          <p className="mt-1 text-sm text-navy-soft">
            Destinasi selam dan pesisir Sulawesi Utara.
          </p>
        </div>

        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link href="/beranda" className="btn-text">
            Beranda
          </Link>
          <Link href="/booking" className="btn-text">
            Booking
          </Link>
          <Link href="/profile" className="btn-text">
            Profil
          </Link>
        </nav>

        <span className="ml-auto text-xs text-navy-soft">
          © 2026 Lautara · Sulawesi Utara
        </span>
      </div>
    </footer>
  );
}
