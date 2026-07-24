'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveDetectionUrl, resolveStreamUrl, subscribeCameraServerUrl, type Camera } from '@/lib/firestore';
import CameraStats from './CameraStats';
import CameraHistory from './CameraHistory';

interface Props {
  camera: Camera;
  onClose: () => void;
}

/**
 * Live view stream MJPEG/HTTP via <img>, di-portal ke <body> agar lepas dari
 * container ber-transform (pola modal BookingHistory). next/image sengaja
 * tidak dipakai: stream MJPEG tidak bisa dioptimasi/di-proxy.
 *
 * URL stream disusun dari alamat server kamera (settings/cameraServer) + ID;
 * kamera lama yang masih punya streamUrl langsung tetap didukung.
 */
export default function CameraLiveModal({ camera, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null); // null = memuat
  useEffect(() => setMounted(true), []);
  useEffect(() => subscribeCameraServerUrl(setServerUrl), []);

  if (!mounted) return null;

  const src = serverUrl === null ? null : resolveStreamUrl(camera, serverUrl);
  const statsUrl = serverUrl === null ? '' : resolveDetectionUrl(camera, serverUrl, 'stats');
  const historyUrl = serverUrl === null ? '' : resolveDetectionUrl(camera, serverUrl, 'history');

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      <div className="absolute inset-0 bg-shore-50/60 backdrop-blur-lg" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto card p-5 animate-fade-up" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-medium text-navy truncate">{camera.name}</h2>
              <p className="text-xs text-navy-soft mt-0.5 truncate">
                ID: {camera.cameraId}
                {camera.location && ` — ${camera.location}`}
              </p>
            </div>
            <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-xs shrink-0">
              Tutup
            </button>
          </div>

          <div className="relative w-full aspect-video rounded-md overflow-hidden bg-ink">
            {src === null ? null : src === '' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
                <p className="text-sm">Alamat server kamera belum diatur.</p>
                <p className="text-xs text-white/50">
                  Isi kolom &quot;Alamat Server Kamera&quot; dengan alamat dari
                  website kamera, lalu buka lagi live view ini.
                </p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
                <p className="text-sm">Tidak bisa terhubung ke kamera.</p>
                <p className="text-xs text-white/50">
                  Pastikan server kamera jalan, ID benar, dan semua perangkat satu
                  jaringan. Bila aplikasi dibuka lewat HTTPS, stream http:// jaringan
                  lokal akan diblokir browser.
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

          {/* Deteksi karang per-kamera — hanya untuk kamera server (bukan streamUrl legacy) */}
          {(statsUrl || historyUrl) && (
            <div className="mt-5 space-y-4">
              {statsUrl && <CameraStats url={statsUrl} />}
              {historyUrl && <CameraHistory url={historyUrl} />}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
