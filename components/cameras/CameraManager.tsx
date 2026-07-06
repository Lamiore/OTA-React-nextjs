'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from 'firebase/auth';
import {
  addCamera,
  deleteCamera,
  subscribeMyCameras,
  type Camera,
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

  // Form tambah kamera
  const [cameraId, setCameraId] = useState('');
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = cameraId.trim();
    const nm = name.trim();
    if (!id || !nm) {
      setError('ID kamera dan nama wajib diisi.');
      return;
    }
    if (/\s/.test(id) || /^https?:\/\//i.test(id)) {
      setError('Isi ID pendek dari website kamera (misal k7x2ab), bukan URL.');
      return;
    }
    if (cameras.some((c) => c.cameraId === id)) {
      setError('ID kamera sudah terdaftar.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await addCamera({
        cameraId: id,
        name: nm,
        location: location.trim(),
        ownerUid: user.uid,
        ownerName: user.displayName ?? '',
        ownerEmail: user.email ?? '',
      });
      setCameraId('');
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
    'w-full rounded-xl border border-shore-200 bg-surface px-4 py-2.5 text-[14px] text-navy outline-none transition-colors focus:border-teal-400';

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
              <p className="text-[13px] text-navy-soft text-center mt-2">
                Kamera <span className="font-medium text-navy">{deletingCamera.name}</span> akan
                dihapus dan tidak bisa dikembalikan.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeletingCamera(null)}
                  disabled={deleting}
                  className="btn-ghost flex-1 rounded-xl px-4 py-2.5 text-[13px]"
                >
                  Kembali
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl px-4 py-2.5 text-[13px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
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
          cameras.map((c) => (
            <div key={c.id} className="card p-5 animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-navy truncate">{c.name}</p>
                  <p className="text-[12px] text-navy-soft mt-1 truncate">
                    ID: {c.cameraId}
                    {c.location && ` — ${c.location}`}
                  </p>
                </div>
                <button
                  onClick={() => setDeletingCamera(c)}
                  className="h-8 w-8 rounded-lg border border-shore-200 flex items-center justify-center text-navy-soft hover:border-red-200 hover:text-red-500 transition-colors shrink-0"
                  aria-label={`Hapus ${c.name}`}
                >
                  <TrashIcon />
                </button>
              </div>
              <button
                onClick={() => setLiveCamera(c)}
                className="btn-primary w-full rounded-xl px-4 py-2 text-[12px] mt-4"
              >
                Lihat Live
              </button>
            </div>
          ))
        )}
      </div>

      {/* Form tambah kamera */}
      <div className="card p-6 mt-4">
        <h2 className="font-serif text-lg font-medium text-navy">Tambah Kamera</h2>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-navy mb-1.5">ID Kamera</label>
            <input
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              placeholder="Misal: k7x2ab"
              className={inputClass}
            />
            <p className="text-[11px] text-navy-soft mt-1.5">
              Salin ID dari daftar kamera di website kamera.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-navy mb-1.5">Nama Kamera</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Misal: Kamera Dermaga Bunaken"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-navy mb-1.5">
              Lokasi <span className="font-normal text-navy-soft">(opsional)</span>
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Misal: Dermaga utama, Bunaken"
              className={inputClass}
            />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full rounded-xl px-6 py-3 text-[14px] disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Tambah Kamera'}
          </button>
        </form>
      </div>
    </>
  );
}
