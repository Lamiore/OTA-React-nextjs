'use client';

import { useEffect, useState } from 'react';
import {
  approveRoleRequest,
  deleteUserAccount,
  openRoleRequest,
  rejectRoleRequest,
  subscribeUsers,
  updateUserRole,
  type AppUser,
} from '@/lib/firestore';
import { notifyApproval } from '@/lib/sendVerification';
import { formatTimestamp, waLink } from '@/lib/format';

const roleColors: Record<AppUser['role'], string> = {
  user: 'bg-shore-100 text-navy-soft',
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
  const [openingUid, setOpeningUid] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

  // Tiket pendaftaran pengelola. Formulirnya baru muncul di Pengaturan Akun
  // orang itu setelah ini diklik — pendaftaran tidak bisa dimulai sendiri.
  const handleOpenTicket = async (uid: string) => {
    setOpeningUid(uid);
    setMailWarn(null);
    try {
      await openRoleRequest(uid);
    } catch {
      setMailWarn('Gagal membuka tiket pendaftaran. Coba lagi.');
    } finally {
      setOpeningUid(null);
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
      // Data destinasi ikut dikirim: approveRoleRequest yang membuat dokumennya
      // dan menautkan managerUid, jadi admin tidak perlu bikin manual dulu.
      await approveRoleRequest(u.uid, u.verification);
      // Persetujuan sudah tersimpan; email cuma pemberitahuan — gagal kirim
      // tidak membatalkan apa pun, cukup diberitahukan ke admin.
      try {
        await notifyApproval(u.uid);
      } catch {
        setMailWarn(`Role pengelola untuk ${u.name || u.email} sudah aktif, tapi email pemberitahuan gagal terkirim.`);
      }
    } finally {
      setReviewingUid(null);
    }
  };

  const keyword = query.trim().toLowerCase();
  const shown = keyword
    ? users.filter((u) => [u.name, u.email].join(' ').toLowerCase().includes(keyword))
    : users;

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-medium text-navy">Pengguna</h1>
      <p className="mt-1 text-sm text-navy-soft">
        {keyword ? `${shown.length} dari ${users.length} pengguna` : `${users.length} pengguna terdaftar`}
      </p>

      <input
        type="search"
        aria-label="Cari pengguna"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari nama atau email"
        className="mt-4 w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
      />

      {mailWarn && (
        <p className="mt-4 rounded-md bg-warn-soft px-4 py-2.5 text-xs text-warn">{mailWarn}</p>
      )}

      <div className="mt-6 space-y-3">
        {shown.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">
              {keyword ? `Tidak ada pengguna cocok "${query.trim()}".` : 'Belum ada pengguna terdaftar.'}
            </p>
          </div>
        )}
        {shown.map((u) => (
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
                <option value="pengelola">Pengelola</option>
                <option value="admin">Admin</option>
              </select>

              {/* Tiket pendaftaran pengelola. Hanya untuk yang masih user:
                  pengelola/admin tidak perlu mendaftar lagi. Saat pengajuannya
                  sedang ditinjau, kartunya di bawah yang bicara. */}
              {u.role === 'user' && u.verification?.status !== 'pending' && (
                u.verification?.status === 'invited' ? (
                  <span className="shrink-0 rounded-sm bg-warn-soft px-3 py-1.5 text-xs font-medium text-warn">
                    Tiket terbuka
                  </span>
                ) : (
                  <button
                    onClick={() => handleOpenTicket(u.uid)}
                    disabled={openingUid === u.uid}
                    className="shrink-0 rounded-sm border border-shore-200 px-3 py-1.5 text-xs font-medium text-navy-soft transition-colors hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
                  >
                    Buka tiket pengelola
                  </button>
                )
              )}

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

            {/* Pengajuan jadi pengelola, dikirim dari Pengaturan Akun */}
            {u.verification?.status === 'pending' && (
              <div className="mt-4 rounded-md border border-warn-rule bg-warn-soft/60 p-4">
                <span className="inline-flex rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn">
                  Pengajuan Pengelola
                </span>
                <div className="mt-3 space-y-1 text-sm text-navy">
                  <p><span className="text-navy-soft">Nama:</span> {u.verification.fullName}</p>
                  {/* Ditautkan ke WhatsApp: seluruh sisa proses pengajuan
                      dibicarakan di sana, jadi admin tidak perlu menyalin
                      nomornya manual. */}
                  <p>
                    <span className="text-navy-soft">No. HP:</span>{' '}
                    {(() => {
                      const wa = waLink(
                        u.verification.phone,
                        `Halo ${u.verification.fullName}, soal pengajuanmu jadi pengelola Nusa untuk ${u.verification.destination ?? 'destinasi'}.`
                      );
                      return wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener"
                          className="font-medium text-teal-700 underline underline-offset-2"
                        >
                          {u.verification.phone}
                        </a>
                      ) : (
                        u.verification.phone
                      );
                    })()}
                  </p>
                  <p><span className="text-navy-soft">Instansi:</span> {u.verification.organization}</p>
                  {u.verification.destination && (
                    <p>
                      <span className="text-navy-soft">Destinasi diminta:</span>{' '}
                      {u.verification.destination}
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
                {/* Detail destinasi ada di semua pengajuan pengelola sekarang;
                    dokumen lama (dropdown) tidak punya, jadi tetap dijaga. */}
                {u.verification.destinationLocation && (
                  <div className="mt-3 rounded-md border border-shore-200 bg-surface p-3">
                    <p className="text-2xs font-medium text-navy">Destinasi yang akan dibuat</p>
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
                      Pastikan dasar haknya lewat WhatsApp sebelum menyetujui.
                      Begitu disetujui, destinasi ini dibuat otomatis dan langsung
                      jadi kelolaannya — tidak perlu dibuat manual di panel Destinasi.
                      Nama yang sudah terdaftar dipakai ulang, bukan diduplikat.
                    </p>
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
