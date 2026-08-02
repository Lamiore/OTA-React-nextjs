'use client';

import { useEffect, useState } from 'react';
import { getDestinations, type Destination } from '@/lib/firestore';
import { useSavedDestinations } from '@/lib/useSaved';
import { useLang } from '@/lib/useLang';
import DestinationCard from '@/components/mobile/DestinationCard';

export default function SavedDestinations() {
  const { user, savedIds, toggle } = useSavedDestinations();
  const { t } = useLang();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDestinations().then((d) => {
      setDestinations(d);
      setLoading(false);
    });
  }, []);

  const saved = destinations.filter((d) => savedIds.includes(d.id));

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-shore-200/80">
        <h2 className="font-serif text-lg font-medium text-navy">{t('profile.saved')}</h2>
        <p className="text-2xs text-navy-soft mt-0.5">{t('profile.savedDesc')}</p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            <div className="h-24 rounded-md bg-shore-100 animate-pulse" />
            <div className="h-24 rounded-md bg-shore-100 animate-pulse" />
          </div>
        ) : saved.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-3 text-center">
            <div className="w-12 h-12 rounded-md bg-shore-100 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <p className="text-xs text-navy-soft">
              Belum ada destinasi tersimpan.
              <br />
              Ketuk ikon hati di kartu destinasi untuk menyimpan.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {saved.map((dest) => (
              <DestinationCard
                key={dest.id}
                {...dest}
                saved
                onToggleSave={user ? () => toggle(dest.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
