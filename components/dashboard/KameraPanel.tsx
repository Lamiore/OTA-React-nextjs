'use client';

import { useEffect, useState } from 'react';
import {
  cameraStatus,
  subscribeAllCameras,
  subscribeDestinations,
  type Camera,
  type Destination,
} from '@/lib/firestore';
import CameraLiveModal from '@/components/cameras/CameraLiveModal';
import ServerAddressCard from '@/components/cameras/ServerAddressCard';

interface Props {
  role: string | null;
  uid: string;
}

export default function KameraPanel({ role, uid }: Props) {
  const isPengelola = role === 'pengelola';

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveCamera, setLiveCamera] = useState<Camera | null>(null);

  useEffect(() => {
    const unsub = subscribeDestinations(setDestinations);
    return () => unsub();
  }, []);

  const managedDestinations = destinations.filter((d) => d.managerUid === uid);
  const managedLocations = new Set(managedDestinations.map((d) => d.location));
  const noAssignment = isPengelola && managedDestinations.length === 0; // pengelola tanpa destinasi → jangan tampilkan kamera apa pun

  useEffect(() => {
    if (noAssignment) {
      setCameras([]);
      setLoading(false);
      return;
    }
    const handle = (data: Camera[]) => {
      setCameras(isPengelola ? data.filter((c) => managedLocations.has(c.location)) : data);
      setLoading(false);
    };
    const unsub = subscribeAllCameras(handle);
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPengelola, noAssignment, uid, destinations]);

  return (
    <div className="animate-fade-in">
      {liveCamera && <CameraLiveModal camera={liveCamera} onClose={() => setLiveCamera(null)} />}

      <h1 className="font-serif text-2xl font-medium text-navy">Kamera</h1>
      <p className="mt-1 text-sm text-navy-soft">
        {isPengelola
          ? managedDestinations.length > 0
            ? `Destinasi ${managedDestinations.map((d) => d.name).join(', ')} — ${cameras.length} kamera`
            : 'Destinasi belum ditetapkan admin'
          : `${cameras.length} kamera terdaftar`}
      </p>

      {/* Setelan server kamera hanya untuk admin (setelan global). */}
      {!isPengelola && (
        <div className="mt-6">
          <ServerAddressCard />
        </div>
      )}

      {noAssignment ? (
        <div className="card p-8 text-center mt-6">
          <p className="text-sm text-navy-soft">
            Destinasimu belum ditetapkan admin. Hubungi admin untuk menetapkan destinasi
            agar kamera di destinasimu muncul di sini.
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
                Belum ada kamera terdaftar{isPengelola && managedDestinations.length > 0 ? ` di destinasi ${managedDestinations.map((d) => d.name).join(', ')}` : ''}.
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
