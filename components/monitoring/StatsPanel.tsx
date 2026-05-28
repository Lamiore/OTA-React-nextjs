'use client';

import { useEffect, useState } from 'react';

const CAMERA_URL = process.env.NEXT_PUBLIC_CAMERA_URL || '';

interface Stats {
  total: number;
  by_health: Record<string, number>;
  by_jenis: Record<string, number>;
}

const HEALTH_CONFIG: Record<string, { label: string; color: string; bar: string; dot: string }> = {
  'Sehat':              { label: 'Sehat',            color: 'text-teal-600',  bar: 'bg-teal-500',  dot: 'bg-teal-500' },
  'Kurang Sehat':       { label: 'Kurang Sehat',      color: 'text-amber-600', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  'Mengalami Pemutihan':{ label: 'Pemutihan',         color: 'text-red-600',   bar: 'bg-red-500',   dot: 'bg-red-500' },
};

const HEALTH_ORDER = ['Sehat', 'Kurang Sehat', 'Mengalami Pemutihan'];

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    if (!CAMERA_URL) return;

    const fetchStats = async () => {
      try {
        const res = await fetch(`${CAMERA_URL}/stats`);
        if (!res.ok) throw new Error();
        const data: Stats = await res.json();
        setStats(data);
        setLastUpdate(Date.now());
        setError(false);
      } catch {
        setError(true);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!CAMERA_URL) return null;

  const topJenis = stats
    ? Object.entries(stats.by_jenis)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
    : [];

  const maxJenis = topJenis[0]?.[1] ?? 1;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div className="text-left">
          <h2 className="font-serif text-2xl font-medium text-navy">Statistik Deteksi Karang</h2>
          <p className="mt-1 text-sm text-navy-soft">Rekapitulasi hasil deteksi AI sejak server aktif</p>
        </div>
        {lastUpdate && (
          <span className="chip chip-active">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        )}
      </div>

      {error && !stats && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface px-6 py-8 text-center text-sm text-navy-soft">
          Tidak bisa terhubung ke server Python. Pastikan{' '}
          <code className="rounded bg-teal-50 px-1 text-teal-600">app_web.py</code> berjalan.
        </div>
      )}

      {(stats || !error) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {/* Card Total */}
          <div className="card p-5 text-left">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className="text-3xl font-semibold text-navy">
              {stats ? stats.total.toLocaleString('id-ID') : '—'}
            </p>
            <p className="mt-0.5 text-[12px] text-navy-soft">Total Karang Terdeteksi</p>
          </div>

          {/* Card Status Kesehatan */}
          <div className="card p-5 text-left">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <p className="mb-3 text-sm font-medium text-navy">Status Kesehatan</p>
            {stats && stats.total > 0 ? (
              <div className="space-y-2.5">
                {HEALTH_ORDER.map((key) => {
                  const count = stats.by_health[key] ?? 0;
                  const pct = Math.round((count / stats.total) * 100);
                  const cfg = HEALTH_CONFIG[key];
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-navy-soft">
                          <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        <span className={`font-medium ${cfg.color}`}>{count} <span className="font-normal text-navy-soft">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-shore-100">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-navy-soft">Belum ada data</p>
            )}
          </div>

          {/* Card Jenis Karang */}
          <div className="card p-5 text-left sm:col-span-2 lg:col-span-1">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10" />
                <path d="M12 12 4.93 4.93" />
                <path d="M19.07 4.93 12 12" />
                <path d="M12 12v7" />
              </svg>
            </div>
            <p className="mb-3 text-sm font-medium text-navy">Jenis Karang</p>
            {topJenis.length > 0 ? (
              <div className="space-y-2.5">
                {topJenis.map(([jenis, count]) => {
                  const pct = Math.round((count / maxJenis) * 100);
                  return (
                    <div key={jenis}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="capitalize text-navy-soft">{jenis}</span>
                        <span className="font-medium text-navy">{count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-shore-100">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-navy-soft">Belum ada data</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
