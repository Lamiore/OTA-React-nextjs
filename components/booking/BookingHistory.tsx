'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import { updateBookingStatus, type Booking as BookingType } from '@/lib/firestore';
import TicketModal from '@/components/booking/TicketModal';
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

/** Booking dianggap "lewat" jika tanggalnya sebelum hari ini (waktu lokal). Hari ini masih berlangsung. */
function isPast(b: BookingType) {
  // en-CA menghasilkan format YYYY-MM-DD di zona waktu lokal, sehingga aman dibandingkan string.
  const todayStr = new Date().toLocaleDateString('en-CA');
  return b.date < todayStr;
}

interface BookingHistoryProps {
  /** 'all' shows every booking (riwayat lengkap); 'active' hides cancelled/used/past ones (booking berlangsung). */
  variant?: 'all' | 'active';
}

export default function BookingHistory({ variant = 'all' }: BookingHistoryProps) {
  const router = useRouter();
  const { user } = useAuthState();

  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [cancellingBooking, setCancellingBooking] = useState<BookingType | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [ticketBooking, setTicketBooking] = useState<BookingType | null>(null);

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

  // 'active' hanya menampilkan tiket yang masih berlangsung: belum dibatalkan, belum dipakai, & belum lewat tanggal.
  const visibleBookings =
    variant === 'active'
      ? bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'used' && !isPast(b))
      : bookings;

  return (
    <>
      {/* Ticket modal — di luar semua container */}
      {ticketBooking && (
        <TicketModal booking={ticketBooking} onClose={() => setTicketBooking(null)} />
      )}

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
          ? 'Tiket yang sudah dikonfirmasi dan belum dipakai'
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
            {visibleBookings.map((b) => {
              const used = b.status === 'used';
              const cancelled = b.status === 'cancelled';
              const past = isPast(b);
              // 'pending' (data lama) diperlakukan sama seperti 'confirmed'.
              const activeConfirmed = (b.status === 'confirmed' || b.status === 'pending') && !past;
              return (
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
                      used && 'bg-shore-100 text-navy-soft',
                      cancelled && 'bg-red-100 text-red-600',
                      !used && !cancelled && past && 'bg-shore-100 text-navy-soft',
                      !used && !cancelled && !past && 'bg-teal-100 text-teal-700',
                    )}>
                      {used ? 'Sudah Digunakan' : cancelled ? 'Dibatalkan' : past ? 'Selesai' : 'Dikonfirmasi'}
                    </span>
                  </div>

                  {activeConfirmed && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-shore-200">
                      <button
                        onClick={() => setTicketBooking(b)}
                        className="btn-primary flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[12px]"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                          <path d="M13 5v2" />
                          <path d="M13 17v2" />
                          <path d="M13 11v2" />
                        </svg>
                        Lihat Tiket
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
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
