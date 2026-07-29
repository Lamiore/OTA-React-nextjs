'use client';

import { useEffect, useState } from 'react';
import {
  approveRoleRequest,
  rejectRoleRequest,
  requestedRole,
  subscribeUsers,
  updateUserRole,
  type AppUser,
} from '@/lib/firestore';
import { notifyApproval } from '@/lib/sendVerification';
import { formatTimestamp } from '@/lib/format';

const roleColors: Record<AppUser['role'], string> = {
  user: 'bg-shore-100 text-navy-soft',
  mitra: 'bg-shore-100 text-navy-soft',
  pengelola: 'bg-warn-soft text-warn',
  admin: 'bg-teal-100 text-teal-700',
};

export default function PenggunaPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [reviewingUid, setReviewingUid] = useState<string | null>(null);
  const [mailWarn, setMailWarn] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeUsers(setUsers);
    return () => unsub();
  }, []);

  const handleRoleChange = async (uid: string, role: AppUser['role']) => {
    setUpdatingUid(uid);
    await updateUserRole(uid, role);
    setUpdatingUid(null);
  };

  const handleReview = async (u: AppUser, approve: boolean) => {
    setReviewingUid(u.uid);
    setMailWarn(null);
    try {
      if (!approve) {
        await rejectRoleRequest(u.uid);
        return;
      }
      const role = requestedRole(u.verification ?? {});
      await approveRoleRequest(u.uid, role);
      // Persetujuan sudah tersimpan; email cuma pemberitahuan — gagal kirim
      // tidak membatalkan apa pun, cukup diberitahukan ke admin.
      try {
        await notifyApproval(u.uid, role);
      } catch {
        setMailWarn(`Role ${role} untuk ${u.name || u.email} sudah aktif, tapi email pemberitahuan gagal terkirim.`);
      }
    } finally {
      setReviewingUid(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-medium text-navy">Pengguna</h1>
      <p className="mt-1 text-sm text-navy-soft">{users.length} pengguna terdaftar</p>

      {mailWarn && (
        <p className="mt-4 rounded-md bg-warn-soft px-4 py-2.5 text-xs text-warn">{mailWarn}</p>
      )}

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
                <p className="text-sm font-medium text-navy truncate">{u.name || 'Tanpa Nama'}</p>
                <p className="text-xs text-navy-soft truncate">{u.email}</p>
              </div>

              {/* Role selector */}
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.uid, e.target.value as AppUser['role'])}
                disabled={updatingUid === u.uid}
                className={`rounded-sm px-3 py-1.5 text-xs font-medium border border-shore-200 outline-none cursor-pointer transition-colors focus:border-teal-400 disabled:opacity-50 ${roleColors[u.role]}`}
              >
                <option value="user">User</option>
                <option value="mitra">Mitra</option>
                <option value="pengelola">Pengelola</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Pengajuan naik role (mitra dari halaman Kamera, pengelola dari Pengaturan) */}
            {u.verification?.status === 'pending' && (
              <div className="mt-4 rounded-md border border-warn-rule bg-warn-soft/60 p-4">
                <span className="inline-flex rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn">
                  {requestedRole(u.verification) === 'pengelola' ? 'Pengajuan Pengelola' : 'Pengajuan Mitra'}
                </span>
                <div className="mt-3 space-y-1 text-sm text-navy">
                  <p><span className="text-navy-soft">Nama:</span> {u.verification.fullName}</p>
                  <p><span className="text-navy-soft">No. HP:</span> {u.verification.phone}</p>
                  <p><span className="text-navy-soft">Instansi:</span> {u.verification.organization}</p>
                  {u.verification.destination && (
                    <p><span className="text-navy-soft">Destinasi diminta:</span> {u.verification.destination}</p>
                  )}
                  {u.verification.agreementVersion && (
                    <p>
                      <span className="text-navy-soft">Perjanjian:</span>{' '}
                      {[
                        `v${u.verification.agreementVersion}`,
                        formatTimestamp(u.verification.agreedAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleReview(u, true)}
                    disabled={reviewingUid === u.uid}
                    className="btn-primary flex-1 px-4 py-2 text-xs disabled:opacity-50"
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => handleReview(u, false)}
                    disabled={reviewingUid === u.uid}
                    className="btn-ghost flex-1 px-4 py-2 text-xs hover:border-danger-rule hover:text-danger disabled:opacity-50"
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
