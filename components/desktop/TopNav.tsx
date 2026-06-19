'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { useAuthState } from '@/lib/useAuth';
import NotificationBell from '@/components/notifications/NotificationBell';

const navLinks = [
  { label: 'Beranda', href: '/beranda' },
  { label: 'Booking', href: '/booking' },
  { label: 'Monitoring', href: '/monitoring' },
];

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const { user } = useAuthState();
  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DN';

  return (
    <header className="sticky top-0 z-50 border-b border-shore-200/60 bg-shore-50/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 shadow-sm">
              <span className="font-serif text-sm font-semibold text-white tracking-tight">D</span>
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight text-navy">
              DeepNorth
            </span>
          </Link>

          {/* Nav links - center */}
          <nav className="hidden sm:flex items-center gap-1 rounded-full border border-shore-200/70 bg-surface/60 p-1 backdrop-blur-sm">
            {navLinks.map(({ label, href }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'text-navy-soft hover:text-navy hover:bg-surface/80'
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search */}
            <div className="hidden min-[900px]:flex items-center gap-2 rounded-full border border-shore-200 bg-surface/70 px-3.5 py-2 text-navy-soft transition-colors duration-200 hover:border-shore-300 w-56 lg:w-64">
              <SearchIcon />
              <input
                placeholder="Cari destinasi..."
                className="flex-1 bg-transparent text-[13px] text-navy placeholder:text-[#A3AEB5] outline-none"
              />
            </div>

            {user ? (
              <>
                {/* Notification */}
                <NotificationBell variant="light" />

                {/* Avatar */}
                <Link
                  href="/profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-teal-100 to-teal-200 text-[11px] font-semibold text-teal-700 transition-all duration-200 hover:shadow-glow"
                >
                  {initials}
                </Link>
              </>
            ) : (
              <Link
                href="/profile"
                className="btn-primary rounded-full px-4 py-1.5 text-[13px]"
              >
                Masuk
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
