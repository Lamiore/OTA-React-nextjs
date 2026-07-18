'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchRatingSummaries, getPriceItems, type Destination, type RatingSummary } from '@/lib/firestore';
import { useSavedDestinations } from '@/lib/useSaved';
import DesktopDestinationCard from './DesktopDestinationCard';
import clsx from 'clsx';

const filters = ['Semua', 'Bunaken', 'Likupang', 'Lembeh', 'Terdekat'];

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft shrink-0">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Harga item termurah destinasi — undefined bila belum ada daftar harga. */
function priceFrom(dest: Destination): number | undefined {
  const prices = getPriceItems(dest)
    .map((p) => p.price)
    .filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : undefined;
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse overflow-hidden">
      <div className="h-44 bg-shore-100" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-3/4 rounded-full bg-shore-100" />
        <div className="h-3 w-1/2 rounded-full bg-shore-100" />
        <div className="h-3 w-2/3 rounded-full bg-shore-100" />
      </div>
    </div>
  );
}

export default function DesktopDestinationGrid() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [search, setSearch] = useState('');
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const { user, savedIds, toggle } = useSavedDestinations();

  useEffect(() => {
    fetchRatingSummaries().then(setRatings);
  }, []);

  const fetchDestinations = useCallback(async (filter: string) => {
    if (!db) {
      setDestinations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ref = collection(db, 'destinations');
      const q =
        filter && filter !== 'Semua'
          ? query(ref, where('location', '==', filter))
          : ref;
      const snap = await getDocs(q);
      setDestinations(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Destination))
      );
    } catch {
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDestinations(activeFilter);
  }, [activeFilter, fetchDestinations]);

  const term = search.trim().toLowerCase();
  const shown = term
    ? destinations.filter((d) =>
        [d.name, d.location, ...(d.tags ?? [])].join(' ').toLowerCase().includes(term)
      )
    : destinations;

  return (
    <section id="destinasi" className="relative scroll-mt-16 overflow-hidden bg-shore-50">
      {/* Aksen atmosfer — cahaya teal lembut di belakang grid. */}
      <div className="pointer-events-none absolute -right-28 top-16 h-96 w-96 rounded-full bg-teal-400/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -left-28 bottom-8 h-80 w-80 rounded-full bg-teal-200/[0.05] blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-10">
        {/* Header — heading serif menyambung gaya editorial hero, search di kanan. */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div>
            <span className="section-label mb-2">Pilihan Terbaik</span>
            <h2 className="mt-2 font-serif text-3xl font-medium tracking-tight text-navy sm:text-4xl">
              Destinasi Populer
            </h2>
            <p className="mt-2 text-[13px] font-light text-navy-soft">
              Spot selam, pantai & ekowisata pilihan di Sulawesi Utara.
            </p>
          </div>
          <div className="flex w-full items-center gap-2.5 rounded-full border border-shore-200 bg-surface px-4 py-2.5 shadow-soft transition-colors focus-within:border-teal-400 sm:w-72">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari destinasi..."
              className="w-full bg-transparent text-[13px] text-navy placeholder:text-navy-soft/60 outline-none"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={clsx(
                'chip',
                activeFilter === f && 'chip-active'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-shore-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <p className="text-sm text-navy-soft">
              Tidak ada destinasi ditemukan
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((dest, i) => (
              <div
                key={dest.id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <DesktopDestinationCard
                  {...dest}
                  rating={ratings[dest.id]}
                  saved={savedIds.includes(dest.id)}
                  onToggleSave={user ? () => toggle(dest.id) : undefined}
                  priceFrom={priceFrom(dest)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
