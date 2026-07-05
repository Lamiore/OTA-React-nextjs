'use client';

import { useEffect, useState } from 'react';
import { subscribeUsers, updateUserRole, type AppUser } from '@/lib/firestore';

const roleColors: Record<AppUser['role'], string> = {
  user: 'bg-shore-100 text-navy-soft',
  mitra: 'bg-sky-100 text-sky-700',
  pengelola: 'bg-amber-100 text-amber-700',
  admin: 'bg-teal-100 text-teal-700',
};

export default function PenggunaPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeUsers(setUsers);
    return () => unsub();
  }, []);

  const handleRoleChange = async (uid: string, role: AppUser['role']) => {
    setUpdatingUid(uid);
    await updateUserRole(uid, role);
    setUpdatingUid(null);
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
          <div key={u.uid} className="card flex items-center gap-4 px-5 py-4">
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
              <option value="pengelola">Pengelola</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
