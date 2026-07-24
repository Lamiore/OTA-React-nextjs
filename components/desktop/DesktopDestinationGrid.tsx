'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchRatingSummaries, getPriceItems, type Destination, type RatingSummary } from '@/lib/firestore';
import { useSavedDestinations } from '@/lib/useSaved';
import DesktopDestinationCard from './DesktopDestinationCard';
import clsx from 'clsx';

const filters = ['Semua', 'Bunaken', 'Likupang', 'Lembeh', 'Terdekat'];

const gridClass = 'grid grid-cols-1 gap-5 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

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

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-shore-100">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <p className="text-sm text-navy-soft">Tidak ada destinasi ditemukan</p>
    </div>
  );
}

export default function DesktopDestinationGrid() {
  // Seed dari URL (?q & ?loc) yang di-set hero search, lalu ikut berubah bila
  // hero mencari lagi. Ketikan di kotak search grid sendiri tetap lokal.
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  const locParam = searchParams.get('loc') ?? 'Semua';
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(locParam);
  const [search, setSearch] = useState(qParam);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const { user, savedIds, toggle } = useSavedDestinations();

  useEffect(() => {
    setSearch(qParam);
    setActiveFilter(locParam);
  }, [qParam, locParam]);

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

  // Search teks atau chip lokasi aktif → tampilkan hasil flat. Selain itu →
  // permukaan discovery per-wilayah (Ecosystem Index).
  const hasFilter = term !== '' || activeFilter !== 'Semua';

  const byLocation = useMemo(() => {
    const m = new Map<string, Destination[]>();
    for (const d of destinations) {
      const k = (d.location || '').trim() || 'Lainnya';
      const arr = m.get(k);
      if (arr) arr.push(d);
      else m.set(k, [d]);
    }
    return Array.from(m.entries()).sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
    );
  }, [destinations]);

  const renderCard = (dest: Destination, i: number) => (
    <div key={dest.id} className="animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
      <DesktopDestinationCard
        {...dest}
        rating={ratings[dest.id]}
        saved={savedIds.includes(dest.id)}
        onToggleSave={user ? () => toggle(dest.id) : undefined}
        priceFrom={priceFrom(dest)}
      />
    </div>
  );

  return (
    <section id="destinasi" className="scroll-mt-16 bg-shore-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        {/* Kepala bagian tanpa eyebrow: judulnya sendiri yang jadi kepala. */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="max-w-xl">
            <h2 className="section-title">Destinasi Sulawesi Utara</h2>
            <p className="section-lede">
              {loading
                ? 'Memuat destinasi…'
                : `${destinations.length} destinasi di ${byLocation.length} wilayah — dari terumbu Bunaken sampai muck-diving Lembeh. Cari, atau telusuri per wilayah di bawah.`}
            </p>
          </div>
          <div className="flex w-full items-center gap-2.5 rounded-sm border border-shore-200 bg-surface px-4 py-2.5 transition-colors duration-micro ease-out focus-within:border-teal-600 sm:w-72">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari destinasi…"
              aria-label="Cari destinasi"
              className="w-full min-w-0 bg-transparent text-sm text-navy placeholder:text-navy-soft outline-none"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="mb-10 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={clsx('chip', activeFilter === f && 'chip-active')}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div className={gridClass}>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : hasFilter ? (
          shown.length === 0 ? (
            <EmptyState />
          ) : (
            <div className={gridClass}>{shown.map(renderCard)}</div>
          )
        ) : (
          <div className="space-y-14">
            {byLocation.map(([loc, items]) => (
              <div key={loc}>
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-shore-200 pb-3">
                  <div>
                    <h3 className="font-serif text-xl font-semibold capitalize tracking-tight text-navy">
                      {loc}
                    </h3>
                    <span className="text-xs text-navy-soft">{items.length} destinasi</span>
                  </div>
                  <button
                    onClick={() => setActiveFilter(loc)}
                    className="btn-text shrink-0"
                  >
                    Lihat semua
                  </button>
                </div>
                <div className={gridClass}>{items.map(renderCard)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
