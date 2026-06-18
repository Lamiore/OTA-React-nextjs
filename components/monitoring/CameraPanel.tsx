'use client';

import { useState } from 'react';

const CAMERA_URL = process.env.NEXT_PUBLIC_CAMERA_URL || '';

const LEGEND = [
  { label: 'Sehat', color: 'bg-teal-500' },
  { label: 'Kurang Sehat', color: 'bg-amber-400' },
  { label: 'Pemutihan', color: 'bg-red-500' },
];

export default function CameraPanel() {
  const [error, setError] = useState(false);

  return (
    <div className="w-full">
      <div className="text-left">
        <h2 className="font-serif text-2xl font-medium text-navy">Kamera AI Deteksi Karang</h2>
        <p className="mt-1 text-sm text-navy-soft">Deteksi jenis &amp; kesehatan karang secara real-time</p>
      </div>

      <div className="card mt-6 overflow-hidden p-3">
        <div className="relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-ink aspect-video md:aspect-auto md:h-72">
          {!CAMERA_URL ? (
            <p className="px-6 text-center text-sm text-white/70">
              URL kamera belum diatur. Set <code className="text-teal-200">NEXT_PUBLIC_CAMERA_URL</code> di <code className="text-teal-200">.env.local</code>.
            </p>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center text-white/70">
              <p className="text-sm">Tidak bisa terhubung ke kamera.</p>
              <p className="text-[12px] text-white/50">
                Pastikan server Python (<code className="text-teal-200">app_web.py</code>) berjalan di {CAMERA_URL} dan satu jaringan.
              </p>
              <button
                onClick={() => setError(false)}
                className="mt-3 rounded-lg bg-teal-500/80 px-4 py-2 text-[12px] font-medium text-white hover:bg-teal-500 transition-colors"
              >
                Coba Hubungkan Kembali
              </button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${CAMERA_URL}/video_feed`}
              alt="Stream kamera deteksi karang"
              className="h-full w-full object-contain"
              onError={() => setError(true)}
            />
          )}

          {!error && CAMERA_URL && (
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-medium text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 px-2 py-3">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[12px] text-navy-soft">
              <span className={`h-2.5 w-2.5 rounded-full ${l.color}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
