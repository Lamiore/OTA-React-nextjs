'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useLang } from '@/lib/useLang';
import { useLocations } from '@/lib/useLocations';

// Nilainya tetap Indonesia — dikirim ke onFilterChange lalu dibandingkan di
// DestinationList. Yang diterjemahkan hanya labelnya; nama wilayah datang dari
// Firestore lewat useLocations(), sumber yang sama dengan chip versi desktop.
const FILTER_KEYS: Record<string, string> = {
  Semua: 'filter.all',
  Terdekat: 'filter.nearest',
};

interface Props {
  onFilterChange?: (filter: string) => void;
}

export default function FilterChips({ onFilterChange }: Props) {
  const [active, setActive] = useState('Semua');
  const { t } = useLang();
  const locations = useLocations();
  const filters = ['Semua', ...locations, 'Terdekat'];

  const handleClick = (f: string) => {
    setActive(f);
    onFilterChange?.(f);
  };

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-0 scrollbar-hide">
      {locations.length === 0
        ? Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="chip w-20 shrink-0 animate-pulse bg-shore-100 text-transparent"
            >
              &nbsp;
            </div>
          ))
        : filters.map((f) => (
            <button
              key={f}
              onClick={() => handleClick(f)}
              className={clsx(
                'chip shrink-0 whitespace-nowrap',
                active === f && 'chip-active'
              )}
            >
              {FILTER_KEYS[f] ? t(FILTER_KEYS[f]) : f}
            </button>
          ))}
    </div>
  );
}
