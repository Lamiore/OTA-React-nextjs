'use client';

import { useEffect, useState } from 'react';
import {
  approveRoleRequest,
  deleteUserAccount,
  rejectRoleRequest,
  requestedRole,
  subscribeUsers,
  updateUserRole,
  type AppUser,
} from '@/lib/firestore';
import { notifyApproval } from '@/lib/sendVerification';
import { formatTimestamp, waLink } from '@/lib/format';
import { packageRecipient } from '@/lib/verification';

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
  // Hapus butuh klik dua kali: klik pertama menandai baris, klik kedua eksekusi.
  const [confirmUid, setConfirmUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeUsers(setUsers);
    return () => unsub();
  }, []);

  const handleRoleChange = async (uid: string, role: AppUser['role']) => {
    setUpdatingUid(uid);
    await updateUserRole(uid, role);
    setUpdatingUid(null);
  };

  const handleDelete = async (u: AppUser) => {
    if (confirmUid !== u.uid) {
      setConfirmUid(u.uid);
      return;
    }
    setDeletingUid(u.uid);
    setMailWarn(null);
    try {
      await deleteUserAccount(u.uid);
    } catch {
      setMailWarn(`Gagal menghapus ${u.name || u.email}. Coba lagi.`);
    } finally {
      setDeletingUid(null);
      setConfirmUid(null);
    }
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

              {/* Hapus akun — Auth + dokumen Firestore sekaligus */}
              <button
                onClick={() => handleDelete(u)}
                onBlur={() => confirmUid === u.uid && setConfirmUid(null)}
                disabled={deletingUid === u.uid}
                className={`shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
                  confirmUid === u.uid
                    ? 'border-danger-rule bg-danger-soft text-danger'
                    : 'border-shore-200 text-navy-soft hover:border-danger-rule hover:text-danger'
                }`}
              >
                {confirmUid === u.uid ? 'Yakin hapus?' : 'Hapus'}
              </button>
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
                    <p>
                      <span className="text-navy-soft">Destinasi diminta:</span>{' '}
                      {u.verification.destination}
                      {u.verification.newDestination && (
                        <span className="ml-1.5 inline-flex rounded-sm bg-warn-soft px-1.5 py-0.5 text-2xs font-medium text-warn">
                          usulan baru
                        </span>
                      )}
                    </p>
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
                {u.verification.newDestination && (
                  <div className="mt-3 rounded-md border border-shore-200 bg-surface p-3">
                    <p className="text-2xs font-medium text-navy">Usulan destinasi baru</p>
                    <div className="mt-1.5 space-y-1 text-sm text-navy">
                      <p><span className="text-navy-soft">Lokasi:</span> {u.verification.destinationLocation}</p>
                      <p>
                        <span className="text-navy-soft">Dasar hak:</span>{' '}
                        {u.verification.landRights}
                        {u.verification.declaredRights && (
                          <span className="text-navy-soft"> · dinyatakan pengaju</span>
                        )}
                      </p>
                      <p className="leading-relaxed">{u.verification.destinationDescription}</p>
                    </div>
                    <p className="text-2xs text-navy-soft mt-2 leading-relaxed">
                      Pastikan dasar haknya lewat WhatsApp, lalu buat destinasinya
                      di panel Destinasi sebelum menyetujui pengajuan ini.
                    </p>
                  </div>
                )}
                {u.verification.shippingAddress && (
                  <div className="mt-3 rounded-md border border-shore-200 bg-surface p-3">
                    <p className="text-2xs font-medium text-navy">Kirim paket sensor ke</p>
                    <p className="text-sm text-navy mt-1 leading-relaxed">
                      {u.verification.shippingAddress}
                      {u.verification.postalCode && ` ${u.verification.postalCode}`}
                    </p>
                    {(() => {
                      const to = packageRecipient(u.verification!);
                      const wa = waLink(
                        to.phone,
                        `Halo ${to.name}, paket sensor Nusa untuk ${u.verification!.destination ?? 'destinasi'} siap dikirim.`
                      );
                      return (
                        <p className="text-2xs text-navy-soft mt-2">
                          a/n {to.name} ·{' '}
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener"
                              className="font-medium text-teal-700 underline underline-offset-2"
                            >
                              {to.phone}
                            </a>
                          ) : (
                            to.phone
                          )}
                        </p>
                      );
                    })()}
                  </div>
                )}
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
