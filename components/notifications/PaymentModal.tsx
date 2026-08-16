import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { lineTotal, payBooking, type Booking } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { formatIDR } from '@/lib/format';
import { useLang } from '@/lib/useLang';

/** Yang dipasang snap.js ke window. Hanya bagian yang dipakai di sini. */
declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        opts: {
          onSuccess?: () => void;
          onPending?: () => void;
          onError?: () => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

/**
 * Muat snap.js sekali saja, dari alamat yang DIKIRIM SERVER bersama tokennya.
 *
 * Bukan dari env NEXT_PUBLIC_ di sini: kalau alamat skrip dan token berasal
 * dari dua sumber, popup produksi bisa termuat untuk token sandbox dan
 * gagalnya baru kelihatan sebagai "token tidak dikenal".
 */
function muatSnap(src: string, clientKey: string): Promise<void> {
  const ada = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (ada) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-client-key', clientKey);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('snap-load-failed'));
    document.head.appendChild(s);
  });
}

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
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Popup pernah dibuka lalu ditutup tanpa selesai — QR-nya masih hidup. */
  const [menunggu, setMenunggu] = useState(false);
  /** Booking ini tidak bisa dilanjutkan lagi — stoknya sudah habis. */
  const [stuck, setStuck] = useState(false);

  useEffect(() => setMounted(true), []);

  /**
   * Sumber kebenaran layar "Lunas" — dokumen bookingnya, bukan callback Snap.
   *
   * onSuccess berjalan di browser pembeli dan bisa dipanggil siapa saja dari
   * console. Yang menulis 'paid' cuma webhook, jadi di sinilah kabarnya
   * ditunggu: begitu webhook menulis, listener ini menyalakan layar berhasil
   * tanpa polling sama sekali.
   */
  const sudahLunas = useRef(false);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, 'bookings', booking.id), (snap) => {
      if (snap.data()?.paymentStatus !== 'paid' || sudahLunas.current) return;
      sudahLunas.current = true;
      setPaid(true);
      setMenunggu(false);
      setError(null);
    });
  }, [booking.id]);

  const handlePay = async () => {
    setError(null);
    setPaying(true);
    try {
      const { token, snapUrl } = await payBooking(booking.id);
      await muatSnap(snapUrl, process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '');
      if (!window.snap) throw new Error('snap-load-failed');
      window.snap.pay(token, {
        // Sengaja TIDAK setPaid di sini — lihat catatan pada listener di atas.
        // Yang ditampilkan cuma "sedang ditunggu"; layar berhasilnya menyusul
        // sendiri begitu webhook masuk, biasanya dalam hitungan detik.
        onSuccess: () => setMenunggu(true),
        onPending: () => setMenunggu(true),
        onClose: () => setMenunggu(true),
        onError: () => setError(t('payment.failed')),
      });
    } catch (err) {
      // 'full' = stok item ini habis diambil orang lain di antara booking dibuat
      // dan tombol ini ditekan. Sengaja dibedakan: pesan "coba lagi" akan
      // membuat orang menekan tombol yang tidak akan pernah berhasil.
      const sebab = (err as Error | null)?.message;
      const penuh = sebab === 'full';
      setError(
        penuh
          ? t('payment.full')
          : sebab === 'gateway-error'
            ? t('payment.gatewayError')
            : t('payment.failed'),
      );
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

                <div className="mt-5 rounded-md border border-shore-200 px-4 py-3">
                  <p className="text-sm font-medium text-navy">{t('payment.qris')}</p>
                  <p className="text-2xs text-navy-soft">{t('payment.qrisDesc')}</p>
                </div>

                {menunggu && !error && (
                  <div className="mt-4 rounded-md bg-shore-50 px-3 py-2 text-sm text-navy-soft">
                    {t('payment.waiting')}
                  </div>
                )}

                {error && (
                  <div className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                    {error}
                  </div>
                )}

                {/* Tombol bayar dimatikan permanen kalau stoknya habis — dibiarkan
                    hidup, ia cuma mengundang penekanan yang pasti gagal. */}
                <button
                  onClick={handlePay}
                  disabled={paying || stuck}
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
