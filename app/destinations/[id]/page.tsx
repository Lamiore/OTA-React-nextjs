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
import { destinationCameraIds } from '@/lib/destination';
import { stationPath } from '@/lib/realtime';
import { formatIDR, waLink } from '@/lib/format';
import TopNav from '@/components/desktop/TopNav';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';
import LiveMonitorPanel from '@/components/destinations/LiveMonitorPanel';
import DestinationReviews, { StarRow } from '@/components/destinations/DestinationReviews';
import { useAuthState } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';

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

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
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


export default function DestinationDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthState();
  const { t } = useLang();
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
        <TopNav compact />
        <div className="mx-auto max-w-4xl animate-pulse space-y-6 px-4 py-10 sm:px-6 lg:px-10">
          <div className="h-64 rounded-md bg-shore-100 sm:h-80" />
          <div className="h-6 w-2/3 rounded-full bg-shore-100" />
          <div className="h-4 w-1/3 rounded-full bg-shore-100" />
          <div className="h-20 rounded-md bg-shore-100" />
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!dest) {
    return (
      <main className="min-h-dvh bg-shore-50">
        <TopNav compact />
        <div className="flex flex-col items-center justify-center gap-4 py-32">
          <p className="text-sm text-navy-soft">{t('dest.notFound')}</p>
          <button onClick={() => router.push('/beranda')} className="btn-primary px-5 py-2.5 text-sm">
            Kembali ke Beranda
          </button>
        </div>
        <BottomNav />
      </main>
    );
  }

  const priceItems = getPriceItems(dest);
  const { avg, count } = reviewStats(reviews);

  // Tautan keluar, bukan peta tertanam: pengunjung sudah punya aplikasi peta
  // pilihannya sendiri, dan halaman ini tidak perlu menanggung bundel peta.
  const mapsHref =
    typeof dest.lat === 'number' && typeof dest.lng === 'number'
      ? `https://www.google.com/maps/search/?api=1&query=${dest.lat},${dest.lng}`
      : null;
  const waHref = dest.whatsapp
    ? waLink(dest.whatsapp, `Halo, saya mau tanya soal ${dest.name}.`)
    : null;

  const toggleItem = (itemId: string) =>
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    );

  const goToBooking = () => {
    // Butuh akun terverifikasi. Belum login / belum verifikasi → ke /profile
    // (di sana tampil form masuk atau layar verifikasi email).
    if (!user || !user.emailVerified) {
      router.push('/profile');
      return;
    }
    const params = new URLSearchParams({ dest: dest.id });
    if (selectedIds.length > 0) params.set('items', selectedIds.join(','));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-28 md:pb-0">
      <TopNav compact />

      {/* Hero immersive — foto full-bleed, scrim laut-dalam, judul di-overlay. */}
      <section className="grain relative h-[58vh] min-h-[400px] w-full overflow-hidden">
        {dest.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dest.image}
            alt={dest.name}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // Pelat tipografis, bukan emoji — lihat design.md § Per-page allowances.
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: dest.thumbColor }}
            aria-hidden="true"
          >
            <span className="font-serif text-display font-semibold text-white/80">
              {dest.name.trim().charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {/* Scrim kedalaman — dibangun di token `ink` yang selalu gelap. */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 to-ink/85" />

        {/* Back button */}
        <div className="absolute inset-x-0 top-0 z-10">
          <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6 lg:px-10">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-sm border border-white/20 bg-ink/40 px-3.5 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-ink/60"
            >
              <ArrowLeftIcon />
              Kembali
            </button>
          </div>
        </div>

        {/* Judul + lokasi + rating */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-10">
            <h1 className="animate-fade-up font-serif text-display font-semibold capitalize text-white">
              {dest.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-white/80">
                <PinIcon />
                <span className="capitalize">{dest.location}</span>
              </span>
              {count > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <StarRow value={avg} size={15} />
                  <span className="text-sm font-semibold text-white">{avg.toFixed(1)}</span>
                  <span className="text-xs text-white/60">· {count} ulasan</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sheet konten naik di atas foto. */}
      <div className="relative z-10 -mt-6 rounded-t-lg bg-shore-50">
        <article className="mx-auto max-w-4xl animate-fade-in px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
          <div className="space-y-10">
            {/* Aksi cepat — rute & kontak pengelola. Keduanya opsional per
                destinasi; barisnya hilang sendiri kalau dua-duanya kosong. */}
            {(mapsHref || waHref) && (
              <div className="flex flex-wrap gap-3">
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost px-4 py-2.5 text-sm"
                  >
                    <PinIcon />
                    Rute ke lokasi
                  </a>
                )}
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost px-4 py-2.5 text-sm"
                  >
                    <ChatIcon />
                    Chat pengelola
                  </a>
                )}
              </div>
            )}

            {/* Tags */}
            {dest.tags?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {dest.tags.map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>
            )}

            {/* Deskripsi — kolom prosa terukur, bukan kartu di dalam kolom yang
                sudah punya batas sendiri (design.md § Surface language). */}
            {dest.description && (
              <section>
                <h2 className="section-title">{t('dest.about')}</h2>
                <p className="mt-4 max-w-[65ch] whitespace-pre-line text-base leading-relaxed text-navy">
                  {dest.description}
                </p>
              </section>
            )}

            {/* Galeri — strip geser ber-snap, keluar dari padding kolom supaya
                foto terakhir "mengintip" di tepi layar dan jelas bisa digeser.
                Foto hero (dest.image) sengaja tidak diulang di sini. */}
            {dest.images && dest.images.length > 0 && (
              <section>
                <h2 className="section-title">{t('dest.gallery')}</h2>
                <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
                  {dest.images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt={`${dest.name} — foto ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-48 w-72 shrink-0 snap-start rounded-md object-cover sm:h-56 sm:w-80"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Daftar harga + booking — tiap item berdiri sendiri. */}
            <section className="space-y-4">
              <h2 className="section-title">{t('dest.priceList')}</h2>
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
                        className={`flex flex-col rounded-md border p-4 text-left transition-colors duration-micro ease-out ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50'
                            : 'border-shore-200 bg-surface hover:border-shore-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold capitalize leading-snug text-navy">{item.label}</h3>
                          <span
                            className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-xs border transition-colors duration-micro ease-out ${
                              isSelected ? 'border-teal-600 bg-teal-600 text-white' : 'border-shore-300 bg-surface'
                            }`}
                          >
                            {isSelected && <CheckIcon />}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-navy-soft">
                            {item.description}
                          </p>
                        )}
                        <p className="tabular mt-auto pt-3 text-base font-semibold text-navy">
                          {formatIDR(item.price)}
                          <span className="text-xs font-normal text-navy-soft"> {item.unit}</span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-navy-soft">
                  {t('dest.noPriceList')}
                </p>
              )}
              <button
                onClick={goToBooking}
                disabled={priceItems.length > 0 && selectedIds.length === 0}
                className="btn-primary w-full px-6 py-3"
              >
                {priceItems.length > 0
                  ? selectedIds.length > 0
                    ? `Booking · ${selectedIds.length} item`
                    : 'Pilih item dulu'
                  : 'Booking'}
              </button>
            </section>

            {/* Pantau langsung — kamera (kalau di-link & boleh ditonton) + sensor IoT */}
            {(destinationCameraIds(dest).length > 0 || stationPath(dest)) && (
              <LiveMonitorPanel
                cameraDocIds={destinationCameraIds(dest)}
                sensorPath={stationPath(dest)}
              />
            )}

            {/* Ulasan pengunjung */}
            <DestinationReviews destinationId={dest.id} reviews={reviews} />
          </div>
        </article>
      </div>

      <Footer />
      <BottomNav />
    </main>
  );
}
