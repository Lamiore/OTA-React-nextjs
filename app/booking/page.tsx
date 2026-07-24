'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import { createBooking, getPriceItems, type Destination } from '@/lib/firestore';
import { formatIDR } from '@/lib/format';
import TopNav from '@/components/desktop/TopNav';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';
import BookingHistory from '@/components/booking/BookingHistory';

function CheckCircleIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-500">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthState();
  const destId = searchParams.get('dest');
  const preselect = searchParams.get('items');

  const [destination, setDestination] = useState<Destination | null>(null);
  const [loadingDest, setLoadingDest] = useState(!!destId);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    date: '',
    guests: 1,
    name: '',
    phone: '',
    notes: '',
  });

  const [qty, setQty] = useState<Record<string, number>>({});

  const priceItems = destination ? getPriceItems(destination) : [];
  const totalQty = priceItems.reduce((s, it) => s + (qty[it.id] ?? 0), 0);
  const total = priceItems.reduce((s, it) => s + it.price * (qty[it.id] ?? 0), 0);
  const selectedItems = priceItems.filter((it) => (qty[it.id] ?? 0) > 0);

  const setItemQty = (id: string, next: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, next) }));

  // Load destination if destId provided
  useEffect(() => {
    if (!destId || !db) {
      setLoadingDest(false);
      return;
    }
    getDoc(doc(db, 'destinations', destId)).then((snap) => {
      if (snap.exists()) {
        setDestination({ id: snap.id, ...snap.data() } as Destination);
      }
      setLoadingDest(false);
    });
  }, [destId]);

  // Default qty: item yang dibawa dari halaman detail (?items=), atau item
  // pertama (biasanya tiket masuk) bila tidak ada pra-pilihan.
  useEffect(() => {
    if (!destination) return;
    const items = getPriceItems(destination);
    if (items.length === 0) return;
    const preIds = preselect
      ? preselect.split(',').filter((id) => items.some((it) => it.id === id))
      : [];
    if (preIds.length > 0) {
      const entries = preIds.map((id): [string, number] => [id, 1]);
      setQty(Object.fromEntries(entries));
    } else {
      setQty({ [items[0].id]: 1 });
    }
  }, [destination, preselect]);

  // Pre-fill name from auth
  useEffect(() => {
    if (user?.displayName && !form.name) {
      setForm((f) => ({ ...f, name: user.displayName ?? '' }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) {
      router.push('/profile');
      return;
    }
    if (!destination) {
      setError('Pilih destinasi terlebih dahulu.');
      return;
    }
    const items = priceItems
      .filter((it) => (qty[it.id] ?? 0) > 0)
      .map((it) => ({ label: it.label, price: it.price, qty: qty[it.id] ?? 0 }));
    if (items.length === 0) {
      setError('Pilih minimal satu item.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await createBooking({
        userId: user.uid,
        destinationId: destination.id,
        destinationName: destination.name,
        date: form.date,
        guests: form.guests,
        name: form.name,
        phone: form.phone,
        notes: form.notes,
        items,
        amount: total,
      });
      setSuccess(true);
    } catch {
      setError('Gagal membuat booking. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  // Tanpa destinasi terpilih (mis. dari tab Booking) → tampilkan daftar booking yang berlangsung
  if (!destId) {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in">
        <BookingHistory variant="active" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in text-center py-16">
        <div className="card p-8 sm:p-10 flex flex-col items-center gap-4">
          <CheckCircleIcon />
          <h2 className="font-serif text-xl font-medium text-navy">Booking Berhasil!</h2>
          <p className="text-sm text-navy-soft max-w-xs">
            Tiket untuk <span className="font-medium text-navy">{destination?.name}</span> pada
            tanggal <span className="font-medium text-navy">{new Date(form.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span> sudah siap. Buka untuk melihat QR check-in.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => router.push('/booking')}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Lihat Tiket
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setForm({ date: '', guests: 1, name: user?.displayName ?? '', phone: '', notes: '' });
                setQty(priceItems.length > 0 ? { [priceItems[0].id]: 1 } : {});
              }}
              className="btn-ghost px-5 py-2.5 text-sm"
            >
              Booking Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
      <h1 className="section-title">Booking</h1>
      <p className="section-lede">Isi detail untuk memesan perjalanan.</p>

      <form onSubmit={handleSubmit} className="mt-6 lg:grid lg:grid-cols-[1fr_340px] lg:gap-8 lg:items-start">
        {/* KIRI: field-field */}
        <div className="space-y-5">
            {/* Destination info */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-navy-soft">Destinasi</label>
              {loadingDest ? (
                <div className="rounded-md border border-shore-200 bg-surface px-3.5 py-3 animate-pulse">
                  <div className="h-4 w-2/3 rounded-full bg-shore-100" />
                </div>
              ) : destination ? (
                <div className="rounded-md border border-teal-200 bg-teal-50/50 px-4 py-3 flex items-center gap-3">
                  {destination.image ? (
                    <img src={destination.image} alt={destination.name} className="h-10 w-10 rounded-sm object-cover shrink-0" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm font-serif text-lg font-semibold text-white" style={{ background: destination.thumbColor }} aria-hidden="true">{destination.name.trim().charAt(0).toUpperCase()}</span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate capitalize">{destination.name}</p>
                    <p className="text-xs text-navy-soft capitalize">{destination.location}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-shore-200 bg-surface px-4 py-3">
                  <p className="text-sm text-navy-soft">Tidak ada destinasi dipilih. <button type="button" onClick={() => router.push('/beranda#destinasi')} className="text-teal-600 hover:text-teal-700 font-medium">Pilih dari beranda</button></p>
                </div>
              )}
            </div>

            {/* Pilih item harga */}
            {destination && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-soft">Pilih Item *</label>
                {priceItems.length === 0 ? (
                  <div className="rounded-md border border-shore-200 bg-surface px-4 py-3">
                    <p className="text-sm text-navy-soft">Destinasi ini belum punya daftar harga, booking belum bisa dilakukan.</p>
                  </div>
                ) : (
                  <div className="rounded-md border border-shore-200 bg-surface divide-y divide-shore-100">
                    {priceItems.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy truncate capitalize">{it.label}</p>
                          <p className="text-xs text-navy-soft">
                            {formatIDR(it.price)} <span className="text-navy-soft/70">{it.unit}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            aria-label={`Kurangi ${it.label}`}
                            onClick={() => setItemQty(it.id, (qty[it.id] ?? 0) - 1)}
                            className="h-7 w-7 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:text-navy hover:border-shore-300 transition-colors"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-medium text-navy">{qty[it.id] ?? 0}</span>
                          <button
                            type="button"
                            aria-label={`Tambah ${it.label}`}
                            onClick={() => setItemQty(it.id, (qty[it.id] ?? 0) + 1)}
                            className="h-7 w-7 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:text-navy hover:border-shore-300 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Date + Guests */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="booking-date" className="mb-1.5 block text-xs font-medium text-navy-soft">Tanggal *</label>
                <input
                  id="booking-date"
                  type="date"
                  value={form.date}
                  min={today}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="booking-guests" className="mb-1.5 block text-xs font-medium text-navy-soft">Jumlah Orang *</label>
                <input
                  id="booking-guests"
                  type="number"
                  value={form.guests}
                  min={1}
                  max={100}
                  onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })}
                  required
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="booking-name" className="mb-1.5 block text-xs font-medium text-navy-soft">Nama Lengkap *</label>
              <input
                  id="booking-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama pemesan"
                required
                className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="booking-phone" className="mb-1.5 block text-xs font-medium text-navy-soft">No. Telepon *</label>
              <input
                  id="booking-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08xxxxxxxxxx"
                required
                className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="booking-notes" className="mb-1.5 block text-xs font-medium text-navy-soft">Catatan (opsional)</label>
              <textarea
                  id="booking-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Permintaan khusus, alergi, dll..."
                rows={3}
                className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors resize-none"
              />
            </div>

        </div>

        {/* KANAN: ringkasan sticky */}
        <aside className="mt-6 lg:mt-0 lg:sticky lg:top-24">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-navy">Ringkasan</h2>

            {selectedItems.length > 0 ? (
              <div className="space-y-2">
                {selectedItems.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-navy-soft capitalize">
                      {it.label} <span className="text-navy-soft/60">×{qty[it.id] ?? 0}</span>
                    </span>
                    <span className="shrink-0 font-medium text-navy">{formatIDR(it.price * (qty[it.id] ?? 0))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-navy-soft">Belum ada item dipilih.</p>
            )}

            <div className="flex items-center justify-between border-t border-shore-100 pt-3">
              <span className="text-sm text-navy-soft">Estimasi total</span>
              <span className="text-lg font-semibold text-navy">{formatIDR(total)}</span>
            </div>

            {error && (
              <div className="rounded-md bg-danger-soft border border-danger-rule px-4 py-3 text-sm text-danger animate-fade-up">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !destination || totalQty === 0}
              className="btn-primary w-full px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Konfirmasi Booking'}
            </button>

            {!user ? (
              <p className="text-center text-xs text-navy-soft">
                Kamu perlu <button type="button" onClick={() => router.push('/profile')} className="text-teal-600 font-medium hover:text-teal-700">masuk</button> terlebih dahulu untuk booking.
              </p>
            ) : !user.emailVerified ? (
              <p className="text-center text-xs text-navy-soft">
                <button type="button" onClick={() => router.push('/profile')} className="text-teal-600 font-medium hover:text-teal-700">Verifikasi email</button> kamu dulu sebelum booking.
              </p>
            ) : null}
          </div>
        </aside>
      </form>
    </div>
  );
}

export default function Booking() {
  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-28 md:pb-0">
      <TopNav compact />
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <Suspense>
          <BookingContent />
        </Suspense>
      </section>
      <Footer />
      <BottomNav />
    </main>
  );
}
