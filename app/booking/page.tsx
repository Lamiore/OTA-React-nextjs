'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import { createBooking, type Destination } from '@/lib/firestore';
import TopNav from '@/components/desktop/TopNav';
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

  // Pre-fill name from auth
  useEffect(() => {
    if (user?.displayName && !form.name) {
      setForm((f) => ({ ...f, name: user.displayName ?? '' }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/profile');
      return;
    }
    if (!destination) {
      setError('Pilih destinasi terlebih dahulu.');
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
          <p className="text-[13px] text-navy-soft max-w-xs">
            Tiket untuk <span className="font-medium text-navy">{destination?.name}</span> pada
            tanggal <span className="font-medium text-navy">{new Date(form.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span> sudah siap. Buka untuk melihat QR check-in.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => router.push('/booking')}
              className="btn-primary rounded-xl px-5 py-2.5 text-[13px]"
            >
              Lihat Tiket
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setForm({ date: '', guests: 1, name: user?.displayName ?? '', phone: '', notes: '' });
              }}
              className="btn-ghost rounded-xl px-5 py-2.5 text-[13px]"
            >
              Booking Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto animate-fade-in">
          <h1 className="font-serif text-2xl font-medium text-navy sm:text-3xl">Booking</h1>
          <p className="mt-2 text-sm text-navy-soft">Isi detail untuk memesan perjalanan</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Destination info */}
            <div>
              <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Destinasi</label>
              {loadingDest ? (
                <div className="rounded-xl border border-shore-200 bg-surface px-3.5 py-3 animate-pulse">
                  <div className="h-4 w-2/3 rounded-full bg-shore-100" />
                </div>
              ) : destination ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3 flex items-center gap-3">
                  {destination.image ? (
                    <img src={destination.image} alt={destination.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className="text-2xl shrink-0">{destination.emoji}</span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-navy truncate">{destination.name}</p>
                    <p className="text-[12px] text-navy-soft">{destination.location}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-shore-200 bg-surface px-4 py-3">
                  <p className="text-[13px] text-navy-soft">Tidak ada destinasi dipilih. <button type="button" onClick={() => router.push('/beranda')} className="text-teal-600 hover:text-teal-700 font-medium">Pilih dari beranda</button></p>
                </div>
              )}
            </div>

            {/* Date + Guests */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Tanggal *</label>
                <input
                  type="date"
                  value={form.date}
                  min={today}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Jumlah Orang *</label>
                <input
                  type="number"
                  value={form.guests}
                  min={1}
                  max={100}
                  onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })}
                  required
                  className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Nama Lengkap *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama pemesan"
                required
                className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">No. Telepon *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08xxxxxxxxxx"
                required
                className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Catatan (opsional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Permintaan khusus, alergi, dll..."
                rows={3}
                className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors resize-none"
              />
            </div>

            {/* Price estimate */}
            {destination && (
              <div className="card p-4 flex items-center justify-between">
                <p className="text-[13px] text-navy-soft">Estimasi total</p>
                <p className="text-lg font-semibold text-navy">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(destination.priceStart * form.guests)}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-red-600 animate-fade-up">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !destination}
              className="btn-primary w-full rounded-xl px-4 py-3 text-[14px] font-medium shadow-glow disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Konfirmasi Booking'}
            </button>

            {!user && (
              <p className="text-center text-[12px] text-navy-soft">
                Kamu perlu <button type="button" onClick={() => router.push('/profile')} className="text-teal-600 font-medium hover:text-teal-700">masuk</button> terlebih dahulu untuk booking.
              </p>
            )}
          </form>
    </div>
  );
}

export default function Booking() {
  return (
    <main className="min-h-dvh bg-shore-50 pb-28 md:pb-0">
      <TopNav />
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16">
        <Suspense>
          <BookingContent />
        </Suspense>
      </section>
      <BottomNav />
    </main>
  );
}
