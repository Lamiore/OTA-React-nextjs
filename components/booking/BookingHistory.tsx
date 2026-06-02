'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import { updateBookingStatus, type Booking as BookingType } from '@/lib/firestore';
import clsx from 'clsx';

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

interface BookingHistoryProps {
  /** 'all' shows every booking (riwayat lengkap); 'active' hides cancelled ones (booking berlangsung). */
  variant?: 'all' | 'active';
}

export default function BookingHistory({ variant = 'all' }: BookingHistoryProps) {
  const router = useRouter();
  const { user } = useAuthState();

  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [payingBooking, setPayingBooking] = useState<BookingType | null>(null);
  const [payingMethod, setPayingMethod] = useState<string | null>(null);
  const [payProcessing, setPayProcessing] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState<BookingType | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user || !db) {
      setLoadingBookings(false);
      return;
    }
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookingType));
      data.sort((a, b) => (b.date > a.date ? 1 : -1));
      setBookings(data);
      setLoadingBookings(false);
    });
    return () => unsub();
  }, [user]);

  const handleCancel = async () => {
    if (!cancellingBooking) return;
    setCancelling(true);
    await updateBookingStatus(cancellingBooking.id, 'cancelled');
    setCancelling(false);
    setCancellingBooking(null);
  };

  const handlePay = async () => {
    if (!payingBooking || !payingMethod) return;
    setPayProcessing(true);
    await new Promise((r) => setTimeout(r, 1800));
    await updateBookingStatus(payingBooking.id, 'confirmed');
    setPayProcessing(false);
    setPayingBooking(null);
    setPayingMethod(null);
  };

  // 'active' hanya menampilkan booking yang masih berlangsung (menunggu + dikonfirmasi)
  const visibleBookings =
    variant === 'active' ? bookings.filter((b) => b.status !== 'cancelled') : bookings;

  return (
    <>
      {/* Cancel modal — di luar semua container */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-shore-50/60 backdrop-blur-lg" onClick={() => !cancelling && setCancellingBooking(null)} />
          <div className="relative flex items-center justify-center h-full p-4">
            <div className="w-full max-w-sm card p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-red-100 mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </div>
              <h2 className="font-serif text-lg font-medium text-navy text-center">Batalkan Booking?</h2>
              <p className="text-[13px] text-navy-soft text-center mt-2">
                Booking untuk <span className="font-medium text-navy">{cancellingBooking.destinationName}</span> pada{' '}
                <span className="font-medium text-navy">
                  {new Date(cancellingBooking.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>{' '}
                akan dibatalkan dan tidak bisa dikembalikan.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setCancellingBooking(null)}
                  disabled={cancelling}
                  className="btn-ghost flex-1 rounded-xl px-4 py-2.5 text-[13px]"
                >
                  Kembali
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 rounded-xl px-4 py-2.5 text-[13px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                >
                  {cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h1 className="font-serif text-2xl font-medium text-navy sm:text-3xl">
        {variant === 'active' ? 'Booking Berlangsung' : 'Riwayat Booking'}
      </h1>
      <p className="mt-2 text-sm text-navy-soft">
        {variant === 'active'
          ? 'Booking yang sedang menunggu atau sudah dikonfirmasi'
          : 'Daftar booking yang pernah kamu buat'}
      </p>

      <div className="mt-6 space-y-3">
        {!user ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">
              <button onClick={() => router.push('/profile')} className="text-teal-600 font-medium hover:text-teal-700">Masuk</button> untuk melihat riwayat booking.
            </p>
          </div>
        ) : loadingBookings ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-shore-100" />
              <div className="h-3 w-1/2 rounded-full bg-shore-100" />
            </div>
          ))
        ) : visibleBookings.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="h-12 w-12 rounded-xl bg-shore-100 flex items-center justify-center mx-auto mb-3 text-navy-soft">
              <CalendarIcon />
            </div>
            <p className="text-sm text-navy-soft">
              {variant === 'active' ? 'Belum ada booking yang berlangsung.' : 'Belum ada booking.'}
            </p>
            <button onClick={() => router.push('/beranda')} className="btn-primary rounded-xl px-5 py-2.5 text-[13px] mt-4">
              Buat Booking
            </button>
          </div>
        ) : (
          <>
            {/* Payment modal */}
            {payingBooking && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/30 backdrop-blur-sm animate-fade-in" onClick={() => !payProcessing && setPayingBooking(null)}>
                <div className="w-full max-w-sm card p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
                  <h2 className="font-serif text-lg font-medium text-navy mb-1">Pilih Pembayaran</h2>
                  <p className="text-[12px] text-navy-soft mb-4">{payingBooking.destinationName} · {payingBooking.guests} orang</p>

                  <div className="space-y-2 mb-5">
                    {[
                      { id: 'qris', label: 'QRIS', desc: 'GoPay, OVO, DANA, dll' },
                      { id: 'bca', label: 'Transfer BCA', desc: 'Virtual Account' },
                      { id: 'bni', label: 'Transfer BNI', desc: 'Virtual Account' },
                      { id: 'mandiri', label: 'Transfer Mandiri', desc: 'Virtual Account' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setPayingMethod(m.id)}
                        className={clsx(
                          'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
                          payingMethod === m.id
                            ? 'border-teal-400 bg-teal-50/50'
                            : 'border-shore-200 hover:border-shore-300'
                        )}
                      >
                        <div className={clsx(
                          'h-4 w-4 rounded-full border-2 shrink-0 transition-all',
                          payingMethod === m.id ? 'border-teal-500 bg-teal-500' : 'border-shore-300'
                        )} />
                        <div>
                          <p className="text-[13px] font-medium text-navy">{m.label}</p>
                          <p className="text-[11px] text-navy-soft">{m.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setPayingBooking(null)}
                      disabled={payProcessing}
                      className="btn-ghost flex-1 rounded-xl px-4 py-2.5 text-[13px]"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handlePay}
                      disabled={!payingMethod || payProcessing}
                      className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-[13px] disabled:opacity-50"
                    >
                      {payProcessing ? 'Memproses...' : 'Bayar Sekarang'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {visibleBookings.map((b) => (
              <div key={b.id} className="card p-5 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-navy">{b.destinationName}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-navy-soft">
                      <span>{new Date(b.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <span>{b.guests} orang</span>
                      <span>{b.phone}</span>
                    </div>
                    {b.notes && (
                      <p className="mt-2 text-[12px] text-navy-soft italic">{b.notes}</p>
                    )}
                  </div>
                  <span className={clsx(
                    'rounded-lg px-2.5 py-1 text-[11px] font-medium shrink-0',
                    b.status === 'confirmed' && 'bg-teal-100 text-teal-700',
                    b.status === 'cancelled' && 'bg-red-100 text-red-600',
                    b.status === 'pending' && 'bg-amber-100 text-amber-700',
                  )}>
                    {b.status === 'confirmed' ? 'Dikonfirmasi' : b.status === 'cancelled' ? 'Dibatalkan' : 'Menunggu'}
                  </span>
                </div>

                {b.status === 'pending' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-shore-200">
                    <button
                      onClick={() => setPayingBooking(b)}
                      className="btn-primary flex-1 rounded-xl px-4 py-2 text-[12px]"
                    >
                      Bayar Sekarang
                    </button>
                    <button
                      onClick={() => setCancellingBooking(b)}
                      className="btn-ghost flex-1 rounded-xl px-4 py-2 text-[12px] hover:border-red-200 hover:text-red-500"
                    >
                      Batalkan
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
