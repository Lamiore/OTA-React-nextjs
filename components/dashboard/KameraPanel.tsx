'use client';

import { useEffect, useState } from 'react';
import {
  cameraStatus,
  subscribeAllCameras,
  subscribeCamerasByLocation,
  type Camera,
} from '@/lib/firestore';
import CameraLiveModal from '@/components/cameras/CameraLiveModal';
import ServerAddressCard from '@/components/cameras/ServerAddressCard';

interface Props {
  role: string | null;
  location: string | null;
}

export default function KameraPanel({ role, location }: Props) {
  const isPengelola = role === 'pengelola';
  const noRegion = isPengelola && !location; // pengelola tanpa wilayah → jangan tampilkan kamera apa pun

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveCamera, setLiveCamera] = useState<Camera | null>(null);

  useEffect(() => {
    // Guard: lokasi kosong tidak boleh dipakai query (akan match kamera berlokasi kosong).
    if (noRegion) {
      setCameras([]);
      setLoading(false);
      return;
    }
    const handle = (data: Camera[]) => {
      setCameras(data);
      setLoading(false);
    };
    const unsub = isPengelola
      ? subscribeCamerasByLocation(location as string, handle)
      : subscribeAllCameras(handle);
    return () => unsub();
  }, [isPengelola, noRegion, location]);

  return (
    <div className="animate-fade-in">
      {liveCamera && <CameraLiveModal camera={liveCamera} onClose={() => setLiveCamera(null)} />}

      <h1 className="font-serif text-2xl font-medium text-navy">Kamera</h1>
      <p className="mt-1 text-sm text-navy-soft">
        {isPengelola
          ? location
            ? `Wilayah ${location} — ${cameras.length} kamera`
            : 'Wilayah belum ditetapkan admin'
          : `${cameras.length} kamera terdaftar`}
      </p>

      {/* Setelan server kamera hanya untuk admin (setelan global). */}
      {!isPengelola && (
        <div className="mt-6">
          <ServerAddressCard />
        </div>
      )}

      {noRegion ? (
        <div className="card p-8 text-center mt-6">
          <p className="text-sm text-navy-soft">
            Wilayahmu belum ditetapkan admin. Hubungi admin untuk menetapkan wilayah
            agar kamera di wilayahmu muncul di sini.
          </p>
        </div>
      ) : (
        <div className={isPengelola ? 'mt-6 space-y-3' : 'mt-4 space-y-3'}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse space-y-3">
                <div className="h-4 w-2/3 rounded-full bg-shore-100" />
                <div className="h-3 w-1/2 rounded-full bg-shore-100" />
              </div>
            ))
          ) : cameras.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-navy-soft">
                Belum ada kamera terdaftar{isPengelola && location ? ` di wilayah ${location}` : ''}.
              </p>
            </div>
          ) : (
            cameras.map((c) => {
              const status = cameraStatus(c);
              return (
                <div key={c.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-navy truncate">{c.name}</p>
                      {status === 'pending' && (
                        <span className="rounded-sm bg-warn-soft px-2 py-0.5 text-2xs font-medium text-warn shrink-0">Menunggu admin</span>
                      )}
                      {status === 'rejected' && (
                        <span className="rounded-sm bg-danger-soft px-2 py-0.5 text-2xs font-medium text-danger shrink-0">Ditolak</span>
                      )}
                    </div>
                    <p className="text-xs text-navy-soft truncate mt-0.5">
                      ID: {c.cameraId}
                      {c.location && ` — ${c.location}`}
                    </p>
                    <p className="text-xs text-navy-soft truncate mt-0.5">
                      Pemilik: {c.ownerName || 'Tanpa Nama'} ({c.ownerEmail})
                    </p>
                  </div>
                  {status === 'approved' ? (
                    <button
                      onClick={() => setLiveCamera(c)}
                      className="btn-primary px-4 py-2 text-xs shrink-0"
                    >
                      Lihat Live
                    </button>
                  ) : (
                    <span className="text-xs text-navy-soft shrink-0">Belum aktif</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
