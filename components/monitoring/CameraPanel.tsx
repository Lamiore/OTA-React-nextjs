'use client';

import { useState } from 'react';

const CAMERA_URL = process.env.NEXT_PUBLIC_CAMERA_URL || '';

const LEGEND = [
  { label: 'Sehat', color: 'bg-teal-500' },
  { label: 'Kurang Sehat', color: 'bg-amber-400' },
  { label: 'Pemutihan', color: 'bg-red-500' },
];

export default function CameraPanel() {
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);

  const toggle = () => {
    setError(false);
    setActive((v) => !v);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div className="text-left">
          <h2 className="font-serif text-2xl font-medium text-navy">Kamera AI Deteksi Karang</h2>
          <p className="mt-1 text-sm text-navy-soft">Deteksi jenis &amp; kesehatan karang secara real-time</p>
        </div>
        <button
          onClick={toggle}
          className={`${active ? 'btn-ghost' : 'btn-primary'} px-5 py-2.5 text-sm`}
        >
          {active ? 'Nonaktifkan Kamera' : 'Aktifkan Kamera'}
        </button>
      </div>

      <div className="card mt-6 overflow-hidden p-3">
        <div className="relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-navy aspect-video md:aspect-auto md:h-72">
          {!CAMERA_URL ? (
            <p className="px-6 text-center text-sm text-white/70">
              URL kamera belum diatur. Set <code className="text-teal-200">NEXT_PUBLIC_CAMERA_URL</code> di <code className="text-teal-200">.env.local</code>.
            </p>
          ) : !active ? (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 16 6-6-6-6" />
                <path d="M8 8 2 14l6 6" />
                <path d="M14.5 4 9 20" />
              </svg>
              <p className="text-sm">Kamera nonaktif</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center text-white/70">
              <p className="text-sm">Tidak bisa terhubung ke kamera.</p>
              <p className="text-[12px] text-white/50">
                Pastikan server Python (<code className="text-teal-200">app_web.py</code>) berjalan di {CAMERA_URL} dan satu jaringan.
              </p>
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

          {active && !error && CAMERA_URL && (
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
