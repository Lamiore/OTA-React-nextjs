'use client';

import { useEffect, useState } from 'react';

/**
 * Riwayat deteksi karang untuk SATU kamera. Dipindah dari halaman Monitoring
 * (dulu HistoryPanel global) menjadi per-kamera; `url` = server + /history/<id>.
 */

interface HistoryItem {
  jenis: string;
  kesehatan: string;
  waktu: number; // epoch seconds dari server
}

interface HistoryResponse {
  total: number;
  count: number;
  history: HistoryItem[];
}

const HEALTH_BADGE: Record<string, { label: string; cls: string }> = {
  'Sehat':               { label: 'Sehat',          cls: 'bg-teal-50 text-teal-700' },
  'Kurang Sehat':        { label: 'Kurang Sehat',    cls: 'bg-warn-soft text-warn' },
  'Mengalami Pemutihan': { label: 'Pemutihan',       cls: 'bg-danger-soft text-danger' },
  'Tidak Diketahui':     { label: 'Tidak Diketahui', cls: 'bg-shore-100 text-navy-soft' },
};

const formatJenis = (jenis: string) => jenis.replace(/_/g, ' ');

const formatWaktu = (waktu: number) =>
  new Date(waktu * 1000).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export default function CameraHistory({ url }: { url: string }) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    let active = true;

    const fetchHistory = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const json: HistoryResponse = await res.json();
        if (!active) return;
        setData(json);
        setError(false);
      } catch {
        if (active) setError(true);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [url]);

  if (!url) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-navy">
        Riwayat Deteksi
      </h3>

      {error && !data ? (
        <p className="mt-2 rounded-md border border-dashed border-shore-200 bg-surface px-4 py-3 text-xs text-navy-soft">
          Belum ada deteksi. Riwayat terisi selama kamera ditonton.
        </p>
      ) : (
        <div className="mt-2 rounded-md border border-shore-200 bg-surface p-4">
          <div className="mb-3 flex items-baseline gap-2 border-b border-shore-100 pb-3">
            <span className="text-2xl font-semibold text-navy">
              {data ? data.total.toLocaleString('id-ID') : '—'}
            </span>
            <span className="text-2xs text-navy-soft">total deteksi tercatat</span>
          </div>

          {data && data.history.length > 0 ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {data.history.map((item, idx) => {
                const badge = HEALTH_BADGE[item.kesehatan] ?? HEALTH_BADGE['Tidak Diketahui'];
                return (
                  <li
                    key={`${item.waktu}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-shore-50"
                  >
                    <span className="w-16 shrink-0 font-mono text-2xs text-navy-soft">
                      {formatWaktu(item.waktu)}
                    </span>
                    <span className="min-w-0 flex-1 truncate capitalize text-sm text-navy">
                      {formatJenis(item.jenis)}
                    </span>
                    <span className={`shrink-0 rounded-xs px-2.5 py-0.5 text-2xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-4 text-center text-2xs text-navy-soft">Belum ada deteksi tercatat</p>
          )}

          <p className="mt-3 border-t border-shore-100 pt-2.5 text-2xs leading-relaxed text-navy-soft">
            Catatan: status kesehatan masih estimasi kasar berdasarkan kecerahan gambar —
            belum tervalidasi sebagai data kesehatan karang yang akurat.
          </p>
        </div>
      )}
    </div>
  );
}
