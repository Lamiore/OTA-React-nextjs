'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchRatingSummaries, getPriceItems, type Destination, type RatingSummary } from '@/lib/firestore';
import { useSavedDestinations } from '@/lib/useSaved';
import { useLang } from '@/lib/useLang';
import { useLocations } from '@/lib/useLocations';
import DesktopDestinationCard from './DesktopDestinationCard';
import clsx from 'clsx';

// Nilainya tetap Indonesia — dipakai membandingkan state & query param `loc`.
// Hanya 'Semua' dan 'Terdekat' yang punya terjemahan; sisanya nama wilayah yang
// datang dari Firestore lewat useLocations().
const FILTER_KEYS: Record<string, string> = {
  Semua: 'filter.all',
  Terdekat: 'filter.nearest',
};

const gridClass = 'grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

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
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center gap-4 py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-shore-100">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <p className="text-sm text-navy-soft">{t('home.notFound')}</p>
    </div>
  );
}

export default function DesktopDestinationGrid() {
  // Pencarian sepenuhnya dari URL (?q) yang di-set search hero — grid tidak
  // punya kotak search sendiri lagi. ?loc masih menyetir chip wilayah.
  const searchParams = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  const locParam = searchParams.get('loc') ?? 'Semua';
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(locParam);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const { user, savedIds, toggle } = useSavedDestinations();
  const { t } = useLang();
  const locations = useLocations();
  const filters = useMemo(
    () => ['Semua', ...locations, 'Terdekat'],
    [locations]
  );

  useEffect(() => {
    setActiveFilter(locParam);
  }, [locParam]);

  // ?loc bisa menyebut wilayah yang sudah tidak ada lagi di koleksi. Dulu daftar
  // chip-nya hardcoded jadi chipnya selalu ada; sekarang filter seperti itu aktif
  // tanpa chip yang menyala, dan gridnya kosong tanpa cara melepasnya. Tunggu
  // daftar wilayah termuat dulu — locations kosong di paint pertama.
  useEffect(() => {
    if (!locations.length) return;
    setActiveFilter((f) =>
      f === 'Semua' || f === 'Terdekat' || locations.includes(f) ? f : 'Semua'
    );
  }, [locations]);

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

  const term = qParam.trim().toLowerCase();
  const shown = term
    ? destinations.filter((d) =>
        [d.name, d.location, ...(d.tags ?? [])].join(' ').toLowerCase().includes(term)
      )
    : destinations;

  // Search teks atau chip lokasi aktif → tampilkan hasil flat. Selain itu →
  // permukaan discovery per-wilayah (Ecosystem Index).
  const hasFilter = term !== '' || activeFilter !== 'Semua';

  // Destinasi berpengelola naik ke bagiannya sendiri di atas. Sengaja truthy,
  // bukan `!== undefined`: dokumen yang belum punya pengelola menyimpan string
  // kosong, jadi cek keberadaan field akan mengangkat seluruh koleksi ke sana.
  const managed = shown.filter((d) => !!d.managerUid);
  const others = shown.filter((d) => !d.managerUid);

  // Dari `others`, bukan seluruh koleksi — kalau tidak, destinasi berpengelola
  // muncul dua kali: sekali di bagian atas, sekali lagi di bawah wilayahnya.
  // useMemo dilepas bareng itu: `others` array baru tiap render, jadi memo-nya
  // tidak pernah kena — dan pengelompokan tujuh dokumen tidak butuh cache.
  const byLocation = (() => {
    const m = new Map<string, Destination[]>();
    for (const d of others) {
      const k = (d.location || '').trim() || t('filter.other');
      const arr = m.get(k);
      if (arr) arr.push(d);
      else m.set(k, [d]);
    }
    return Array.from(m.entries()).sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
    );
  })();

  // Lede menghitung yang benar-benar tampil, bukan byLocation: sejak destinasi
  // berpengelola punya bagian sendiri, byLocation tidak lagi memuat semuanya —
  // mencari "bahoi" akan berbunyi "di 0 wilayah" padahal kartunya ada di layar.
  const regionCount = new Set(shown.map((d) => (d.location || '').trim())).size;

  const renderCard = (dest: Destination, i: number) => (
    <div key={dest.id} className="h-full animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
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
      {/* Padding atas jauh lebih rapat dari bawah. Yang di atas cuma jarak ke
          foto hero yang baru saja selesai bicara — 80px di sana membuat judul
          seksi terbaca seperti halaman lain. Yang di bawah masih lapang: itu
          jarak ke footer, dan grid yang menempel footer terasa terpotong. */}
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-10 lg:pb-20 lg:pt-12">
        {/* Kepala bagian tanpa eyebrow: judulnya sendiri yang jadi kepala. */}
        <div className="mb-6 max-w-xl">
          <h2 className="section-title">{t('home.sectionTitle')}</h2>
          <p className="section-lede">
            {loading
              ? t('home.loadingDest')
              : t('home.gridLede', {
                  count: shown.length,
                  regions: regionCount,
                })}
          </p>
        </div>

        {/* Filter chips. Wilayahnya menyusul dari Firestore, jadi selama daftar
            masih kosong tampilkan pil kosong — bukan 'Semua · Terdekat' yang
            sekejap berubah jadi lima chip di depan mata pengguna.
            Sticky: halaman ini panjang (satu blok per wilayah), dan filter yang
            hilang di atas layar memaksa scroll balik ke puncak untuk ganti
            wilayah. `top-16` menyamai tinggi TopNav; di mobile TopNav tidak
            dirender sama sekali (hidden md:block) jadi baris ini menempel di 0.
            -mx/px menutup celah supaya kartu tidak terlihat lewat di sisinya. */}
        <div className="sticky top-0 z-30 -mx-4 mb-8 flex gap-2 overflow-x-auto bg-shore-50/95 px-4 py-3 backdrop-blur-sm scrollbar-hide sm:-mx-6 sm:px-6 md:top-16 lg:-mx-10 lg:px-10">
          {locations.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="chip w-24 shrink-0 animate-pulse bg-shore-100 text-transparent">
                  &nbsp;
                </div>
              ))
            : filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  // shrink-0: tanpa ini nama wilayah panjang ("Maluku Utara")
                  // diperas oleh flex sampai membungkus dua baris, dan satu
                  // chip lebih tinggi menaikkan seluruh barisnya.
                  className={clsx('chip shrink-0 whitespace-nowrap', activeFilter === f && 'chip-active')}
                >
                  {FILTER_KEYS[f] ? t(FILTER_KEYS[f]) : f}
                </button>
              ))}
        </div>

        {/* Destinasi berpengelola — di atas, dengan ringkasan sensornya sendiri. */}
        {!loading && managed.length > 0 && (
          <div className="mb-10">
            <div className="mb-4 border-b border-shore-200 pb-2.5">
              <h3 className="font-serif text-xl font-semibold tracking-tight text-navy">
                {t('home.managedTitle')}
              </h3>
              <span className="text-xs text-navy-soft">{t('home.managedLede')}</span>
            </div>
            <div className={gridClass}>{managed.map(renderCard)}</div>
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className={gridClass}>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          // Dikunci ke `shown`, bukan `others`: hasil pencarian yang cuma berisi
          // destinasi berpengelola sudah tampil di bagian atas, jadi "tidak
          // ditemukan" di bawahnya akan membantah kartu yang sedang terlihat.
          <EmptyState />
        ) : hasFilter ? (
          others.length > 0 && <div className={gridClass}>{others.map(renderCard)}</div>
        ) : (
          <div className="space-y-10">
            {byLocation.map(([loc, items]) => (
              <div key={loc}>
                <div className="mb-4 flex items-end justify-between gap-4 border-b border-shore-200 pb-2.5">
                  <div>
                    <h3 className="font-serif text-xl font-semibold capitalize tracking-tight text-navy">
                      {loc}
                    </h3>
                    <span className="text-xs text-navy-soft">
                      {t(items.length === 1 ? 'home.regionCountOne' : 'home.regionCount', {
                        count: items.length,
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveFilter(loc)}
                    className="btn-text shrink-0"
                  >
                    {t('home.seeAllShort')}
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
