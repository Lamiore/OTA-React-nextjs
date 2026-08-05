'use client';

import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { AGREEMENT } from '@/lib/verification';
import { ADMIN_EMAIL, ADMIN_WA } from '@/lib/contact';
import { useCameraAccess } from '@/lib/useCameraAccess';
import { waLink } from '@/lib/format';

// Ft1 · Mast-headed — wordmark + tagline menjangkar pita horizontal, kolom
// tautan di sampingnya. Rule ganda di atas menutup halaman dengan tanda baca
// yang sama seperti masthead membukanya (N6). Menggantikan Ft5 statement:
// kalimat display raksasa + bloom teal itu kosakata atmospheric, bukan
// editorial.
//
// Setiap tautan di sini menuju rute yang benar-benar ada — tidak ada label
// hiasan. Rute baru berarti satu baris baru di KOLOM, bukan markup baru.
const KOLOM: {
  headingKey: string;
  links: { labelKey?: string; label?: string; href: string; needsCamera?: boolean }[];
}[] = [
  {
    headingKey: 'nav.explore',
    links: [
      { labelKey: 'nav.home', href: '/beranda' },
      // Grid destinasi punya id="destinasi" + scroll-mt, jadi anchor ini
      // mendarat di judul seksinya, bukan ketutup TopNav yang sticky.
      { labelKey: 'home.sectionTitle', href: '/beranda#destinasi' },
      // Ikut disembunyikan bersama tombol Monitoring di TopNav — kalau tidak,
      // footer jadi pintu belakang ke halaman yang sengaja ditutup.
      { labelKey: 'nav.monitoring', href: '/kamera', needsCamera: true },
      { labelKey: 'nav.booking', href: '/booking' },
    ],
  },
  {
    headingKey: 'footer.account',
    links: [
      { labelKey: 'nav.profile', href: '/profile' },
      // ProfileView membaca ?view=riwayat, jadi tautan ini langsung membuka
      // tab riwayat — bukan cuma halaman profilnya.
      { labelKey: 'profile.bookingHistory', href: '/profile?view=riwayat' },
      { labelKey: 'profile.saved', href: '/profile?view=tersimpan' },
      // Form pengajuan pengelola hidup di dalam tab Pengaturan.
      { labelKey: 'footer.becomeManager', href: '/profile?view=pengaturan' },
    ],
  },
  {
    headingKey: 'footer.help',
    links: [
      { labelKey: 'profile.help', href: '/profile?view=bantuan' },
      // label, bukan labelKey: nama dokumen perjanjian sengaja tidak
      // diterjemahkan (lihat catatan di lib/verification.ts).
      { label: AGREEMENT.pengelola.label, href: AGREEMENT.pengelola.path },
    ],
  },
];

export default function Footer() {
  const { t } = useLang();
  const { allowed: canSeeCameras } = useCameraAccess();
  const wa = waLink(ADMIN_WA, t('support.waMessage'));

  return (
    <footer className="mt-auto">
      <div className="h-[3px] border-y border-shore-200" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-10">
        <div className="flex flex-wrap gap-x-12 gap-y-8">
          <div className="min-w-[14rem] max-w-sm flex-1">
            <p className="flex items-center gap-2 font-serif text-lg font-semibold tracking-tight text-navy">
              <span aria-hidden="true" className="brand-mark h-6 shrink-0 text-teal-600" />
              Nusa
            </p>
            <p className="mt-1 text-sm text-navy-soft">{t('footer.tagline')}</p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-12 gap-y-8">
            {KOLOM.map((kolom) => (
              <div key={kolom.headingKey}>
                <h2 className="text-2xs font-semibold uppercase tracking-wider text-navy">
                  {t(kolom.headingKey)}
                </h2>
                <ul className="mt-3 space-y-2">
                  {kolom.links
                    .filter((l) => !l.needsCamera || canSeeCameras)
                    .map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="btn-text text-sm">
                        {l.label ?? t(l.labelKey!)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-navy">
                {t('footer.contact')}
              </h2>
              <ul className="mt-3 space-y-2">
                {/* Nomor kosong = baris WhatsApp hilang, bukan tautan mati. */}
                {wa && (
                  <li>
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener"
                      className="btn-text text-sm"
                    >
                      WhatsApp {ADMIN_WA}
                    </a>
                  </li>
                )}
                <li>
                  <a
                    href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(t('support.mailSubject'))}`}
                    className="btn-text text-sm"
                  >
                    {ADMIN_EMAIL}
                  </a>
                </li>
              </ul>
              <p className="mt-3 max-w-[15rem] text-2xs text-navy-soft">
                {t('support.replyTime')}
              </p>
            </div>
          </nav>
        </div>

        <p className="mt-10 border-t border-shore-200 pt-6 text-xs text-navy-soft">
          © 2026 Nusa
        </p>
      </div>
    </footer>
  );
}
