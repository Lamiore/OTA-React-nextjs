'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  resolveStreamUrl,
  subscribeCameraServerUrl,
  type Camera,
} from '@/lib/firestore';

interface DestinationCameraSectionProps {
  cameraId: string;
}

export default function DestinationCameraSection({ cameraId }: DestinationCameraSectionProps) {
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null); // null = loading

  useEffect(() => {
    if (!db || !cameraId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'cameras', cameraId), (snap) => {
      if (snap.exists()) {
        setCamera({ id: snap.id, ...snap.data() } as Camera);
      } else {
        setCamera(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [cameraId]);

  useEffect(() => {
    return subscribeCameraServerUrl(setServerUrl);
  }, []);

  if (loading) {
    return (
      <div className="card p-5 sm:p-6 animate-pulse space-y-4">
        <div className="h-4 w-1/4 rounded-full bg-shore-100" />
        <div className="h-3 w-1/3 rounded-full bg-shore-100" />
        <div className="aspect-video rounded-xl bg-shore-100 w-full" />
      </div>
    );
  }

  if (!camera) return null;

  const src = serverUrl === null ? null : resolveStreamUrl(camera, serverUrl);

  return (
    <div className="card p-5 sm:p-6 animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-medium text-navy-soft uppercase tracking-wider">Kamera Live</h2>
          <p className="text-[14px] text-navy font-medium mt-0.5">{camera.name}</p>
        </div>
        <span className="chip chip-active">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Live
        </span>
      </div>

      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-ink">
        {src === null ? null : src === '' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
            <p className="text-sm">Alamat server kamera belum diatur.</p>
            <p className="text-[12px] text-white/50">
              Isi kolom &quot;Alamat Server Kamera&quot; di dashboard admin, lalu buka kembali halaman ini.
            </p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
            <p className="text-sm">Tidak bisa terhubung ke kamera.</p>
            <p className="text-[12px] text-white/50">
              Pastikan server kamera berjalan, ID benar, dan perangkat berada dalam jaringan yang sama.
            </p>
          </div>
        ) : (
          <img
            key={src}
            src={src}
            alt={`Stream ${camera.name}`}
            className="w-full h-full object-contain"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  );
}
