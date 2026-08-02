'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { useAuthState } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';
import NotificationBell from '@/components/notifications/NotificationBell';

const navLinks = [
  { labelKey: 'nav.home', href: '/beranda' },
  { labelKey: 'nav.booking', href: '/booking' },
  // Di mobile Monitoring masih diakses lewat menu profil — BottomNav tidak
  // punya slot keempat.
  { labelKey: 'nav.monitoring', href: '/kamera' },
  { labelKey: 'nav.profile', href: '/profile' },
];

// Bar horizontal desktop — logo kiri, tombol nav + aksi akun kanan. Pil hover
// menggantikan masthead terpusat N6: lebih ramah-pengguna, terbaca sebagai
// aplikasi, bukan halaman koran.
//
// `hidden md:block` — di mobile navbar ini tidak dirender sama sekali; navigasi
// sudah ditangani BottomNav floating. `compact` sedikit merapatkan tinggi bar
// untuk halaman aplikasi (booking, profil, dashboard).
export default function TopNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuthState();
  const { t } = useLang();
  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'LA';

  return (
    <header className="sticky top-0 z-50 hidden border-b border-shore-200 bg-surface/90 backdrop-blur-md md:block">
      <div
        className={clsx(
          'mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 lg:px-10',
          compact ? 'h-14' : 'h-16'
        )}
      >
        {/* Logo kiri */}
        <Link href="/beranda" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={clsx('brand-mark shrink-0 text-teal-600', compact ? 'h-6' : 'h-7')}
          />
          <span
            className={clsx(
              'font-serif font-semibold tracking-tight text-navy',
              compact ? 'text-lg' : 'text-xl'
            )}
          >
            Nusa
          </span>
        </Link>

        {/* Tombol nav + aksi akun kanan */}
        <div className="flex items-center gap-1">
          <nav aria-label="Utama">
            <ul className="flex items-center gap-1">
              {navLinks.map(({ labelKey, href }) => {
                const isActive = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive ? 'page' : undefined}
                      className={clsx(
                        'inline-block rounded-full px-4 py-2 text-sm transition-colors duration-micro ease-out',
                        isActive
                          ? 'bg-teal-50 font-semibold text-teal-700'
                          : 'font-medium text-navy-soft hover:bg-shore-100 hover:text-navy'
                      )}
                    >
                      {t(labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <span className="mx-2 h-6 w-px bg-shore-200" aria-hidden="true" />

          {user ? (
            <>
              <NotificationBell variant="light" />
              <Link
                href="/profile"
                aria-label={t('nav.profile')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-shore-200 bg-shore-100 text-2xs font-semibold text-navy transition-colors duration-micro ease-out hover:border-teal-500"
              >
                {initials}
              </Link>
            </>
          ) : (
            <Link href="/profile" className="btn-primary px-4 py-1.5">
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
