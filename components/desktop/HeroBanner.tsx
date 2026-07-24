'use client';

import { useState, type FormEvent, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthState } from '@/lib/useAuth';

const LOCATIONS = ['Semua', 'Bunaken', 'Likupang', 'Lembeh'];

// H6 · Photographic fold — satu foto full-bleed memikul argumen pertama halaman,
// tipografi duduk di atasnya condong ke kiri. Tanpa parallax (butuh listener
// scroll yang menyetir layout), tanpa blob blur, tanpa pembatas ombak.
//
// Bar statistik lama ("12+ Dive Sites · 28°C · 25m") dihapus: angkanya hardcoded,
// tidak pernah berasal dari Firestore maupun feed sensor.
export default function HeroBanner() {
  const { user } = useAuthState();
  const router = useRouter();
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
          {firstName && (
            <p className="reveal text-sm text-white/70" style={step(0)}>
              Halo, {firstName}.
            </p>
          )}

          <h1
            className="reveal mt-2 font-serif text-display font-semibold text-white"
            style={step(1)}
          >
            Laut dalam Sulawesi menanti.
          </h1>

          <p
            className="reveal mt-5 max-w-[52ch] text-base leading-relaxed text-white/75"
            style={step(2)}
          >
            Spot selam, pantai tersembunyi, dan pengalaman laut di Bunaken,
            Likupang, dan Lembeh — lengkap dengan pantauan kondisi perairan
            secara langsung.
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
                  placeholder="Cari destinasi, pantai, spot selam…"
                  aria-label="Cari destinasi"
                  className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/55 outline-none"
                />
              </div>

              <div className="hidden h-7 w-px bg-white/20 sm:block" />

              <label className="flex items-center gap-2 px-3 py-1.5">
                <svg className="h-[18px] w-[18px] shrink-0 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="sr-only">Lokasi</span>
                <select
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  aria-label="Lokasi"
                  className="cursor-pointer bg-transparent text-sm font-medium text-white outline-none [&>option]:text-navy"
                >
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l === 'Semua' ? 'Semua lokasi' : l}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="btn-primary px-6 py-2.5">
                Cari
              </button>
            </div>
          </form>

          <p className="reveal mt-5 text-sm" style={step(4)}>
            <Link
              href="#destinasi"
              className="whitespace-nowrap border-b border-white/40 pb-0.5 font-medium text-white transition-colors duration-micro ease-out hover:border-white"
            >
              Lihat semua destinasi
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
