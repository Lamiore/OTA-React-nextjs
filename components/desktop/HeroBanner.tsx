'use client';

import { useState, type FormEvent, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthState } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';
import { useLocations } from '@/lib/useLocations';

// H6 · Photographic fold — satu foto full-bleed memikul argumen pertama halaman,
// tipografi duduk di atasnya condong ke kiri. Tanpa parallax (butuh listener
// scroll yang menyetir layout), tanpa blob blur, tanpa pembatas ombak.
//
// Bar statistik lama ("12+ Dive Sites · 28°C · 25m") dihapus: angkanya hardcoded,
// tidak pernah berasal dari Firestore maupun feed sensor.
export default function HeroBanner() {
  const { user } = useAuthState();
  const router = useRouter();
  const { t } = useLang();
  const locations = useLocations();
  const firstName = user?.displayName?.split(' ')[0];
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('Semua');
  const heroImageUrl =
    'https://commons.wikimedia.org/wiki/Special:FilePath/Liang%20Beach%20Bunaken.JPG';

  // Cari → seed URL param (?q & ?loc) lalu scroll ke grid #destinasi yang membacanya.
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (loc !== 'Semua') params.set('loc', loc);
    const qs = params.toString();
    router.replace(qs ? `/beranda?${qs}` : '/beranda', { scroll: false });
    document
      .getElementById('destinasi')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const step = (i: number) => ({ '--i': i }) as CSSProperties;

  return (
    <section className="grain relative isolate overflow-hidden">
      {/* Elemen LCP: prioritas tinggi, tidak pernah lazy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={heroImageUrl}
        alt="Perairan dangkal Pantai Liang, Bunaken"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_42%]"
      />

      {/* Scrim kedalaman — dibangun di atas token `ink` yang selalu gelap, jadi
          keterbacaan teks putih identik di tema terang maupun gelap. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/45 to-ink/85" />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-28 lg:px-10 lg:pb-24 lg:pt-36">
        <div className="max-w-2xl">
          {/* Sapaan duduk di bagian scrim yang paling terang (from-ink/45), jadi
              putih 70% di ukuran sm praktis hilang di atas foto. Putih penuh +
              drop-shadow — pola yang sama dipakai label kamera di LiveMonitorPanel.
              Tetap sans supaya tidak bertabrakan peran dengan judul serif di bawahnya. */}
          {firstName && (
            <p
              className="reveal text-base font-medium text-white drop-shadow-sm sm:text-lg"
              style={step(0)}
            >
              {t('home.greeting', { name: firstName })}
            </p>
          )}

          <h1
            className="reveal mt-3 font-serif text-display font-semibold text-white"
            style={step(1)}
          >
            {t('home.heroTitle')}
          </h1>

          <p
            className="reveal mt-5 max-w-[52ch] text-base leading-relaxed text-white/75"
            style={step(2)}
          >
            {t('home.heroLede')}
          </p>

          {/* Cari destinasi + lokasi, langsung menyetir grid #destinasi. */}
          <form onSubmit={submitSearch} className="reveal mt-8" style={step(3)}>
            <div className="flex flex-col gap-2 rounded-md border border-white/20 bg-ink/70 p-2 backdrop-blur-md sm:flex-row sm:items-center sm:gap-0">
              <div className="flex flex-1 items-center gap-2.5 px-3 py-1.5">
                <svg className="h-[18px] w-[18px] shrink-0 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('home.searchHero')}
                  aria-label={t('home.searchLabel')}
                  className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/55 outline-none"
                />
              </div>

              <div className="hidden h-7 w-px bg-white/20 sm:block" />

              <label className="flex items-center gap-2 px-3 py-1.5">
                <svg className="h-[18px] w-[18px] shrink-0 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="sr-only">{t('home.location')}</span>
                <select
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  aria-label={t('home.location')}
                  className="cursor-pointer bg-transparent text-sm font-medium text-white outline-none [&>option]:text-navy"
                >
                  {['Semua', ...locations].map((l) => (
                    <option key={l} value={l}>
                      {l === 'Semua' ? t('home.allLocations') : l}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="btn-primary px-6 py-2.5">
                {t('common.search')}
              </button>
            </div>
          </form>

          <p className="reveal mt-5 text-sm" style={step(4)}>
            <Link
              href="#destinasi"
              className="whitespace-nowrap border-b border-white/40 pb-0.5 font-medium text-white transition-colors duration-micro ease-out hover:border-white"
            >
              {t('home.seeAll')}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
