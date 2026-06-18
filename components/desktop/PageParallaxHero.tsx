'use client';

import { useEffect, useState } from 'react';

interface PageParallaxHeroProps {
  badge: string;
  title: string;
  description: string;
  imageUrl: string;
}

export default function PageParallaxHero({
  badge,
  title,
  description,
  imageUrl,
}: PageParallaxHeroProps) {
  const [scrollY, setScrollY] = useState(0);

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

  const parallax = Math.min(scrollY * 0.15, 54);
  const opacity = Math.max(1 - scrollY / 500, 0);

  return (
    <section className="relative overflow-hidden grain" style={{ minHeight: '320px' }}>
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translateY(${parallax}px) scale(1.06)`,
          transformOrigin: 'center top',
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: `center calc(45% + ${parallax * 0.4}px)`,
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/65 via-ink/50 to-ink/75" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/50 via-transparent to-ink/20" />

      {/* Content */}
      <div
        className="relative z-10 mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20"
        style={{ opacity }}
      >
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            {badge}
          </div>
          <h1 className="font-serif text-3xl font-medium text-white sm:text-4xl tracking-tight">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/55 font-light">
            {description}
          </p>
        </div>
      </div>

      {/* Bottom curve */}
      <div className="absolute bottom-0 inset-x-0 z-10">
        <div className="h-6 bg-shore-50 rounded-t-[24px]" />
      </div>
    </section>
  );
}
