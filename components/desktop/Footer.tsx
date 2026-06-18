import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-shore-200 bg-shore-50">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-4">
          {/* Brand */}
          <div className="xl:col-span-1">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink">
                <span className="font-serif text-sm font-semibold text-white">D</span>
              </div>
              <span className="font-serif text-lg text-navy font-semibold">
                DeepNorth
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-navy-soft max-w-xs">
              Platform OTA untuk destinasi selam terbaik di Indonesia Utara.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-600">
              Destinasi
            </h4>
            <ul className="space-y-2.5">
              {['Bunaken', 'Likupang', 'Lembeh', 'Bangka'].map((d) => (
                <li key={d}>
                  <Link href="#" className="text-[13px] text-navy-soft transition-colors hover:text-navy">
                    {d}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-600">
              Layanan
            </h4>
            <ul className="space-y-2.5">
              {['Diving Trip', 'Snorkeling', 'Boat Charter', 'Photography'].map((s) => (
                <li key={s}>
                  <Link href="#" className="text-[13px] text-navy-soft transition-colors hover:text-navy">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-600">
              Perusahaan
            </h4>
            <ul className="space-y-2.5">
              {['Tentang Kami', 'Kontak', 'Kebijakan Privasi', 'Syarat & Ketentuan'].map((c) => (
                <li key={c}>
                  <Link href="#" className="text-[13px] text-navy-soft transition-colors hover:text-navy">
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-shore-200 pt-6 text-center">
          <p className="text-[12px] text-navy-soft/60">
            &copy; 2026 DeepNorth. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
