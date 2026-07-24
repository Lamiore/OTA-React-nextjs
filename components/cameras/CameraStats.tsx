'use client';

import { useEffect, useState } from 'react';

/**
 * Statistik deteksi karang untuk SATU kamera. Dipindah dari halaman Monitoring
 * (dulu StatsPanel global) menjadi per-kamera: `url` sudah lengkap
 * (server + /stats/<id>) dari resolveDetectionUrl. Kosong → tidak dirender.
 */

interface Stats {
  total: number;
  by_health: Record<string, number>;
  by_jenis: Record<string, number>;
}

const HEALTH_CONFIG: Record<string, { label: string; color: string; bar: string; dot: string }> = {
  'Sehat':               { label: 'Sehat',        color: 'text-teal-600',  bar: 'bg-teal-500',  dot: 'bg-teal-500' },
  'Kurang Sehat':        { label: 'Kurang Sehat',  color: 'text-warn', bar: 'bg-star', dot: 'bg-star' },
  'Mengalami Pemutihan': { label: 'Pemutihan',     color: 'text-danger',   bar: 'bg-danger',   dot: 'bg-danger' },
};

const HEALTH_ORDER = ['Sehat', 'Kurang Sehat', 'Mengalami Pemutihan'];

export default function CameraStats({ url }: { url: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    let active = true;

    const fetchStats = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data: Stats = await res.json();
        if (!active) return;
        setStats(data);
        setError(false);
      } catch {
        if (active) setError(true);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [url]);

  if (!url) return null;

  const topJenis = stats
    ? Object.entries(stats.by_jenis).sort((a, b) => b[1] - a[1]).slice(0, 4)
    : [];
  const maxJenis = topJenis[0]?.[1] ?? 1;

  return (
    <div>
      <h3 className="text-sm font-semibold text-navy">
        Statistik Deteksi
      </h3>

      {error && !stats ? (
        <p className="mt-2 rounded-md border border-dashed border-shore-200 bg-surface px-4 py-3 text-xs text-navy-soft">
          Belum ada data deteksi. Statistik terkumpul selama kamera ditonton.
        </p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {/* Total */}
          <div className="rounded-md border border-shore-200 bg-surface p-4">
            <p className="text-2xl font-semibold text-navy">
              {stats ? stats.total.toLocaleString('id-ID') : '—'}
            </p>
            <p className="mt-0.5 text-2xs text-navy-soft">Total karang terdeteksi</p>
          </div>

          {/* Status kesehatan */}
          <div className="rounded-md border border-shore-200 bg-surface p-4">
            <p className="mb-2.5 text-xs font-medium text-navy">Status Kesehatan</p>
            {stats && stats.total > 0 ? (
              <div className="space-y-2">
                {HEALTH_ORDER.map((key) => {
                  const count = stats.by_health[key] ?? 0;
                  const pct = Math.round((count / stats.total) * 100);
                  const cfg = HEALTH_CONFIG[key];
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-2xs">
                        <span className="flex items-center gap-1.5 text-navy-soft">
                          <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        <span className={`font-medium ${cfg.color}`}>
                          {count} <span className="font-normal text-navy-soft">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-shore-100">
                        <div
                          className={`h-full rounded-full transition-colors duration-long ${cfg.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-2xs text-navy-soft">Belum ada data</p>
            )}
          </div>

          {/* Jenis karang */}
          <div className="rounded-md border border-shore-200 bg-surface p-4">
            <p className="mb-2.5 text-xs font-medium text-navy">Jenis Karang</p>
            {topJenis.length > 0 ? (
              <div className="space-y-2">
                {topJenis.map(([jenis, count]) => {
                  const pct = Math.round((count / maxJenis) * 100);
                  return (
                    <div key={jenis}>
                      <div className="mb-1 flex items-center justify-between text-2xs">
                        <span className="capitalize text-navy-soft">{jenis}</span>
                        <span className="font-medium text-navy">{count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-shore-100">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-colors duration-long"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-2xs text-navy-soft">Belum ada data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
