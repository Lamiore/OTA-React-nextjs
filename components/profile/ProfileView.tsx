'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signOut, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import type { UserRole } from '@/lib/useAuth';
import BookingHistory from '@/components/booking/BookingHistory';
import Link from 'next/link';

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const menuItems = [
  {
    label: 'Riwayat Booking',
    description: 'Lihat dan kelola reservasi',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Destinasi Tersimpan',
    description: 'Tempat yang ingin kamu kunjungi',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
    ),
  },
  {
    label: 'Bantuan & Dukungan',
    description: 'FAQ dan hubungi kami',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
];

export default function ProfileView({ user, role }: { user: User; role: UserRole | null }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const searchParams = useSearchParams();
  const [view, setView] = useState<'menu' | 'riwayat'>(
    searchParams.get('view') === 'riwayat' ? 'riwayat' : 'menu'
  );

  const initials = user.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? 'U';

  const handleSaveName = async () => {
    if (!auth?.currentUser || !displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      setEditing(false);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  if (view === 'riwayat') {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in">
        <button
          onClick={() => setView('menu')}
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-navy-soft transition-colors hover:text-navy"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Kembali
        </button>
        <BookingHistory />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto animate-fade-in">
      {/* Profile card */}
      <div className="card p-6 sm:p-8">
        {/* Avatar + info */}
        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="relative group mb-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'Avatar'}
                className="h-20 w-20 rounded-full object-cover border-2 border-shore-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center border-2 border-shore-200">
                <span className="text-xl font-semibold text-teal-700">{initials}</span>
              </div>
            )}
            <button className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white border border-shore-200 flex items-center justify-center text-navy-soft hover:text-teal-600 hover:border-teal-300 transition-colors shadow-sm">
              <CameraIcon />
            </button>
          </div>

          {/* Name */}
          {editing ? (
            <div className="flex items-center gap-2 mb-1 animate-fade-in">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="text-center font-serif text-xl font-medium text-navy bg-transparent border-b-2 border-teal-400 outline-none px-2 py-0.5"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={saving}
                className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white hover:bg-teal-600 transition-colors disabled:opacity-50"
              >
                <CheckIcon />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-serif text-xl font-medium text-navy">
                {user.displayName || 'Pengguna'}
              </h2>
              <button
                onClick={() => setEditing(true)}
                className="h-7 w-7 rounded-full border border-shore-200 flex items-center justify-center text-navy-soft hover:text-teal-600 hover:border-teal-300 transition-colors"
              >
                <EditIcon />
              </button>
            </div>
          )}

          <p className="text-[13px] text-navy-soft">{user.email}</p>

          {/* Provider badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-shore-200 bg-shore-50 px-3 py-1.5 text-[10px] font-medium text-navy-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            {user.providerData[0]?.providerId === 'google.com' ? 'Google Account' : 'Email & Password'}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-shore-200 my-6" />

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <span className="text-lg font-semibold text-navy">0</span>
            <p className="text-[11px] text-navy-soft mt-0.5">Booking</p>
          </div>
          <div className="border-x border-shore-200">
            <span className="text-lg font-semibold text-navy">0</span>
            <p className="text-[11px] text-navy-soft mt-0.5">Tersimpan</p>
          </div>
          <div>
            <span className="text-lg font-semibold text-navy">0</span>
            <p className="text-[11px] text-navy-soft mt-0.5">Ulasan</p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="card mt-4 divide-y divide-shore-200/80 overflow-hidden">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.label === 'Riwayat Booking' ? () => setView('riwayat') : undefined}
            className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-shore-50"
          >
            <div className="h-10 w-10 rounded-xl bg-shore-100 flex items-center justify-center text-navy-soft shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-navy">{item.label}</p>
              <p className="text-[11px] text-navy-soft mt-0.5">{item.description}</p>
            </div>
            <span className="text-shore-300">
              <ChevronIcon />
            </span>
          </button>
        ))}
      </div>

      {/* Dashboard — admin/pengelola only */}
      {(role === 'admin' || role === 'pengelola') && (
        <Link
          href="/dashboard"
          className="card mt-4 flex items-center gap-4 px-5 py-4 transition-colors hover:bg-shore-50 overflow-hidden"
        >
          <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-navy">Dashboard</p>
            <p className="text-[11px] text-navy-soft mt-0.5">Kelola destinasi dan pengguna</p>
          </div>
          <span className="text-shore-300">
            <ChevronIcon />
          </span>
        </Link>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full mt-4 flex items-center justify-center gap-2.5 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3.5 text-[13px] font-medium text-red-500 transition-all duration-200 hover:bg-red-50 hover:border-red-200"
      >
        <LogOutIcon />
        Keluar
      </button>
    </div>
  );
}
