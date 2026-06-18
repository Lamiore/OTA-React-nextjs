'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';


function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-teal-600' : 'text-navy-soft'}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}


function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-white">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function ActivityIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={active ? 'text-teal-600' : 'text-navy-soft'}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}


const navItems = [
  { label: 'Beranda', href: '/beranda', Icon: HomeIcon },
  { label: 'Booking', href: '/booking', Icon: CalendarIcon, center: true },
  { label: 'Monitor', href: '/monitoring', Icon: ActivityIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 mx-auto rounded-2xl border border-shore-200/80 bg-surface/85 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom,6px)+6px)] backdrop-blur-xl shadow-soft md:hidden">
      <div className="flex items-end justify-around">
        {navItems.map(({ label, href, Icon, center }) => {
          const isActive = pathname === href;

          if (center) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center -mt-5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500 border-[3px] border-shore-50 shadow-glow">
                  <CalendarIcon />
                </div>
                <span className="mt-1 text-[9px] font-medium text-teal-600">
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className="flex min-w-[48px] flex-col items-center py-1"
            >
              <Icon active={isActive} />
              <span
                className={clsx(
                  'mt-1 text-[9px] font-medium',
                  isActive ? 'text-teal-600' : 'text-navy-soft'
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
