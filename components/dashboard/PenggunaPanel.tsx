'use client';

import { useEffect, useState } from 'react';
import {
  approveMitra,
  distinctLocations,
  rejectMitra,
  subscribeDestinations,
  subscribeUsers,
  updateUserLocation,
  updateUserRole,
  type AppUser,
  type Destination,
} from '@/lib/firestore';

const roleColors: Record<AppUser['role'], string> = {
  user: 'bg-shore-100 text-navy-soft',
  mitra: 'bg-sky-100 text-sky-700',
  pengelola: 'bg-amber-100 text-amber-700',
  admin: 'bg-teal-100 text-teal-700',
};

export default function PenggunaPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [reviewingUid, setReviewingUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeUsers(setUsers);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeDestinations(setDestinations);
    return () => unsub();
  }, []);

  const regions = distinctLocations(destinations);

  const handleRoleChange = async (uid: string, role: AppUser['role']) => {
    setUpdatingUid(uid);
    await updateUserRole(uid, role);
    setUpdatingUid(null);
  };

  const handleLocationChange = async (uid: string, location: string) => {
    setUpdatingUid(uid);
    await updateUserLocation(uid, location);
    setUpdatingUid(null);
  };

  const handleReview = async (uid: string, approve: boolean) => {
    setReviewingUid(uid);
    try {
      if (approve) {
        await approveMitra(uid);
      } else {
        await rejectMitra(uid);
      }
    } finally {
      setReviewingUid(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-medium text-navy">Pengguna</h1>
      <p className="mt-1 text-sm text-navy-soft">{users.length} pengguna terdaftar</p>

      <div className="mt-6 space-y-3">
        {users.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">Belum ada pengguna terdaftar.</p>
          </div>
        )}
        {users.map((u) => (
          <div key={u.uid} className="card px-5 py-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              {u.photoURL ? (
                <img
                  src={u.photoURL}
                  alt={u.name}
                  className="h-10 w-10 rounded-full object-cover border border-shore-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center border border-shore-200 shrink-0">
                  <span className="text-sm font-semibold text-teal-700">
                    {u.name ? u.name[0].toUpperCase() : u.email?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-navy truncate">{u.name || 'Tanpa Nama'}</p>
                <p className="text-[12px] text-navy-soft truncate">{u.email}</p>
              </div>

              {/* Role selector */}
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.uid, e.target.value as AppUser['role'])}
                disabled={updatingUid === u.uid}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium border border-shore-200 outline-none cursor-pointer transition-colors focus:border-teal-400 disabled:opacity-50 ${roleColors[u.role]}`}
              >
                <option value="user">User</option>
                <option value="mitra">Mitra</option>
                <option value="pengelola">Pengelola</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Wilayah kelola — hanya untuk pengelola. Membatasi kamera & statistik. */}
            {u.role === 'pengelola' && (
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-14">
                <span className="text-[12px] text-navy-soft">Wilayah kelola:</span>
                <select
                  value={u.location ?? ''}
                  onChange={(e) => handleLocationChange(u.uid, e.target.value)}
                  disabled={updatingUid === u.uid}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-medium border border-shore-200 bg-surface text-navy outline-none cursor-pointer transition-colors focus:border-teal-400 disabled:opacity-50"
                >
                  <option value="">Pilih wilayah…</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {!u.location && (
                  <span className="text-[11px] text-amber-600">Belum ditetapkan</span>
                )}
              </div>
            )}

            {/* Pengajuan verifikasi mitra */}
            {u.verification?.status === 'pending' && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <span className="inline-flex rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  Pengajuan Mitra
                </span>
                <div className="mt-3 space-y-1 text-[13px] text-navy">
                  <p><span className="text-navy-soft">Nama:</span> {u.verification.fullName}</p>
                  <p><span className="text-navy-soft">No. HP:</span> {u.verification.phone}</p>
                  <p><span className="text-navy-soft">Instansi:</span> {u.verification.organization}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleReview(u.uid, true)}
                    disabled={reviewingUid === u.uid}
                    className="btn-primary flex-1 rounded-xl px-4 py-2 text-[12px] disabled:opacity-50"
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => handleReview(u.uid, false)}
                    disabled={reviewingUid === u.uid}
                    className="btn-ghost flex-1 rounded-xl px-4 py-2 text-[12px] hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
