'use client';

import { useAuthState } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';
import NotificationBell from '@/components/notifications/NotificationBell';

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export default function MobileHeader() {
  const { user } = useAuthState();
  const { t } = useLang();
  const firstName = user?.displayName?.split(' ')[0] ?? 'Explorer';
  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DN';

  return (
    <>
      <div className="bg-ink px-4 pt-4 pb-6">
        {/* Top row */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <p className="text-sm text-white/45 font-light">{t('home.welcome')}</p>
            <h1 className="font-serif text-xl text-white font-medium mt-0.5">
              {t('home.greetingPlain', { name: firstName })}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell variant="dark" />
            <div className="w-8 h-8 rounded-xs bg-gradient-to-b from-teal-100 to-teal-200 flex items-center justify-center text-2xs font-semibold text-teal-700">
              {initials}
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="rounded-md border border-white/10 bg-white/8 px-3.5 py-2.5 flex items-center gap-2.5 backdrop-blur-sm">
          <SearchIcon />
          <input
            placeholder={t('home.searchMobile')}
            className="bg-transparent text-white placeholder:text-white/35 text-sm flex-1 outline-none"
          />
        </div>
      </div>

      {/* Curve transition */}
      <div className="bg-shore-50 h-5 rounded-t-[20px] -mt-1 relative z-10" />
    </>
  );
}
