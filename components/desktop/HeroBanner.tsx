'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthState } from '@/lib/useAuth';

const LOCATIONS = ['Semua', 'Bunaken', 'Likupang', 'Lembeh'];

export default function HeroBanner() {
  const { user } = useAuthState();
  const router = useRouter();
  const firstName = user?.displayName?.split(' ')[0] ?? 'Explorer';
  const [scrollY, setScrollY] = useState(0);
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('Semua');
  const heroImageUrl =
    'https://commons.wikimedia.org/wiki/Special:FilePath/Liang%20Beach%20Bunaken.JPG';

  useEffect(() => {
    let frameId = 0;
    const handleScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const parallax = Math.min(scrollY * 0.2, 80);
  const opacity = Math.max(1 - scrollY / 600, 0);

  const stats = [
    { value: '12+', label: 'Dive Sites', accent: false },
    { value: '28°C', label: 'Suhu Rata-rata', accent: true },
    { value: '25m', label: 'Visibilitas', accent: false },
  ];

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

  return (
    <section className="relative overflow-hidden grain" style={{ minHeight: '600px' }}>
      {/* Background photo with parallax */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translateY(${parallax}px) scale(1.1)`,
          transformOrigin: 'center top',
          backgroundImage: `url(${heroImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: `center calc(42% + ${parallax * 0.4}px)`,
        }}
      />

      {/* Depth gradients — built on the always-dark `ink` token, so the scrim
          stays identical in light and dark themes. */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/45 to-ink/85" />
      <div className="absolute inset-0 bg-gradient-to-tr from-ink/75 via-transparent to-transparent" />
      {/* Soft inner vignette for an editorial, deep-water falloff. */}
      <div
        className="absolute inset-0"
        style={{ boxShadow: 'inset 0 0 200px 50px rgba(15,43,60,0.55)' }}
      />

      {/* Atmospheric light accents — decorative, between photo and content. */}
      <div className="hero-drift pointer-events-none absolute -top-12 left-[6%] h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
      <div
        className="hero-drift pointer-events-none absolute top-[22%] right-[10%] h-56 w-72 rounded-full bg-teal-200/[0.07] blur-3xl"
        style={{ animationDelay: '-7s' }}
      />

      {/* Content */}
      <div
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10"
        style={{ opacity }}
      >
        <div className="pt-20 pb-24 sm:pt-24 sm:pb-28 lg:pt-28 lg:pb-32 max-w-3xl">
          {/* Eyebrow */}
          <div
            className="animate-fade-up mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur-md"
            style={{ animationDelay: '0.05s' }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400/70 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
            </span>
            Sulawesi · Surga Bahari & Terumbu Karang
          </div>

          {/* Greeting */}
          <p
            className="animate-fade-up text-[12px] uppercase tracking-[0.34em] text-white/45 mb-3"
            style={{ animationDelay: '0.12s' }}
          >
            Selamat datang kembali
          </p>

          {/* Headline — editorial Cormorant, name carried as an italic accent. */}
          <h1
            className="animate-fade-up font-serif text-white leading-[0.95] tracking-tight text-5xl sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '0.18s' }}
          >
            <span className="font-medium">Halo, </span>
            {/* Fixed light teal — this accent always sits on the dark photo, so
                it must not flip with the theme tokens. */}
            <span className="font-normal text-[#8FE6DB]">{firstName}</span>
            <span className="block mt-1 font-medium text-white/90">
              laut dalam menanti.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="animate-fade-up mt-6 max-w-xl text-[15px] sm:text-base leading-relaxed font-light text-white/60"
            style={{ animationDelay: '0.26s' }}
          >
            Temukan spot selam terbaik, pantai tersembunyi, dan pengalaman laut
            yang tak terlupakan di seluruh Sulawesi.
          </p>

          {/* Search — cari destinasi + lokasi, langsung menyetir grid #destinasi. */}
          <form
            onSubmit={submitSearch}
            className="animate-fade-up mt-9 max-w-2xl"
            style={{ animationDelay: '0.34s' }}
          >
            <div className="flex flex-col gap-1.5 rounded-2xl border border-teal-400/25 bg-ink/80 p-2 shadow-2xl shadow-black/40 backdrop-blur-md sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-1.5">
              <div className="flex flex-1 items-center gap-2.5 px-3 py-1.5 sm:px-4">
                <svg className="h-[18px] w-[18px] shrink-0 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari destinasi, pantai, spot selam…"
                  aria-label="Cari destinasi"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/45 outline-none"
                />
              </div>
              <div className="hidden h-7 w-px bg-white/15 sm:block" />
              <label className="flex items-center gap-2 px-3 py-1.5 sm:px-4">
                <svg className="h-[18px] w-[18px] shrink-0 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              <button
                type="submit"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-600 sm:rounded-full"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Cari
              </button>
            </div>
          </form>

          {/* Secondary links */}
          <div
            className="animate-fade-up mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]"
            style={{ animationDelay: '0.4s' }}
          >
            <Link
              href="#destinasi"
              className="group inline-flex items-center gap-1.5 font-medium text-white/80 transition-colors hover:text-white"
            >
              Lihat semua destinasi
              <svg className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <span className="h-3 w-px bg-white/20" />
            <Link
              href="/profile?view=riwayat"
              className="font-medium text-white/60 transition-colors hover:text-white/90"
            >
              Riwayat booking
            </Link>
          </div>

          {/* Quick stats — serif numerals tie back to the headline. */}
          <div
            className="animate-fade-up mt-12 flex items-center gap-5 sm:gap-9"
            style={{ animationDelay: '0.42s' }}
          >
            {stats.map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-5 sm:gap-9">
                {i > 0 && <div className="h-9 w-px bg-white/15" />}
                <div className="flex flex-col">
                  <span
                    className={`font-serif text-3xl sm:text-[2.1rem] leading-none tracking-tight ${
                      stat.accent ? 'text-[#8FE6DB]' : 'text-white'
                    }`}
                  >
                    {stat.value}
                  </span>
                  <span className="mt-1.5 whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-white/45">
                    {stat.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Organic wave transition — fill driven by the themed `shore-50` token
          so the seam into the next section stays seamless in both themes. */}
      <div className="absolute -bottom-px inset-x-0 z-10 text-shore-50">
        <svg
          viewBox="0 0 1440 64"
          preserveAspectRatio="none"
          className="block h-[36px] w-full sm:h-[52px]"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0,34 C220,68 470,6 720,22 C970,38 1230,70 1440,30 L1440,64 L0,64 Z"
          />
        </svg>
      </div>
    </section>
  );
}
