import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Booking } from '@/lib/firestore';

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
      <p className="text-[10px] font-medium uppercase tracking-wider text-navy-soft">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-navy">{value}</p>
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dateLabel = new Date(booking.date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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
          aria-label="Tutup tiket"
          className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-navy-soft shadow-md ring-1 ring-shore-200 hover:text-navy transition-colors"
        >
          <CloseIcon />
        </button>

        <div className="card overflow-hidden p-0">
          {/* Bagian atas — info tiket */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-600">
                OTA · Tiket Wisata
              </span>
              <span className="rounded-lg bg-teal-100 px-2.5 py-1 text-[11px] font-medium text-teal-700">
                Dikonfirmasi
              </span>
            </div>

            <h2 className="mt-4 font-serif text-2xl font-medium leading-tight text-navy">
              {booking.destinationName}
            </h2>
            <p className="mt-1 text-[12px] text-navy-soft">{dateLabel}</p>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
              <Detail label="Pemesan" value={booking.name} />
              <Detail label="Jumlah" value={`${booking.guests} orang`} />
              <Detail label="Telepon" value={booking.phone} />
              <Detail label="Kode Tiket" value={ticketCode(booking.id)} />
            </div>
          </div>

          {/* Garis sobek (perforasi) */}
          <div className="relative">
            <div className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-shore-50" />
            <div className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-shore-50" />
            <div className="mx-5 border-t-2 border-dashed border-shore-200" />
          </div>

          {/* Bagian bawah — QR */}
          <div className="flex flex-col items-center gap-3 p-6">
            {/* QR selalu hitam-di-putih + padding (quiet zone) agar tetap ter-scan di dark mode */}
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-shore-200">
              <QRCodeSVG value={qrPayload(booking)} size={160} level="M" />
            </div>
            <p className="font-mono text-[15px] font-semibold tracking-[0.15em] text-navy">
              {ticketCode(booking.id)}
            </p>
            <p className="text-center text-[12px] text-navy-soft">
              Tunjukkan QR ini kepada petugas saat check-in.
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
