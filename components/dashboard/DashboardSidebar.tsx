'use client';

import clsx from 'clsx';
import Link from 'next/link';

export type DashboardPage = 'statistik' | 'scan' | 'destinasi' | 'pengguna';

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" x2="9" y1="3" y2="18" />
      <line x1="15" x2="15" y1="6" y2="21" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" x2="17" y1="12" y2="12" />
    </svg>
  );
}

const allMenuItems: { key: DashboardPage; label: string; icon: React.ReactNode; roles: string[] }[] = [
  { key: 'statistik', label: 'Statistik', icon: <ChartIcon />, roles: ['admin', 'pengelola'] },
  { key: 'scan', label: 'Scan Tiket', icon: <ScanIcon />, roles: ['admin', 'pengelola'] },
  { key: 'destinasi', label: 'Destinasi', icon: <MapIcon />, roles: ['admin'] },
  { key: 'pengguna', label: 'Pengguna', icon: <UsersIcon />, roles: ['admin'] },
];

interface Props {
  active: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
  mobileOpen: boolean;
  onMobileToggle: () => void;
  role?: string;
}

export default function DashboardSidebar({ active, onNavigate, mobileOpen, onMobileToggle, role = 'admin' }: Props) {
  const menuItems = allMenuItems.filter((item) => item.roles.includes(role));
  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 flex items-center justify-between h-14 px-4 border-b border-shore-200/60 bg-shore-50/90 backdrop-blur-xl">
        <button onClick={onMobileToggle} className="text-navy-soft hover:text-navy transition-colors">
          <MenuIcon />
        </button>
        <span className="font-serif text-lg font-semibold text-navy">Dashboard</span>
        <Link href="/profile" className="text-navy-soft hover:text-navy transition-colors">
          <ArrowLeftIcon />
        </Link>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm"
          onClick={onMobileToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-dvh w-64 bg-surface border-r border-shore-200/60 flex flex-col transition-transform duration-300 ease-out',
          'md:translate-x-0 md:static md:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-shore-200/60 shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 shadow-sm">
              <span className="font-serif text-sm font-semibold text-white tracking-tight">D</span>
            </div>
            <div>
              <span className="font-serif text-base font-semibold tracking-tight text-navy">DeepNorth</span>
              <p className="text-[10px] text-navy-soft -mt-0.5">{role === 'admin' ? 'Admin Panel' : 'Panel Pengelola'}</p>
            </div>
          </Link>
          <button onClick={onMobileToggle} className="md:hidden text-navy-soft hover:text-navy transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map(({ key, label, icon }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => {
                  onNavigate(key);
                  onMobileToggle();
                }}
                className={clsx(
                  'w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-teal-50 text-teal-700 border border-teal-100'
                    : 'text-navy-soft hover:bg-shore-50 hover:text-navy border border-transparent'
                )}
              >
                <span className={isActive ? 'text-teal-600' : ''}>{icon}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 shrink-0">
          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-navy-soft hover:bg-shore-50 hover:text-navy transition-all duration-200 border border-transparent"
          >
            <ArrowLeftIcon />
            Kembali ke Profil
          </Link>
        </div>
      </aside>
    </>
  );
}
