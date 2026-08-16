import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Booking } from '@/lib/firestore';
import { itemSummary } from '@/lib/destination';
import { useLang } from '@/lib/useLang';

/** Kode tiket yang ditampilkan ke user, diturunkan dari ID booking. */
function ticketCode(id: string) {
  return 'OTA-' + id.slice(0, 8).toUpperCase();
}

/** Payload yang di-encode ke QR — cukup untuk verifikasi check-in manual. */
function qrPayload(b: Booking) {
  return `OTA-TICKET|${b.id}|${b.destinationName}|${b.date}`;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-navy">{label}</p>
      {/* break-words, bukan truncate: rincian item ("Tiket Masuk ×2 · Sewa
          Alat ×1") lebih panjang dari satu baris sel, dan yang terpotong di
          tiket justru bagian yang diperiksa petugas. */}
      <p className="mt-0.5 break-words text-sm font-medium text-navy">{value}</p>
    </div>
  );
}

interface TicketModalProps {
  booking: Booking;
  onClose: () => void;
}

export default function TicketModal({ booking, onClose }: TicketModalProps) {
  // Portal ke <body> agar lepas dari ancestor ber-transform (mis. wrapper .animate-fade-in
  // yang menyisakan transform: scale(1) karena fill-mode 'both'), yang kalau tidak membuat
  // position:fixed jadi relatif ke wrapper, bukan viewport — modal melenceng & ketutup nav.
  const { t, locale } = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dateLabel = new Date(booking.date).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Syarat tiket adalah LUNAS, bukan status booking. Booking dibuat server
  // dengan status 'pending' + 'unpaid', dan naik ke 'confirmed' hanya lewat
  // cabang pembayaran di /api/bookings — jadi satu pengecekan ini yang
  // menentukan QR terbit atau tidak.
  const paid = booking.paymentStatus === 'paid';

  if (!mounted) return null;

  return createPortal(
    // overflow-y-auto + wrapper min-h-full menjaga tiket tetap center; kalau lebih tinggi
    // dari layar, ia bisa di-scroll penuh alih-alih bagian atasnya terpotong di balik nav.
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-ink/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-sm animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label={t('ticket.closeLabel')}
          className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-navy-soft shadow-md ring-1 ring-shore-200 hover:text-navy transition-colors"
        >
          <CloseIcon />
        </button>

        <div className="card overflow-hidden p-0">
          {/* Bagian atas — info tiket */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-600">
                {t('ticket.brand')}
              </span>
              <span className={paid
                ? 'rounded-sm bg-teal-100 px-2.5 py-1 text-2xs font-medium text-teal-700'
                : 'rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn'}>
                {t(paid ? 'status.confirmed' : 'status.pending')}
              </span>
            </div>

            <h2 className="mt-4 font-serif text-2xl font-medium leading-tight text-navy">
              {booking.destinationName}
            </h2>
            <p className="mt-1 text-xs text-navy-soft">{dateLabel}</p>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
              <Detail label={t('ticket.holder')} value={booking.name} />
              {/* Rincian item menggantikan "jumlah orang". Booking lama yang
                  belum punya items tetap menampilkan angka lamanya. */}
              <Detail
                label={itemSummary(booking.items) ? t('ticket.items') : t('ticket.guests')}
                value={itemSummary(booking.items) || `${booking.guests ?? 0} ${t('common.people')}`}
              />
              <Detail label={t('ticket.phone')} value={booking.phone} />
              <Detail label={t('ticket.code')} value={ticketCode(booking.id)} />
            </div>
          </div>

          {/* Garis sobek (perforasi) */}
          <div className="relative">
            <div className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-shore-50" />
            <div className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-shore-50" />
            <div className="mx-5 border-t-2 border-dashed border-shore-200" />
          </div>

          {/* Bagian bawah — QR, hanya bila sudah lunas */}
          <div className="flex flex-col items-center gap-3 p-6">
            {paid ? (
              <>
                {/* QR selalu hitam-di-putih + padding (quiet zone) agar tetap ter-scan di dark mode */}
                <div className="rounded-md bg-white p-3 shadow-sm ring-1 ring-shore-200">
                  <QRCodeSVG value={qrPayload(booking)} size={160} level="M" />
                </div>
                <p className="font-mono text-base font-semibold tracking-[0.15em] text-navy">
                  {ticketCode(booking.id)}
                </p>
                <p className="text-center text-xs text-navy-soft">
                  {t('ticket.showQr')}
                </p>
              </>
            ) : (
              <>
                {/* Kotak seukuran QR supaya tinggi kartunya tidak melompat saat lunas. */}
                <div className="flex h-[186px] w-[186px] items-center justify-center rounded-md border border-dashed border-shore-300 bg-shore-50 text-navy-soft">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-navy">{t('ticket.lockedTitle')}</p>
                <p className="text-center text-xs text-navy-soft">
                  {t('ticket.lockedBody')}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
