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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      </svg>
    ),
  },
  {
    key: 'waterTemp',
    label: 'Suhu Air',
    unit: '°C',
    getStatus: (v: number) => (v >= 25 && v <= 30 ? 'Ideal' : 'Perhatian'),
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      </svg>
    ),
  },
  {
    key: 'windSpeed',
    label: 'Angin',
    unit: 'km/h',
    getStatus: (v: number) => (v < 20 ? 'Normal' : 'Kencang'),
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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

export default function SensorScroll() {
  const [data, setData] = useState<DocumentData | undefined>();

  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, 'monitoring_data', 'bunaken_latest');
    const unsub = onSnapshot(docRef, (snap) => setData(snap.data()));
    return () => unsub();
  }, []);

  return (
    <div className="bg-shore-50 pb-2">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
        <h2 className="text-sm font-semibold text-navy">Kondisi Laut</h2>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-teal-600">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          Real-time
        </span>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {sensors.map((s) => {
          const value = data?.[s.key];
          const numVal = typeof value === 'number' ? value : null;
          const status = numVal !== null ? s.getStatus(numVal) : '—';
          const statusType = getStatusType(status);

          return (
            <div
              key={s.key}
              className="min-w-[92px] shrink-0 rounded-2xl border border-shore-200/80 bg-surface p-3 flex flex-col gap-2"
            >
              {/* Icon */}
              <div className="w-7 h-7 rounded-lg bg-shore-100 flex items-center justify-center text-navy-soft">
                {s.icon}
              </div>

              <span className="text-[10px] text-navy-soft leading-tight">
                {s.label}
              </span>

              <div className="flex items-baseline gap-0.5">
                <span className="font-semibold text-[14px] text-navy tracking-tight">
                  {numVal !== null ? numVal.toFixed(1) : '—'}
                </span>
                {s.unit && (
                  <span className="text-[9px] text-navy-soft">{s.unit}</span>
                )}
              </div>

              <span
                className={clsx(
                  'text-[9px] font-medium px-1.5 py-0.5 rounded-full w-fit',
                  statusType === 'ok'
                    ? 'bg-teal-50 text-teal-600'
                    : 'bg-amber-50 text-amber-700'
                )}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
