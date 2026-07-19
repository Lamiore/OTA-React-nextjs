'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getPriceItems,
  subscribeReviews,
  reviewStats,
  type Destination,
  type Review,
} from '@/lib/firestore';
import TopNav from '@/components/desktop/TopNav';
import BottomNav from '@/components/mobile/BottomNav';
import LiveMonitorPanel from '@/components/destinations/LiveMonitorPanel';
import DestinationReviews, { StarRow } from '@/components/destinations/DestinationReviews';
import { useAuthState } from '@/lib/useAuth';

function ArrowLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export default function DestinationDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthState();
  const [dest, setDest] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const initedForId = useRef<string | null>(null);

  useEffect(() => {
    if (!db || !id) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'destinations', id), (snap) => {
      if (snap.exists()) {
        setDest({ id: snap.id, ...snap.data() } as Destination);
      } else {
        setDest(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeReviews(id, setReviews);
  }, [id]);

  // Pra-pilih item pertama (biasanya tiket masuk) sekali per destinasi saat
  // harga tersedia. Dikunci per id agar update realtime tidak menimpa pilihan
  // user, tapi tetap ter-reset bila berpindah destinasi.
  useEffect(() => {
    if (!dest || initedForId.current === dest.id) return;
    const items = getPriceItems(dest);
    if (items.length === 0) return;
    setSelectedIds([items[0].id]);
    initedForId.current = dest.id;
  }, [dest]);

  if (loading) {
    return (
      <main className="min-h-dvh bg-shore-50">
        <TopNav />
        <div className="mx-auto max-w-4xl animate-pulse space-y-6 px-4 py-10 sm:px-6 lg:px-10">
          <div className="h-64 rounded-2xl bg-shore-100 sm:h-80" />
          <div className="h-6 w-2/3 rounded-full bg-shore-100" />
          <div className="h-4 w-1/3 rounded-full bg-shore-100" />
          <div className="h-20 rounded-xl bg-shore-100" />
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!dest) {
    return (
      <main className="min-h-dvh bg-shore-50">
        <TopNav />
        <div className="flex flex-col items-center justify-center gap-4 py-32">
          <p className="text-sm text-navy-soft">Destinasi tidak ditemukan.</p>
          <button onClick={() => router.push('/beranda')} className="btn-primary rounded-xl px-5 py-2.5 text-[13px]">
            Kembali ke Beranda
          </button>
        </div>
        <BottomNav />
      </main>
    );
  }

  const priceItems = getPriceItems(dest);
  const { avg, count } = reviewStats(reviews);

  const toggleItem = (itemId: string) =>
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    );

  const goToBooking = () => {
    if (!user) {
      router.push('/profile');
      return;
    }
    const params = new URLSearchParams({ dest: dest.id });
    if (selectedIds.length > 0) params.set('items', selectedIds.join(','));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <main className="min-h-dvh bg-shore-50 pb-28 md:pb-0">
      <TopNav />

      {/* Hero immersive — foto full-bleed, scrim laut-dalam, judul di-overlay. */}
      <section className="grain relative h-[58vh] min-h-[400px] w-full overflow-hidden">
        {dest.image ? (
          <img src={dest.image} alt={dest.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: dest.thumbColor }}>
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(120% 90% at 20% -10%, rgba(255,255,255,0.35), transparent 60%)' }}
            />
            <div className="flex h-full items-center justify-center">
              <span className="text-8xl drop-shadow-[0_16px_28px_rgba(15,43,60,0.45)]">{dest.emoji}</span>
            </div>
          </div>
        )}
        {/* Scrim kedalaman — dibangun di token `ink` yang selalu gelap. */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/25 via-ink/40 to-ink/90" />
        <div className="absolute inset-0 bg-gradient-to-tr from-ink/70 via-transparent to-transparent" />

        {/* Back button */}
        <div className="absolute inset-x-0 top-0 z-10">
          <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6 lg:px-10">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-ink/40 px-3.5 py-2 text-[13px] font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-ink/60"
            >
              <ArrowLeftIcon />
              Kembali
            </button>
          </div>
        </div>

        {/* Judul + lokasi + rating */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-10">
            <h1 className="animate-fade-up font-serif text-4xl font-medium capitalize leading-[1.03] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {dest.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-white/80">
                <PinIcon />
                <span className="capitalize">{dest.location}</span>
              </span>
              {count > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <StarRow value={avg} size={15} />
                  <span className="text-[13px] font-semibold text-white">{avg.toFixed(1)}</span>
                  <span className="text-[12px] text-white/60">· {count} ulasan</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sheet konten naik di atas foto. */}
      <div className="relative z-10 -mt-6 rounded-t-[2rem] bg-shore-50">
        <article className="mx-auto max-w-4xl animate-fade-in px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          <div className="space-y-5">
            {/* Tags */}
            {dest.tags?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {dest.tags.map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>
            )}

            {/* Description */}
            {dest.description && (
              <div className="card p-5 sm:p-6">
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-navy-soft">Tentang</h2>
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-navy">{dest.description}</p>
              </div>
            )}

            {/* Daftar Harga + Booking — tiap item kartu berdiri sendiri (seperti beranda) */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-navy-soft">Daftar Harga</h2>
              {priceItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {priceItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        aria-pressed={isSelected}
                        className={`flex flex-col rounded-2xl border p-4 text-left shadow-soft transition-all ${
                          isSelected
                            ? 'border-teal-400 bg-teal-50 shadow-glow'
                            : 'border-shore-200 bg-surface hover:border-shore-300 hover:shadow-lift'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[14px] font-semibold capitalize leading-snug text-navy">{item.label}</h3>
                          <span
                            className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors ${
                              isSelected ? 'border-teal-500 bg-teal-500 text-white' : 'border-shore-300 bg-surface'
                            }`}
                          >
                            {isSelected && <CheckIcon />}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-navy-soft">
                            {item.description}
                          </p>
                        )}
                        <p className="mt-auto pt-3 text-[15px] font-semibold text-navy">
                          {formatRp(item.price)}
                          <span className="text-[12px] font-normal text-navy-soft"> {item.unit}</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-5">
                  <p className="text-[13px] text-navy-soft">Belum ada daftar harga untuk destinasi ini.</p>
                </div>
              )}
              <button
                onClick={goToBooking}
                disabled={priceItems.length > 0 && selectedIds.length === 0}
                className="btn-primary w-full rounded-xl px-6 py-3 text-[14px] disabled:opacity-50"
              >
                {priceItems.length > 0
                  ? selectedIds.length > 0
                    ? `Booking Sekarang · ${selectedIds.length} item`
                    : 'Pilih item dulu'
                  : 'Booking Sekarang'}
              </button>
            </div>

            {/* Pantau langsung — kamera (kalau di-link) + sensor IoT dalam satu card */}
            {(dest.cameraStreamId || dest.cameraStreamUrl || dest.hasMonitoring) && (
              <LiveMonitorPanel
                cameraStreamId={dest.cameraStreamId}
                cameraStreamUrl={dest.cameraStreamUrl}
                cameraName={dest.cameraName}
                hasMonitoring={!!dest.hasMonitoring}
              />
            )}

            {/* Ulasan pengunjung */}
            <DestinationReviews destinationId={dest.id} reviews={reviews} />
          </div>
        </article>
      </div>

      <BottomNav />
    </main>
  );
}
