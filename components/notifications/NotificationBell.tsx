'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import type { Booking } from '@/lib/firestore';
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
  const [unpaid, setUnpaid] = useState<Booking[]>([]);
  const [open, setOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Booking | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !db) {
      setUnpaid([]);
      return;
    }
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Booking))
        .filter((b) => b.status === 'used' && b.paymentStatus === 'unpaid');
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

  const count = unpaid.length;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifikasi"
        className={clsx(
          'relative',
          variant === 'light'
            ? 'rounded-full border border-shore-200 bg-surface/70 p-2 text-navy-soft transition-all duration-200 hover:border-shore-300 hover:text-navy'
            : 'text-white',
        )}
      >
        <BellIcon />
        {count > 0 && (
          <span
            className={clsx(
              'absolute flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white bg-teal-500',
              variant === 'light' ? '-right-1 -top-1 border-2 border-white' : '-right-1.5 -top-1.5 border-2 border-navy',
            )}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-shore-200 bg-surface p-2 shadow-soft">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-navy-soft">
            Notifikasi
          </p>
          {count === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-navy-soft">Tidak ada notifikasi.</p>
          ) : (
            <div className="space-y-1">
              {unpaid.map((b) => (
                <div key={b.id} className="rounded-xl px-3 py-2.5 hover:bg-shore-50">
                  <p className="text-[13px] font-medium text-navy">Check-in berhasil</p>
                  <p className="mt-0.5 text-[12px] text-navy-soft">
                    Silakan selesaikan pembayaran untuk {b.destinationName}.
                  </p>
                  <button
                    onClick={() => {
                      setPayTarget(b);
                      setOpen(false);
                    }}
                    className="btn-primary mt-2 rounded-lg px-3 py-1.5 text-[12px]"
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
