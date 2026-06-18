'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthState } from '@/lib/useAuth';

export default function HeroBanner() {
  const { user } = useAuthState();
  const firstName = user?.displayName?.split(' ')[0] ?? 'Explorer';
  const [scrollY, setScrollY] = useState(0);
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
            Sulawesi Utara · Taman Laut Bunaken
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
            <span className="italic font-normal text-[#8FE6DB]">{firstName}</span>
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
            yang tak terlupakan di ujung utara Indonesia.
          </p>

          {/* CTA */}
          <div
            className="animate-fade-up mt-9 flex flex-wrap items-center gap-3.5"
            style={{ animationDelay: '0.34s' }}
          >
            <Link
              href="/destinations"
              className="group inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink shadow-lg shadow-ink/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#EAF6F3]"
            >
              Jelajahi Destinasi
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/85 backdrop-blur-md transition-all duration-200 hover:border-white/40 hover:bg-white/10"
            >
              Riwayat Booking
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
