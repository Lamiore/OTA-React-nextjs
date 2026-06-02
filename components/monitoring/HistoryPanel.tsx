'use client';

import { useEffect, useState } from 'react';

const CAMERA_URL = process.env.NEXT_PUBLIC_CAMERA_URL || '';

interface HistoryItem {
  jenis: string;
  kesehatan: string;
  waktu: number; // epoch seconds from app_web.py
}

interface HistoryResponse {
  total: number;
  count: number;
  history: HistoryItem[];
}

const HEALTH_BADGE: Record<string, { label: string; cls: string }> = {
  'Sehat':               { label: 'Sehat',          cls: 'bg-teal-50 text-teal-700' },
  'Kurang Sehat':        { label: 'Kurang Sehat',    cls: 'bg-amber-50 text-amber-700' },
  'Mengalami Pemutihan': { label: 'Pemutihan',       cls: 'bg-red-50 text-red-700' },
  'Tidak Diketahui':     { label: 'Tidak Diketahui', cls: 'bg-shore-100 text-navy-soft' },
};

const formatJenis = (jenis: string) => jenis.replace(/_/g, ' ');

const formatWaktu = (waktu: number) =>
  new Date(waktu * 1000).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export default function HistoryPanel() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    if (!CAMERA_URL) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${CAMERA_URL}/history`);
        if (!res.ok) throw new Error();
        const json: HistoryResponse = await res.json();
        setData(json);
        setLastUpdate(Date.now());
        setError(false);
      } catch {
        setError(true);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!CAMERA_URL) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div className="text-left">
          <h2 className="font-serif text-2xl font-medium text-navy">Riwayat Deteksi</h2>
          <p className="mt-1 text-sm text-navy-soft">Log deteksi terbaru langsung dari server AI (app_web.py)</p>
        </div>
        {lastUpdate && !error && (
          <span className="chip chip-active">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        )}
      </div>

      {error && !data && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface px-6 py-8 text-center text-sm text-navy-soft">
          Tidak bisa terhubung ke server Python. Pastikan{' '}
          <code className="rounded bg-teal-50 px-1 text-teal-600">app_web.py</code> berjalan.
        </div>
      )}

      {(data || !error) && (
        <div className="card mt-6 p-5">
          {/* Total kumulatif */}
          <div className="mb-4 flex items-baseline gap-2 border-b border-border pb-4">
            <span className="text-3xl font-semibold text-navy">
              {data ? data.total.toLocaleString('id-ID') : '—'}
            </span>
            <span className="text-[12px] text-navy-soft">total deteksi tercatat</span>
          </div>

          {/* Daftar deteksi terbaru */}
          {data && data.history.length > 0 ? (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {data.history.map((item, idx) => {
                const badge = HEALTH_BADGE[item.kesehatan] ?? HEALTH_BADGE['Tidak Diketahui'];
                return (
                  <li
                    key={`${item.waktu}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-shore-50"
                  >
                    <span className="w-16 shrink-0 font-mono text-[12px] text-navy-soft">
                      {formatWaktu(item.waktu)}
                    </span>
                    <span className="min-w-0 flex-1 truncate capitalize text-navy">
                      {formatJenis(item.jenis)}
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-[12px] text-navy-soft">Belum ada deteksi tercatat</p>
          )}

          <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-navy-soft">
            Catatan: status kesehatan masih estimasi kasar berdasarkan kecerahan gambar — belum
            tervalidasi sebagai data kesehatan karang yang akurat.
          </p>
        </div>
      )}
    </div>
  );
}
