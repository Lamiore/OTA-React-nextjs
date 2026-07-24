'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import clsx from 'clsx';

const sensors = [
  {
    key: 'waveHeight',
    label: 'Gelombang',
    unit: 'm',
    getStatus: (v: number) => (v < 0.8 ? 'Aman' : 'Berbahaya'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      </svg>
    ),
  },
  {
    key: 'waterTemp',
    label: 'Suhu Air',
    unit: '°C',
    getStatus: (v: number) => (v >= 25 && v <= 30 ? 'Ideal' : 'Perhatian'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
      </svg>
    ),
  },
  {
    key: 'visibility',
    label: 'Visibilitas',
    unit: 'm',
    getStatus: (v: number) => (v >= 15 ? 'Baik' : 'Perhatian'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    key: 'ph',
    label: 'pH Air',
    unit: '',
    getStatus: (v: number) => (v >= 7.5 && v <= 8.5 ? 'Normal' : 'Perhatian'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
        <path d="M8.5 2h7" />
      </svg>
    ),
  },
  {
    key: 'windSpeed',
    label: 'Angin',
    unit: 'km/h',
    getStatus: (v: number) => (v < 20 ? 'Normal' : 'Kencang'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
        <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
        <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
      </svg>
    ),
  },
];

function getStatusType(status: string) {
  return ['Aman', 'Ideal', 'Baik', 'Normal'].includes(status) ? 'ok' : 'warn';
}

export default function DesktopSensorStrip() {
  const [data, setData] = useState<DocumentData | undefined>();

  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, 'monitoring_data', 'bunaken_latest');
    const unsub = onSnapshot(docRef, (snap) => setData(snap.data()));
    return () => unsub();
  }, []);

  return (
    <section className="bg-shore-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-navy">Kondisi Laut</h2>
            <span className="inline-flex items-center gap-1.5 rounded-xs border border-teal-200 bg-teal-50 px-2.5 py-1 text-2xs font-medium text-teal-600">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Real-time
            </span>
          </div>
          <button className="btn-ghost px-4 py-2 text-xs">
            Lihat Detail
          </button>
        </div>

        {/* Sensor grid */}
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {sensors.map((s, i) => {
            const value = data?.[s.key];
            const numVal = typeof value === 'number' ? value : null;
            const status = numVal !== null ? s.getStatus(numVal) : '—';
            const statusType = getStatusType(status);

            return (
              <div
                key={s.key}
                className="card group cursor-default flex flex-col gap-3 p-5 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-shore-100 text-navy-soft group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors duration-short">
                    {s.icon}
                  </div>
                  <span
                    className={clsx(
                      'rounded-xs px-2.5 py-1 text-2xs font-medium',
                      statusType === 'ok'
                        ? 'bg-teal-50 text-teal-600'
                        : 'bg-warn-soft text-warn'
                    )}
                  >
                    {status}
                  </span>
                </div>

                <div>
                  <span className="text-2xs text-navy-soft">
                    {s.label}
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-semibold text-navy tracking-tight">
                      {numVal !== null ? numVal.toFixed(1) : '—'}
                    </span>
                    {s.unit && (
                      <span className="text-xs text-navy-soft">{s.unit}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
