'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { User } from 'firebase/auth';
import {
  addCamera,
  cameraStatus,
  deleteCamera,
  distinctLocations,
  subscribeCameraServerUrl,
  subscribeDestinations,
  subscribeMyCameras,
  type Camera,
  type Destination,
} from '@/lib/firestore';
import CameraLiveModal from './CameraLiveModal';
import ServerAddressCard from './ServerAddressCard';

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export default function CameraManager({ user }: { user: User }) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [serverUrl, setServerUrl] = useState('');

  // Form tambah kamera — cukup nama + wilayah; ID stream digenerate otomatis.
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [liveCamera, setLiveCamera] = useState<Camera | null>(null);
  const [deletingCamera, setDeletingCamera] = useState<Camera | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Portal modal ke <body> (pola BookingHistory — lepas dari wrapper ber-transform).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const unsub = subscribeMyCameras(user.uid, (data) => {
      setCameras(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    const unsub = subscribeDestinations((data: Destination[]) =>
      setRegions(distinctLocations(data)),
    );
    return () => unsub();
  }, []);

  useEffect(() => subscribeCameraServerUrl(setServerUrl), []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) {
      setError('Nama kamera wajib diisi.');
      return;
    }
    if (!location) {
      setError('Pilih wilayah kamera.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await addCamera({
        name: nm,
        location: location,
        ownerUid: user.uid,
        ownerName: user.displayName ?? '',
        ownerEmail: user.email ?? '',
      });
      setName('');
      setLocation('');
    } catch {
      setError('Gagal menyimpan kamera. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCamera) return;
    setDeleting(true);
    try {
      await deleteCamera(deletingCamera.id);
      setDeletingCamera(null);
    } finally {
      setDeleting(false);
    }
  };

  const inputClass =
    'w-full rounded-md border border-shore-200 bg-surface px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal-400';

  return (
    <>
      {liveCamera && <CameraLiveModal camera={liveCamera} onClose={() => setLiveCamera(null)} />}

      {/* Konfirmasi hapus — portal ke <body> */}
      {mounted && deletingCamera && createPortal(
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div className="absolute inset-0 bg-shore-50/60 backdrop-blur-lg" onClick={() => !deleting && setDeletingCamera(null)} />
          <div className="relative flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-sm card p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-serif text-lg font-medium text-navy text-center">Hapus Kamera?</h2>
              <p className="text-sm text-navy-soft text-center mt-2">
                Kamera <span className="font-medium text-navy">{deletingCamera.name}</span> akan
                dihapus dan tidak bisa dikembalikan.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeletingCamera(null)}
                  disabled={deleting}
                  className="btn-ghost flex-1 px-4 py-2.5 text-sm"
                >
                  Kembali
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-md px-4 py-2.5 text-sm font-medium bg-danger text-white hover:bg-danger transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                >
                  {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <div className="mb-4">
        <ServerAddressCard />
      </div>

      {/* Daftar kamera */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="h-4 w-2/3 rounded-full bg-shore-100" />
              <div className="h-3 w-1/2 rounded-full bg-shore-100" />
            </div>
          ))
        ) : cameras.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">Belum ada kamera. Tambahkan kamera pertamamu.</p>
          </div>
        ) : (
          cameras.map((c) => {
            const status = cameraStatus(c);
            const isPush = (c.source ?? 'push').trim().toLowerCase() === 'push';
            const broadcastUrl = serverUrl ? `${serverUrl.replace(/\/+$/, '')}/broadcast/${c.cameraId}` : '';
            return (
              <div key={c.id} className="card p-5 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-navy truncate">{c.name}</p>
                    <p className="text-xs text-navy-soft mt-1 truncate">
                      ID: {c.cameraId}
                      {c.location && ` — ${c.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {status === 'pending' && (
                      <span className="rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn">Menunggu admin</span>
                    )}
                    {status === 'rejected' && (
                      <span className="rounded-sm bg-danger-soft px-2.5 py-1 text-2xs font-medium text-danger">Ditolak</span>
                    )}
                    {status === 'approved' && (
                      <span className="rounded-sm bg-teal-50 px-2.5 py-1 text-2xs font-medium text-teal-600">Disetujui</span>
                    )}
                    <button
                      onClick={() => setDeletingCamera(c)}
                      className="h-8 w-8 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:border-danger-rule hover:text-danger transition-colors"
                      aria-label={`Hapus ${c.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {status === 'pending' && (
                  <p className="mt-4 text-xs text-navy-soft leading-relaxed rounded-md bg-shore-50 px-4 py-3">
                    Kamera menunggu persetujuan admin di server. Setelah disetujui, QR
                    untuk mulai siaran dari HP akan muncul di sini.
                  </p>
                )}

                {status === 'rejected' && (
                  <p className="mt-4 text-xs text-navy-soft leading-relaxed rounded-md bg-danger-soft/60 px-4 py-3">
                    Pengajuan kamera ditolak admin. Hapus kamera ini lalu daftarkan ulang
                    bila perlu.
                  </p>
                )}

                {status === 'approved' && isPush && broadcastUrl && (
                  <div className="mt-4 flex flex-col items-center gap-3 rounded-md bg-shore-50 px-4 py-5 sm:flex-row sm:items-center sm:gap-5">
                    <div className="shrink-0 rounded-md bg-white p-2.5">
                      <QRCodeSVG value={broadcastUrl} size={116} />
                    </div>
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-sm font-medium text-navy">Mulai siaran dari HP</p>
                      <p className="text-xs text-navy-soft mt-1 leading-relaxed">
                        Scan QR ini pakai kamera HP, atau buka link siaran di HP lalu izinkan
                        akses kamera. Biarkan halaman siaran tetap terbuka.
                      </p>
                      <a
                        href={broadcastUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs font-medium text-teal-600 hover:text-teal-700 break-all"
                      >
                        Buka halaman siaran ↗
                      </a>
                    </div>
                  </div>
                )}

                {status === 'approved' && (
                  <button
                    onClick={() => setLiveCamera(c)}
                    className="btn-primary w-full px-4 py-2 text-xs mt-4"
                  >
                    Lihat Live
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Form tambah kamera */}
      <div className="card p-6 mt-4">
        <h2 className="font-serif text-lg font-medium text-navy">Tambah Kamera</h2>
        <p className="text-xs text-navy-soft mt-1 leading-relaxed">
          Daftarkan kamera dari sini. Admin akan memvalidasi di server, lalu QR untuk
          siaran dari HP muncul otomatis di daftar di atas.
        </p>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">Nama Kamera</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Misal: Kamera Dermaga Bunaken"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">Wilayah</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
            >
              <option value="">Pilih wilayah…</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="text-2xs text-navy-soft mt-1.5">
              Wilayah menentukan pengelola mana yang bisa memantau kamera ini.
              Detail titik pasang taruh di nama kamera.
            </p>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full px-6 py-3 text-sm disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Tambah Kamera'}
          </button>
        </form>
      </div>
    </>
  );
}
