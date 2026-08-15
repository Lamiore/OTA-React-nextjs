'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import { cancelBooking, type Booking as BookingType } from '@/lib/firestore';
import { itemSummary } from '@/lib/destination';
import { useLang } from '@/lib/useLang';
import TicketModal from '@/components/booking/TicketModal';
import PaymentModal from '@/components/notifications/PaymentModal';
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

/**
 * Booking ini bisa dibuka di formulir ubah?
 *
 * Syaratnya cuma satu: setiap barisnya punya `id` item. Booking yang dibuat
 * sebelum stok per item ada tidak menyimpannya (lihat BookingLine.id), dan
 * tanpa id tidak ada yang bisa dicocokkan ke daftar harga — formulirnya akan
 * terbuka kosong lalu menyimpan booking tanpa isi.
 *
 * Item yang sudah dihapus pengelola TIDAK diperiksa di sini: itu butuh dokumen
 * destinasinya, dan halaman ubah yang memuatnya sudah menolak dengan pesan yang
 * benar. Yang dijaga di sini hanya yang bisa dijawab dari dokumen bookingnya
 * sendiri.
 */
function bisaDiubah(b: BookingType) {
  return (b.items?.length ?? 0) > 0 && (b.items ?? []).every((l) => !!l.id);
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
  const { t, locale } = useLang();

  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  const [cancellingBooking, setCancellingBooking] = useState<BookingType | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [ticketBooking, setTicketBooking] = useState<BookingType | null>(null);
  const [payingBooking, setPayingBooking] = useState<BookingType | null>(null);

  // Portal modal ke <body> agar lepas dari wrapper .animate-fade-in yang menyisakan
  // transform: scale(1) (fill 'both'), yang bikin position:fixed melenceng & ketutup nav.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  // Pembatalan sekarang lewat /api/bookings, jadi bisa gagal karena jaringan
  // atau ditolak server (mis. tiketnya sudah dipakai check-in). Dulu ini
  // write langsung ke Firestore yang praktis selalu "berhasil" — modalnya
  // menutup diri seolah beres padahal belum tentu.
  const handleCancel = async () => {
    if (!cancellingBooking) return;
    setCancelError(null);
    setCancelling(true);
    try {
      await cancelBooking(cancellingBooking.id);
      setCancellingBooking(null);
    } catch (err) {
      const code = (err as Error | null)?.message;
      setCancelError(
        code === 'already-used'
          ? t('history.cancelUsedError')
          : t('history.cancelFailed'),
      );
    } finally {
      setCancelling(false);
    }
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

      {/* Modal bayar — onSnapshot di atas yang menyegarkan kartunya setelah lunas. */}
      {payingBooking && (
        <PaymentModal booking={payingBooking} onClose={() => setPayingBooking(null)} />
      )}

      {/* Cancel modal — di-portal ke <body> (lihat catatan 'mounted' di atas) */}
      {mounted && cancellingBooking && createPortal(
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div className="absolute inset-0 bg-shore-50/60 backdrop-blur-lg" onClick={() => !cancelling && setCancellingBooking(null)} />
          <div className="relative flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-sm card p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-danger-soft mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </div>
              <h2 className="font-serif text-lg font-medium text-navy text-center">{t('history.cancelTitle')}</h2>
              <p className="text-sm text-navy-soft text-center mt-2">
                {t('history.cancelBody', {
                  dest: cancellingBooking.destinationName,
                  date: new Date(cancellingBooking.date).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                })}
              </p>
              {cancelError && (
                <div className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                  {cancelError}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setCancellingBooking(null)}
                  disabled={cancelling}
                  className="btn-ghost flex-1 px-4 py-2.5 text-sm"
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 rounded-md px-4 py-2.5 text-sm font-medium bg-danger text-white hover:bg-danger transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                >
                  {cancelling ? t('history.cancelling') : t('history.cancelConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <h1 className="font-serif text-2xl font-medium text-navy sm:text-3xl">
        {t(variant === 'active' ? 'history.activeTitle' : 'history.title')}
      </h1>
      <p className="mt-2 text-sm text-navy-soft">
        {t(variant === 'active' ? 'history.activeLede' : 'history.allLede')}
      </p>

      <div className="mt-6 space-y-3">
        {!user ? (
          <div className="card p-8 text-center">
            <div className="h-12 w-12 rounded-md bg-shore-100 flex items-center justify-center mx-auto mb-3 text-navy-soft">
              <CalendarIcon />
            </div>
            <p className="text-sm text-navy-soft">{t('history.signInPrompt')}</p>
            <button onClick={() => router.push('/profile')} className="btn-primary px-5 py-2.5 text-sm mt-4">
              {t('nav.login')}
            </button>
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
            <div className="h-12 w-12 rounded-md bg-shore-100 flex items-center justify-center mx-auto mb-3 text-navy-soft">
              <CalendarIcon />
            </div>
            <p className="text-sm text-navy-soft">
              {t(variant === 'active' ? 'history.emptyActive' : 'history.empty')}
            </p>
            <button onClick={() => router.push('/beranda#destinasi')} className="btn-primary px-5 py-2.5 text-sm mt-4">
              {t('history.makeBooking')}
            </button>
          </div>
        ) : (
          <>
            {visibleBookings.map((b) => {
              const used = b.status === 'used';
              const cancelled = b.status === 'cancelled';
              const past = isPast(b);
              // Yang menentukan tiket keluar adalah LUNAS, bukan status.
              // Sebelumnya 'pending' disamakan dengan 'confirmed' di sini —
              // itulah sebabnya QR bisa dilihat tanpa membayar. Sekarang
              // 'pending' artinya menunggu pembayaran.
              const paid = b.paymentStatus === 'paid';
              const unpaid = !paid && !used && !cancelled && !past;
              const activeConfirmed = paid && !used && !cancelled && !past;
              return (
                <div key={b.id} className="card p-5 animate-fade-in">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-navy capitalize">{b.destinationName}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-navy-soft">
                        <span>{new Date(b.date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span>{itemSummary(b.items) || `${b.guests ?? 0} ${t('common.people')}`}</span>
                        <span>{b.phone}</span>
                      </div>
                      {b.notes && (
                        <p className="mt-2 text-xs text-navy-soft italic">{b.notes}</p>
                      )}
                    </div>
                    <span className={clsx(
                      'rounded-sm px-2.5 py-1 text-2xs font-medium shrink-0',
                      used && 'bg-shore-100 text-navy-soft',
                      cancelled && 'bg-danger-soft text-danger',
                      !used && !cancelled && past && 'bg-shore-100 text-navy-soft',
                      unpaid && 'bg-warn-soft text-warn',
                      activeConfirmed && 'bg-teal-100 text-teal-700',
                    )}>
                      {t(
                        used
                          ? 'history.statusUsed'
                          : cancelled
                            ? 'status.cancelled'
                            : past
                              ? 'history.statusDone'
                              : unpaid
                                ? 'status.pending'
                                : 'status.confirmed'
                      )}
                    </span>
                  </div>

                  {unpaid && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-shore-200">
                      <button
                        onClick={() => setPayingBooking(b)}
                        className="btn-primary flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs"
                      >
                        {t('history.payNow')}
                      </button>
                      {/* Ubah hanya muncul kalau isinya memang bisa dipetakan
                          balik ke daftar harga — lihat bisaDiubah di atas.
                          Tombol yang selalu tampil lalu berakhir di layar
                          "tidak bisa diubah" cuma memindahkan kekecewaannya
                          satu klik lebih jauh. */}
                      {bisaDiubah(b) && (
                        <button
                          onClick={() => router.push(`/booking?dest=${encodeURIComponent(b.destinationId)}&edit=${encodeURIComponent(b.id)}`)}
                          className="btn-ghost flex-1 px-4 py-2 text-xs"
                        >
                          {t('history.edit')}
                        </button>
                      )}
                      <button
                        onClick={() => setCancellingBooking(b)}
                        className="btn-ghost flex-1 px-4 py-2 text-xs hover:border-danger-rule hover:text-danger"
                      >
                        {t('history.cancelShort')}
                      </button>
                    </div>
                  )}

                  {activeConfirmed && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-shore-200">
                      <button
                        onClick={() => setTicketBooking(b)}
                        className="btn-primary flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                          <path d="M13 5v2" />
                          <path d="M13 17v2" />
                          <path d="M13 11v2" />
                        </svg>
                        {t('history.viewTicket')}
                      </button>
                      <button
                        onClick={() => setCancellingBooking(b)}
                        className="btn-ghost flex-1 px-4 py-2 text-xs hover:border-danger-rule hover:text-danger"
                      >
                        {t('history.cancelShort')}
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
