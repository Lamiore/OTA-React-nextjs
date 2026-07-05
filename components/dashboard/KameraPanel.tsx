'use client';

import { useEffect, useState } from 'react';
import { subscribeAllCameras, type Camera } from '@/lib/firestore';
import CameraLiveModal from '@/components/cameras/CameraLiveModal';

export default function KameraPanel() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveCamera, setLiveCamera] = useState<Camera | null>(null);

  useEffect(() => {
    const unsub = subscribeAllCameras((data) => {
      setCameras(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="animate-fade-in">
      {liveCamera && <CameraLiveModal camera={liveCamera} onClose={() => setLiveCamera(null)} />}

      <h1 className="font-serif text-2xl font-medium text-navy">Kamera</h1>
      <p className="mt-1 text-sm text-navy-soft">{cameras.length} kamera terdaftar</p>

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-shore-100" />
              <div className="h-3 w-1/2 rounded-full bg-shore-100" />
            </div>
          ))
        ) : cameras.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">Belum ada kamera terdaftar.</p>
          </div>
        ) : (
          cameras.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-navy truncate">{c.name}</p>
                <p className="text-[12px] text-navy-soft truncate mt-0.5">
                  ID: {c.cameraId}
                  {c.location && ` — ${c.location}`}
                </p>
                <p className="text-[12px] text-navy-soft truncate mt-0.5">
                  Pemilik: {c.ownerName || 'Tanpa Nama'} ({c.ownerEmail})
                </p>
              </div>
              <button
                onClick={() => setLiveCamera(c)}
                className="btn-primary rounded-xl px-4 py-2 text-[12px] shrink-0"
              >
                Lihat Live
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
