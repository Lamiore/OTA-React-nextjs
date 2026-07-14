'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPriceItems, type Destination } from '@/lib/firestore';
import TopNav from '@/components/desktop/TopNav';
import BottomNav from '@/components/mobile/BottomNav';
import LiveMonitorSection from '@/components/destinations/LiveMonitorSection';
import DestinationCameraSection from '@/components/destinations/DestinationCameraSection';

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
  const [dest, setDest] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
        <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-10 animate-pulse space-y-6">
          <div className="h-64 sm:h-80 rounded-2xl bg-shore-100" />
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
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-navy-soft text-sm">Destinasi tidak ditemukan.</p>
          <button onClick={() => router.push('/beranda')} className="btn-primary rounded-xl px-5 py-2.5 text-[13px]">
            Kembali ke Beranda
          </button>
        </div>
        <BottomNav />
      </main>
    );
  }

  const priceItems = getPriceItems(dest);

  const toggleItem = (itemId: string) =>
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    );

  const goToBooking = () => {
    const params = new URLSearchParams({ dest: dest.id });
    if (selectedIds.length > 0) params.set('items', selectedIds.join(','));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <main className="min-h-dvh bg-shore-50 pb-28 md:pb-0">
      <TopNav />

      <article className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-10 lg:px-10 animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13px] text-navy-soft hover:text-navy transition-colors mb-5"
        >
          <ArrowLeftIcon />
          Kembali
        </button>

        {/* Hero image */}
        <div
          className="relative w-full h-56 sm:h-72 md:h-80 rounded-2xl overflow-hidden"
          style={{
            background: dest.image ? undefined : `linear-gradient(160deg, ${dest.thumbColor} 0%, #F4F0EB 100%)`,
          }}
        >
          {dest.image ? (
            <img
              src={dest.image}
              alt={dest.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-7xl">{dest.emoji}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mt-6 space-y-5">
          {/* Title + Location */}
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-navy">{dest.name}</h1>
            <div className="flex items-center gap-1.5 mt-2 text-navy-soft">
              <PinIcon />
              <span className="text-[13px]">{dest.location}</span>
            </div>
          </div>

          {/* Tags */}
          {dest.tags?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {dest.tags.map((tag) => (
                <span key={tag} className="chip">{tag}</span>
              ))}
            </div>
          )}

          {/* Description */}
          {dest.description && (
            <div className="card p-5 sm:p-6">
              <h2 className="text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-2">Tentang</h2>
              <p className="text-[14px] text-navy leading-relaxed whitespace-pre-line">{dest.description}</p>
            </div>
          )}

          {/* Live camera stream dari kamera mitra/pengelola */}
          {dest.cameraId && <DestinationCameraSection cameraId={dest.cameraId} />}

          {/* Live IoT monitoring — hanya untuk destinasi yang punya stasiun sensor */}
          {dest.hasMonitoring && <LiveMonitorSection />}

          {/* Daftar Harga + Booking — tiap item kartu berdiri sendiri (seperti beranda) */}
          <div className="space-y-3">
            <h2 className="text-[11px] font-medium text-navy-soft uppercase tracking-wider">Daftar Harga</h2>
            {priceItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          ? 'border-teal-400 bg-teal-50 shadow-lift'
                          : 'border-shore-200 bg-surface hover:border-shore-300 hover:shadow-lift'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[14px] font-semibold text-navy leading-snug">{item.label}</h3>
                        <span
                          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors ${
                            isSelected
                              ? 'border-teal-500 bg-teal-500 text-white'
                              : 'border-shore-300 bg-surface'
                          }`}
                        >
                          {isSelected && <CheckIcon />}
                        </span>
                      </div>
                      {item.description && (
                        <p className="mt-1.5 text-[12px] text-navy-soft leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-auto pt-3 text-[15px] font-semibold text-navy">
                        {formatRp(item.price)}
                        <span className="text-[12px] text-navy-soft font-normal"> {item.unit}</span>
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
        </div>
      </article>

      <BottomNav />
    </main>
  );
}
