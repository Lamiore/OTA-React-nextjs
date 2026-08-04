'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';
import type { UserRole } from '@/lib/useAuth';
import { requestedRole, type MitraVerification } from '@/lib/firestore';
import { packageRecipient } from '@/lib/verification';
import { useLang } from '@/lib/useLang';
import VerificationForm from '@/components/cameras/VerificationForm';

/**
 * Pengajuan jadi pengelola dari Pengaturan. Alur & penyimpanannya sama dengan
 * verifikasi mitra di halaman Kamera (users/{uid}.verification), dibedakan oleh
 * `requestedRole`; admin menyetujui dari dashboard Pengguna.
 */
export default function PengelolaRequest({
  user,
  role,
}: {
  user: User;
  role: UserRole | null;
}) {
  const { t } = useLang();
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

  // Sudah pengelola/admin — tidak ada yang perlu diajukan.
  if (role === 'pengelola' || role === 'admin') return null;

  const pending = verification?.status === 'pending';
  const forPengelola = verification ? requestedRole(verification) === 'pengelola' : false;

  const wrap = (children: React.ReactNode) => (
    <div className="card overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-shore-200/80">
        <h2 className="font-serif text-lg font-medium text-navy">{t('manager.title')}</h2>
        <p className="text-2xs text-navy-soft mt-0.5">{t('manager.subtitle')}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );

  if (loading) {
    return wrap(
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-2/3 rounded-full bg-shore-100" />
        <div className="h-3 w-1/2 rounded-full bg-shore-100" />
      </div>
    );
  }

  // Pengajuan mitra masih ditinjau — jangan sampai tertimpa pengajuan pengelola.
  if (pending && !forPengelola) {
    return wrap(
      <>
        <span className="inline-flex rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn">
          {t('manager.requestOngoing')}
        </span>
        <p className="text-sm text-navy-soft mt-3 leading-relaxed">
          {t('manager.mitraPendingNote')}
        </p>
      </>
    );
  }

  if (pending && forPengelola) {
    return wrap(
      <>
        <span className="inline-flex rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn">
          {t('verify.awaitingApproval')}
        </span>
        <p className="text-sm text-navy-soft mt-3 leading-relaxed">
          {t('manager.pendingNote')}
        </p>
        <div className="mt-4 space-y-1.5 text-sm text-navy">
          <p><span className="text-navy-soft">{t('verify.nameLabel')}</span> {verification!.fullName}</p>
          <p><span className="text-navy-soft">{t('verify.phoneLabel')}</span> {verification!.phone}</p>
          <p><span className="text-navy-soft">{t('verify.orgLabel')}</span> {verification!.organization}</p>
          {verification!.destination && (
            <p>
              <span className="text-navy-soft">{t('verify.destLabel')}</span> {verification!.destination}
            </p>
          )}
        </div>
        {verification!.shippingAddress && (
          <div className="mt-4 rounded-md border border-shore-200 bg-shore-50/60 p-4">
            <h3 className="text-xs font-medium text-navy">{t('verify.shipTo')}</h3>
            <p className="text-sm text-navy mt-1.5 leading-relaxed">
              {verification!.shippingAddress}
              {verification!.postalCode && ` ${verification!.postalCode}`}
            </p>
            <p className="text-2xs text-navy-soft mt-2">
              {t('verify.recipient')} {packageRecipient(verification!).name} ·{' '}
              {packageRecipient(verification!).phone}
            </p>
            <p className="text-2xs text-navy-soft mt-2 leading-relaxed">
              {t('verify.wrongAddress')}
            </p>
          </div>
        )}
      </>
    );
  }

  if (verification?.status === 'rejected' && forPengelola && !resubmitting) {
    return wrap(
      <>
        <span className="inline-flex rounded-sm bg-danger-soft px-2.5 py-1 text-2xs font-medium text-danger">
          {t('verify.rejected')}
        </span>
        <p className="text-sm text-navy-soft mt-3 leading-relaxed">
          {t('manager.rejectedNote')}
        </p>
        <button
          onClick={() => setResubmitting(true)}
          className="btn-primary w-full px-6 py-3 text-sm mt-5"
        >
          {t('verify.resubmit')}
        </button>
      </>
    );
  }

  return (
    <div className="mb-4">
      <VerificationForm
        uid={user.uid}
        initial={verification ?? undefined}
        requestedRole="pengelola"
        title={t('manager.title')}
        description={t('manager.formDesc')}
      />
    </div>
  );
}
