'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchRatingSummaries, type Destination, type RatingSummary } from '@/lib/firestore';
import { useSavedDestinations } from '@/lib/useSaved';
import DestinationCard from './DestinationCard';
import FilterChips from './FilterChips';

function SkeletonCard() {
  return <div className="h-24 rounded-2xl bg-shore-100 animate-pulse" />;
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft shrink-0">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function DestinationList() {
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
    <div className="bg-shore-50">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-1 pb-2.5">
        <h2 className="text-sm font-semibold text-navy">Destinasi Populer</h2>
        <button className="text-[11px] text-teal-600 font-medium">
          Lihat Semua
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-2.5">
        <div className="flex items-center gap-2.5 rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5">
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari destinasi..."
            className="w-full bg-transparent text-[13px] text-navy placeholder:text-navy-soft/60 outline-none"
          />
        </div>
      </div>

      <FilterChips onFilterChange={(f) => setActiveFilter(f)} />

      <div className="flex flex-col gap-3 px-4 pt-3.5 pb-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-12 h-12 rounded-xl bg-shore-100 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <p className="text-xs text-navy-soft">
              Tidak ada destinasi ditemukan
            </p>
          </div>
        ) : (
          shown.map((dest, i) => (
            <div
              key={dest.id}
              className="animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <DestinationCard
                {...dest}
                rating={ratings[dest.id]}
                saved={savedIds.includes(dest.id)}
                onToggleSave={user ? () => toggle(dest.id) : undefined}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
