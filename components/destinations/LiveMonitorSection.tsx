'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
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

/**
 * Ringkasan sensor IoT live untuk halaman detail destinasi yang punya stasiun fisik.
 * Sumber data global `monitoring/latest` (cuma 1 stasiun). Kamera sengaja TIDAK di sini —
 * tetap di halaman /monitoring.
 */
export default function LiveMonitorSection() {
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
      label: 'Suhu Air',
      value: fmt(data?.tempDS18),
      unit: '°C',
      color: 'bg-teal-100 text-teal-600',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
          <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
          <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
        </svg>
      ),
    },
    {
      label: 'Suhu Udara',
      value: fmt(data?.tempDHT),
      unit: '°C',
      color: 'bg-red-100 text-red-600',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-medium text-navy-soft uppercase tracking-wider">Pantau Live</h2>
          <p className="text-[14px] text-navy font-medium mt-0.5">Sensor lingkungan real-time</p>
        </div>
        <span className={`chip ${isLive ? 'chip-active' : ''}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-navy-soft'}`} />
          {!ready ? 'Menghubungkan…' : isLive ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-shore-200/80 bg-surface p-3.5">
            <div className={`h-9 w-9 rounded-lg ${m.color} flex items-center justify-center mb-2.5`}>
              {m.icon}
            </div>
            <p className="text-lg font-semibold text-navy leading-tight">
              {m.value}
              {m.unit && <span className="ml-1 text-[12px] font-normal text-navy-soft">{m.unit}</span>}
            </p>
            <p className="text-[11px] text-navy-soft mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {ageSec !== null ? (
          <p className="text-[12px] text-navy-soft">
            Diperbarui {ageSec < 5 ? 'baru saja' : `${ageSec} detik lalu`}
          </p>
        ) : (
          <span />
        )}
        <Link
          href="/monitoring"
          className="text-[13px] font-medium text-teal-600 hover:text-teal-700 transition-colors whitespace-nowrap"
        >
          Lihat monitoring lengkap →
        </Link>
      </div>
    </div>
  );
}
