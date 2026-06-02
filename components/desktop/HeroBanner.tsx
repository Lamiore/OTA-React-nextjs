'use client';

import { useEffect, useState } from 'react';
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

  return (
    <section className="relative overflow-hidden grain" style={{ minHeight: '520px' }}>
      {/* Background image with parallax */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translateY(${parallax}px) scale(1.08)`,
          transformOrigin: 'center top',
          backgroundImage: `url(${heroImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: `center calc(40% + ${parallax * 0.4}px)`,
        }}
      />

      {/* Overlay — elegant dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy/70 via-navy/50 to-navy/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/60 via-transparent to-navy/30" />

      {/* Soft light accent */}
      <div className="absolute top-[8%] left-[12%] h-32 w-32 rounded-full bg-teal-400/10 blur-3xl" />
      <div className="absolute top-[15%] right-[20%] h-24 w-48 rounded-full bg-white/5 blur-3xl" />

      {/* Content */}
      <div
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10"
        style={{ opacity }}
      >
        <div className="pt-16 pb-20 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28 max-w-2xl">
          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            Sulawesi Utara
          </div>

          {/* Greeting */}
          <p className="text-[15px] text-white/50 mb-2 font-light">Selamat datang kembali</p>

          {/* Headline */}
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white font-medium leading-[1.1] mb-4 tracking-tight">
            Halo, {firstName}
          </h1>

          {/* Subtitle */}
          <p className="text-white/55 text-base leading-relaxed max-w-lg font-light">
            Temukan spot selam terbaik, pantai tersembunyi, dan pengalaman laut yang tak terlupakan di ujung utara Indonesia.
          </p>

          {/* Quick stats */}
          <div className="mt-10 flex items-center gap-8 sm:gap-10">
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-white tracking-tight">12+</span>
              <span className="text-[11px] text-white/40 mt-0.5">Dive Sites</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-teal-200 tracking-tight">28°C</span>
              <span className="text-[11px] text-white/40 mt-0.5">Suhu Rata-rata</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-white tracking-tight">25m</span>
              <span className="text-[11px] text-white/40 mt-0.5">Visibilitas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom curve transition */}
      <div className="absolute bottom-0 inset-x-0 z-10">
        <div className="h-8 bg-shore-50 rounded-t-[28px]" />
      </div>
    </section>
  );
}
