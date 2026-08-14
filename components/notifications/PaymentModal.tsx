import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { lineTotal, payBooking, type Booking } from '@/lib/firestore';
import { formatIDR } from '@/lib/format';
import { useLang } from '@/lib/useLang';

const METHODS = [
  { id: 'transfer', labelKey: 'payment.transfer', descKey: 'payment.transferDesc' },
  { id: 'ewallet', labelKey: 'payment.ewallet', descKey: 'payment.ewalletDesc' },
  { id: 'cash', labelKey: 'payment.cash', descKey: 'payment.cashDesc' },
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
  const { t } = useLang();
  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Booking ini tidak bisa dilanjutkan lagi — stoknya sudah habis. */
  const [stuck, setStuck] = useState(false);

  useEffect(() => setMounted(true), []);

  const handlePay = async () => {
    if (!method) return;
    setError(null);
    setPaying(true);
    try {
      await payBooking(booking.id, method);
      setPaid(true);
    } catch (err) {
      // 'full' = stok item ini habis diambil orang lain di antara booking dibuat
      // dan tombol ini ditekan. Sengaja dibedakan: pesan "coba lagi" akan
      // membuat orang menekan tombol yang tidak akan pernah berhasil.
      const penuh = (err as Error | null)?.message === 'full';
      setError(t(penuh ? 'payment.full' : 'payment.failed'));
      setStuck(penuh);
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
            aria-label={t('common.close')}
            className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-navy-soft shadow-md ring-1 ring-shore-200 hover:text-navy transition-colors"
          >
            <CloseIcon />
          </button>

          <div className="card p-6">
            {paid ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-teal-100 text-teal-600">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="font-serif text-xl font-medium text-navy">{t('payment.paid')}</h2>
                <p className="mt-2 text-sm text-navy-soft">
                  {t('payment.thanks', { dest: booking.destinationName })}
                </p>
                <button onClick={onClose} className="btn-primary mt-5 w-full px-4 py-2.5 text-sm">
                  {t('payment.done')}
                </button>
              </div>
            ) : (
              <>
                <span className="text-xs font-semibold text-teal-600">
                  {t('payment.title')}
                </span>
                <h2 className="mt-2 font-serif text-xl font-medium text-navy">{booking.destinationName}</h2>

                {booking.items && booking.items.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {booking.items.map((it, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-navy-soft">
                          {it.label} ×{it.qty}
                          {/* Baris tanpa `hours` = item sekali bayar, dan itu
                              termasuk semua booking yang dibuat sebelum durasi
                              ada. lineTotal yang menangani nilai kosongnya. */}
                          {it.hours ? ` · ${t('booking.hour', { n: String(it.hours) })}` : ''}
                        </span>
                        <span className="font-medium text-navy shrink-0">{formatIDR(lineTotal(it))}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-between rounded-md bg-shore-50 px-4 py-3">
                  <span className="text-sm text-navy-soft">{t('booking.total')}</span>
                  <span className="text-lg font-semibold text-navy">{formatIDR(booking.amount ?? 0)}</span>
                </div>

                <p className="mt-5 text-sm font-semibold text-navy">
                  {t('payment.method')}
                </p>
                <div className="mt-2 space-y-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={clsx(
                        'w-full rounded-md border px-4 py-3 text-left transition-colors',
                        method === m.id ? 'border-teal-400 bg-teal-50/60' : 'border-shore-200 hover:border-shore-300',
                      )}
                    >
                      <p className="text-sm font-medium text-navy">{t(m.labelKey)}</p>
                      <p className="text-2xs text-navy-soft">{t(m.descKey)}</p>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                    {error}
                  </div>
                )}

                {/* Tombol bayar dimatikan permanen kalau stoknya habis — dibiarkan
                    hidup, ia cuma mengundang penekanan yang pasti gagal. */}
                <button
                  onClick={handlePay}
                  disabled={!method || paying || stuck}
                  className="btn-primary mt-5 w-full px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {paying ? t('payment.paying') : t('payment.confirm')}
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
