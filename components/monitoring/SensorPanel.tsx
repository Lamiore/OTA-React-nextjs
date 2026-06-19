'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { subscribeMonitoring, type SensorReading } from '@/lib/realtime';

interface Metric {
  label: string;
  value: string;
  unit: string;
  color: string;
  icon: ReactNode;
}

function fmt(n: number | undefined, digits = 1) {
  return typeof n === 'number' && !Number.isNaN(n) ? n.toFixed(digits) : '--';
}

export default function SensorPanel() {
  const [data, setData] = useState<SensorReading | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const unsub = subscribeMonitoring((d) => {
      setData(d);
      setReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ageSec = data?.updatedAt ? Math.max(0, Math.round((now - data.updatedAt) / 1000)) : null;
  const isLive = ageSec !== null && ageSec < 15;

  const metrics: Metric[] = [
    {
      label: 'Suhu Udara',
      value: fmt(data?.tempDHT),
      unit: '°C',
      color: 'bg-red-100 text-red-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
        </svg>
      ),
    },
    {
      label: 'Kelembapan Udara',
      value: fmt(data?.humidity),
      unit: '%',
      color: 'bg-blue-100 text-blue-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z" />
        </svg>
      ),
    },
    {
      label: 'Suhu Air',
      value: fmt(data?.tempDS18),
      unit: '°C',
      color: 'bg-teal-100 text-teal-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
          <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
          <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        </svg>
      ),
    },
    {
      label: 'Kondisi Cuaca',
      value: data?.rainStatus
        ? `${data.rainStatus}${typeof data.rainValue === 'number' ? ` (${data.rainValue})` : ''}`
        : '--',
      unit: '',
      color: 'bg-purple-100 text-purple-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M16 14v6" />
          <path d="M8 14v6" />
          <path d="M12 16v6" />
        </svg>
      ),
    },
    {
      label: 'Kecepatan Angin',
      value: fmt(data?.windSpeed, 2),
      unit: 'km/h',
      color: 'bg-cyan-100 text-cyan-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
          <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
          <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
        </svg>
      ),
    },
    {
      label: 'Debit Air',
      value: fmt(data?.flowRate, 2),
      unit: 'L/min',
      color: 'bg-sky-100 text-sky-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 4.8 7 3c-.29 1.8-1.14 3.13-2.29 4.06S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05Z" />
          <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
        </svg>
      ),
    },
    {
      label: 'EC',
      value: fmt(data?.ecValue, 2),
      unit: 'ms/cm',
      color: 'bg-amber-100 text-amber-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div className="text-left">
          <h2 className="font-serif text-2xl font-medium text-navy">Sensor Lingkungan</h2>
          <p className="mt-1 text-sm text-navy-soft">Data real-time dari stasiun sensor di lapangan</p>
        </div>
        <span className={`chip ${isLive ? 'chip-active' : ''}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-white' : 'bg-navy-soft'} ${isLive ? 'animate-pulse' : ''}`} />
          {!ready ? 'Menghubungkan…' : isLive ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="card p-5 text-left">
            <div className={`h-11 w-11 rounded-xl ${m.color} flex items-center justify-center mb-3`}>
              {m.icon}
            </div>
            <p className="text-2xl font-semibold text-navy">
              {m.value}
              {m.unit && <span className="ml-1 text-sm font-normal text-navy-soft">{m.unit}</span>}
            </p>
            <p className="text-[12px] text-navy-soft mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {ageSec !== null && (
        <p className="mt-4 text-left text-[12px] text-navy-soft">
          Diperbarui {ageSec < 5 ? 'baru saja' : `${ageSec} detik lalu`}
        </p>
      )}
    </div>
  );
}
