'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { useAuthState } from '@/lib/useAuth';
import NotificationBell from '@/components/notifications/NotificationBell';

const navLinks = [
  { label: 'Beranda', href: '/beranda' },
  { label: 'Booking', href: '/booking' },
];

// N5 · Floating pill — nav detached & content-sized, blur backdrop mengambang di
// atas kanvas. Search dipindah ke hero, jadi pill tetap ramping.
export default function TopNav() {
  const pathname = usePathname();
  const { user } = useAuthState();
  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'LA';

  return (
    <header className="sticky top-0 z-50 px-4 pt-3">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 rounded-full border border-shore-200/60 bg-surface/70 pl-4 pr-2 shadow-soft backdrop-blur-xl">
        {/* Wordmark */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500">
            <span className="font-serif text-[13px] font-semibold tracking-tight text-white">L</span>
          </div>
          <span className="font-serif text-base font-semibold tracking-tight text-navy">
            Lautara
          </span>
        </Link>

        {/* Links */}
        <nav className="hidden items-center gap-1 sm:flex">
          {navLinks.map(({ label, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-navy-soft hover:bg-shore-100 hover:text-navy'
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex shrink-0 items-center gap-1.5">
          {user ? (
            <>
              <NotificationBell variant="light" />
              <Link
                href="/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-teal-100 to-teal-200 text-[11px] font-semibold text-teal-700 transition-all duration-200 hover:shadow-glow"
              >
                {initials}
              </Link>
            </>
          ) : (
            <Link href="/profile" className="btn-primary rounded-full px-4 py-1.5 text-[13px]">
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
