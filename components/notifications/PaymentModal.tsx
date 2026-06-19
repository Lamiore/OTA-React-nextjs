import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { payBooking, type Booking } from '@/lib/firestore';
import { formatIDR } from '@/lib/format';

const METHODS = [
  { id: 'transfer', label: 'Transfer Bank', desc: 'BCA / Mandiri / BNI' },
  { id: 'ewallet', label: 'E-wallet', desc: 'GoPay / OVO / DANA' },
  { id: 'cash', label: 'Tunai di lokasi', desc: 'Bayar langsung ke petugas' },
];

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

interface PaymentModalProps {
  booking: Booking;
  onClose: () => void;
}

export default function PaymentModal({ booking, onClose }: PaymentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const handlePay = async () => {
    if (!method) return;
    setError(null);
    setPaying(true);
    try {
      await payBooking(booking.id, method);
      setPaid(true);
    } catch {
      setError('Gagal memproses pembayaran. Coba lagi.');
    } finally {
      setPaying(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-ink/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-sm animate-fade-up" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-navy-soft shadow-md ring-1 ring-shore-200 hover:text-navy transition-colors"
          >
            <CloseIcon />
          </button>

          <div className="card p-6">
            {paid ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="font-serif text-xl font-medium text-navy">Pembayaran Berhasil</h2>
                <p className="mt-2 text-[13px] text-navy-soft">
                  Terima kasih. Pembayaran untuk {booking.destinationName} sudah tercatat.
                </p>
                <button onClick={onClose} className="btn-primary mt-5 w-full rounded-xl px-4 py-2.5 text-[13px]">
                  Selesai
                </button>
              </div>
            ) : (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-600">
                  Pembayaran
                </span>
                <h2 className="mt-2 font-serif text-xl font-medium text-navy">{booking.destinationName}</h2>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-shore-50 px-4 py-3">
                  <span className="text-[13px] text-navy-soft">Total</span>
                  <span className="text-lg font-semibold text-navy">{formatIDR(booking.amount ?? 0)}</span>
                </div>

                <p className="mt-5 text-[11px] font-medium uppercase tracking-wider text-navy-soft">
                  Metode Pembayaran
                </p>
                <div className="mt-2 space-y-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={clsx(
                        'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                        method === m.id ? 'border-teal-400 bg-teal-50/60' : 'border-shore-200 hover:border-shore-300',
                      )}
                    >
                      <p className="text-[13px] font-medium text-navy">{m.label}</p>
                      <p className="text-[11px] text-navy-soft">{m.desc}</p>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 rounded-xl bg-red-100 px-3 py-2 text-[13px] font-medium text-red-600">
                    {error}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={!method || paying}
                  className="btn-primary mt-5 w-full rounded-xl px-4 py-2.5 text-[13px] disabled:opacity-50"
                >
                  {paying ? 'Memproses…' : 'Konfirmasi Pembayaran'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
