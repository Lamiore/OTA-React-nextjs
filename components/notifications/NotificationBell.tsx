'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { collection, doc, query, where, onSnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import type { Booking } from '@/lib/firestore';
import { kelengkapanProfil } from '@/lib/profile';
import { formatIDR } from '@/lib/format';
import { useLang } from '@/lib/useLang';
import PaymentModal from '@/components/notifications/PaymentModal';

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

interface NotificationBellProps {
  variant: 'light' | 'dark';
}

export default function NotificationBell({ variant }: NotificationBellProps) {
  const { user } = useAuthState();
  const { t } = useLang();
  const [unpaid, setUnpaid] = useState<Booking[]>([]);
  const [open, setOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Booking | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /**
   * Kelengkapan profil. onSnapshot, bukan sekali baca: begitu profilnya
   * disimpan di tab Profil, peringatan ini harus hilang dari navbar saat itu
   * juga — bukan setelah halaman dimuat ulang.
   */
  const [profil, setProfil] = useState<{ phone?: string; city?: string; nik?: string } | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setProfil(null);
      return;
    }
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfil(snap.data() ?? {});
    });
  }, [user]);

  useEffect(() => {
    if (!user || !db) {
      setUnpaid([]);
      return;
    }
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Booking))
        // Dulu: tiket yang sudah di-scan tapi belum dibayar (bayar di lokasi
        // setelah masuk). Kombinasi itu sekarang mustahil — check-in menolak
        // tiket yang belum lunas — jadi lonceng ini akan diam selamanya kalau
        // filternya dibiarkan. Diarahkan ulang ke arah yang benar sekarang:
        // booking yang menunggu pembayaran, sebelum tiketnya terbit.
        .filter((b) => b.status === 'pending' && b.paymentStatus !== 'paid');
      setUnpaid(list);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user) return null;

  const lengkap = kelengkapanProfil({
    name: user.displayName,
    phone: profil?.phone,
    city: profil?.city,
    nik: profil?.nik,
    emailVerified: user.emailVerified,
  });
  // profil masih null = dokumennya belum termuat. Menghitungnya sebagai "belum
  // lengkap" akan mengedipkan peringatan 50% di setiap muat halaman, termasuk
  // untuk profil yang sebenarnya sudah penuh.
  const belumLengkap = profil !== null && lengkap.kurang > 0;

  const count = unpaid.length + (belumLengkap ? 1 : 0);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notif.label')}
        className={clsx(
          'relative',
          variant === 'light'
            ? 'rounded-full border border-shore-200 bg-surface/70 p-2 text-navy-soft transition-colors duration-micro hover:border-shore-300 hover:text-navy'
            : 'text-white',
        )}
      >
        <BellIcon />
        {count > 0 && (
          <span
            className={clsx(
              'absolute flex h-4 min-w-[16px] items-center justify-center rounded-xs px-1 text-2xs font-semibold text-white bg-teal-500',
              variant === 'light' ? '-right-1 -top-1 border-2 border-white' : '-right-1.5 -top-1.5 border-2 border-navy',
            )}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border border-shore-200 bg-surface p-2 shadow-float">
          <p className="px-3 py-2 text-xs font-semibold text-navy-soft">
            Notifikasi
          </p>
          {count === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-navy-soft">{t('notif.empty')}</p>
          ) : (
            <div className="space-y-1">
              {belumLengkap && (
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 hover:bg-shore-50"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{t('complete.title')}</p>
                    <p className="text-xs font-semibold text-navy">{lengkap.persen}%</p>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-shore-200">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all duration-long"
                      style={{ width: `${lengkap.persen}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-navy-soft">
                    {t('complete.notif', { n: lengkap.kurang })}
                  </p>
                </Link>
              )}
              {unpaid.map((b) => (
                <div key={b.id} className="rounded-md px-3 py-2.5 hover:bg-shore-50">
                  <p className="text-sm font-medium text-navy">{t('notif.checkinOk')}</p>
                  <p className="mt-0.5 text-xs text-navy-soft">
                    Selesaikan pembayaran {b.destinationName} untuk menerbitkan tiket QR.
                  </p>
                  <p className="mt-1 text-xs font-semibold text-navy">{formatIDR(b.amount ?? 0)}</p>
                  <button
                    onClick={() => {
                      setPayTarget(b);
                      setOpen(false);
                    }}
                    className="btn-primary mt-2 px-3 py-1.5 text-xs"
                  >
                    Bayar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {payTarget && <PaymentModal booking={payTarget} onClose={() => setPayTarget(null)} />}
    </div>
  );
}
