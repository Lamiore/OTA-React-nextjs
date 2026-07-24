'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';
import type { UserRole } from '@/lib/useAuth';
import { canManageCameras, type MitraVerification } from '@/lib/firestore';
import CameraManager from './CameraManager';
import VerificationForm from './VerificationForm';

interface Props {
  user: User;
  role: UserRole | null;
}

/**
 * Router kecil view Kamera di profil:
 * - mitra/pengelola/admin → CameraManager;
 * - verification pending → kartu status;
 * - rejected → kartu ditolak + ajukan ulang;
 * - selain itu (belum mengajukan, atau approved tapi role diturunkan
 *   kembali ke user) → VerificationForm.
 */
export default function CameraSection({ user, role }: Props) {
  const [verification, setVerification] = useState<MitraVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setVerification((snap.data()?.verification as MitraVerification | undefined) ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  const manager = canManageCameras(role);

  return (
    <>
      <h1 className="font-serif text-2xl font-medium text-navy sm:text-3xl">Kamera</h1>
      <p className="mt-2 text-sm text-navy-soft">
        {manager
          ? 'Daftarkan dan pantau kamera milikmu'
          : 'Verifikasi akun untuk mendaftarkan kamera'}
      </p>

      <div className="mt-6">
        {manager ? (
          <CameraManager user={user} />
        ) : loading ? (
          <div className="card p-5 animate-pulse space-y-3">
            <div className="h-4 w-2/3 rounded-full bg-shore-100" />
            <div className="h-3 w-1/2 rounded-full bg-shore-100" />
          </div>
        ) : verification?.status === 'pending' ? (
          <div className="card p-6">
            <span className="inline-flex rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn">
              Menunggu Persetujuan
            </span>
            <p className="text-sm text-navy-soft mt-3 leading-relaxed">
              Pengajuan sedang ditinjau admin. Kamu akan bisa menambahkan kamera
              setelah pengajuan disetujui.
            </p>
            <div className="mt-4 space-y-1.5 text-sm text-navy">
              <p><span className="text-navy-soft">Nama:</span> {verification.fullName}</p>
              <p><span className="text-navy-soft">No. HP:</span> {verification.phone}</p>
              <p><span className="text-navy-soft">Instansi:</span> {verification.organization}</p>
            </div>
          </div>
        ) : verification?.status === 'rejected' && !resubmitting ? (
          <div className="card p-6">
            <span className="inline-flex rounded-sm bg-danger-soft px-2.5 py-1 text-2xs font-medium text-danger">
              Pengajuan Ditolak
            </span>
            <p className="text-sm text-navy-soft mt-3 leading-relaxed">
              Pengajuan verifikasimu ditolak admin. Periksa kembali datamu lalu
              ajukan ulang.
            </p>
            <button
              onClick={() => setResubmitting(true)}
              className="btn-primary w-full px-6 py-3 text-sm mt-5"
            >
              Ajukan Ulang
            </button>
          </div>
        ) : (
          <VerificationForm uid={user.uid} initial={verification ?? undefined} />
        )}
      </div>
    </>
  );
}
