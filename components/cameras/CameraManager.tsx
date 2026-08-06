'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { User } from 'firebase/auth';
import {
  addCamera,
  cameraStatus,
  deleteCamera,
  getUser,
  subscribeAllCameras,
  subscribeCameraServerUrl,
  subscribeDestinations,
  subscribeMyCameras,
  type Camera,
  type Destination,
} from '@/lib/firestore';
import { useLang } from '@/lib/useLang';
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

/**
 * isAdmin memutuskan dua hal sekaligus, dan memang satu hal yang sama: admin
 * melihat seluruh kamera terdaftar dan boleh mendaftarkan yang baru; pengelola
 * hanya melihat kamera atas namanya dan tidak punya form. Perannya sendiri
 * dibaca CameraSection, bukan di sini, supaya aturannya tidak dobel.
 *
 * Sejak kamera didaftarkan atas nama pengelola, daftar "milikku" tidak lagi
 * berguna buat admin — kamera yang baru saja dia daftarkan pemiliknya orang
 * lain, jadi halaman ini akan selalu kosong untuknya.
 */
export default function CameraManager({ user, isAdmin = true }: { user: User; isAdmin?: boolean }) {
  const { t } = useLang();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [serverUrl, setServerUrl] = useState('');

  // Form tambah kamera — nama + destinasi; ID stream digenerate otomatis.
  const [name, setName] = useState('');
  const [destId, setDestId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [liveCamera, setLiveCamera] = useState<Camera | null>(null);
  const [deletingCamera, setDeletingCamera] = useState<Camera | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Portal modal ke <body> (pola BookingHistory — lepas dari wrapper ber-transform).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handle = (data: Camera[]) => {
      setCameras(data);
      setLoading(false);
    };
    // Callback error wajib (pola KameraPanel): tanpa ini permission-denied —
    // mis. rules belum ke-deploy — membiarkan skeleton berputar selamanya.
    const onError = () => {
      setLoadError(true);
      setLoading(false);
    };
    const unsub = isAdmin
      ? subscribeAllCameras(handle, onError)
      : subscribeMyCameras(user.uid, handle, onError);
    return () => unsub();
  }, [isAdmin, user.uid]);

  useEffect(() => {
    const unsub = subscribeDestinations((data: Destination[]) =>
      setDestinations([...data].sort((a, b) => a.name.localeCompare(b.name))),
    );
    return () => unsub();
  }, []);

  useEffect(() => subscribeCameraServerUrl(setServerUrl), []);

  const dest = destinations.find((d) => d.id === destId);

  /**
   * Kamera didaftarkan atas nama pengelola destinasinya, bukan atas nama admin
   * yang mengisi form. Itu satu-satunya yang membuatnya muncul di Monitoring
   * pengelola: panel itu bertanya `where('ownerUid','==',uid)` — rules tidak
   * bisa dipakai menyaring, jadi kamera milik admin tidak akan pernah ikut
   * terbawa ke sana meski destinasinya benar.
   *
   * Destinasi yang belum punya pengelola tetap boleh: kameranya sementara milik
   * admin, dan tinggal didaftarkan ulang setelah pengelolanya ditetapkan.
   */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) {
      setError('camera.nameRequired');
      return;
    }
    if (!dest) {
      setError('camera.destRequired');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const manager = dest.managerUid ? await getUser(dest.managerUid) : null;
      await addCamera(
        {
          name: nm,
          location: dest.location,
          ownerUid: manager?.uid ?? user.uid,
          ownerName: manager?.name ?? user.displayName ?? '',
          ownerEmail: manager?.email ?? user.email ?? '',
        },
        dest,
      );
      setName('');
      setDestId('');
    } catch {
      setError('camera.saveFailed');
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
              <h2 className="font-serif text-lg font-medium text-navy text-center">{t('camera.deleteTitle')}</h2>
              <p className="text-sm text-navy-soft text-center mt-2">
                {t('camera.deleteBody', { name: deletingCamera.name })}
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeletingCamera(null)}
                  disabled={deleting}
                  className="btn-ghost flex-1 px-4 py-2.5 text-sm"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-md px-4 py-2.5 text-sm font-medium bg-danger text-white hover:bg-danger transition-colors disabled:opacity-50 inline-flex items-center justify-center"
                >
                  {deleting ? t('camera.deleting') : t('camera.deleteConfirm')}
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
        ) : loadError ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">{t('camera.loadFailed')}</p>
          </div>
        ) : cameras.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">{t(isAdmin ? 'camera.empty' : 'camera.emptyManager')}</p>
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
                    {/* Pemilik hanya untuk admin: daftarnya berisi kamera semua
                        pengelola, jadi tanpa baris ini dua kamera bernama sama
                        dari destinasi berbeda tidak bisa dibedakan. */}
                    {isAdmin && (
                      <p className="text-2xs text-navy-soft mt-0.5 truncate">
                        {t('camera.owner', { name: c.ownerName || c.ownerEmail || '—' })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {status === 'pending' && (
                      <span className="rounded-sm bg-warn-soft px-2.5 py-1 text-2xs font-medium text-warn">{t('camera.statusPending')}</span>
                    )}
                    {status === 'rejected' && (
                      <span className="rounded-sm bg-danger-soft px-2.5 py-1 text-2xs font-medium text-danger">{t('camera.statusRejected')}</span>
                    )}
                    {status === 'approved' && (
                      <span className="rounded-sm bg-teal-50 px-2.5 py-1 text-2xs font-medium text-teal-600">{t('camera.statusApproved')}</span>
                    )}
                    <button
                      onClick={() => setDeletingCamera(c)}
                      className="h-8 w-8 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:border-danger-rule hover:text-danger transition-colors"
                      aria-label={`${t('common.delete')} ${c.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {status === 'pending' && (
                  <p className="mt-4 text-xs text-navy-soft leading-relaxed rounded-md bg-shore-50 px-4 py-3">
                    {t('camera.pendingHint')}
                  </p>
                )}

                {status === 'rejected' && (
                  <p className="mt-4 text-xs text-navy-soft leading-relaxed rounded-md bg-danger-soft/60 px-4 py-3">
                    {t('camera.rejectedHint')}
                  </p>
                )}

                {status === 'approved' && isPush && broadcastUrl && (
                  <div className="mt-4 flex flex-col items-center gap-3 rounded-md bg-shore-50 px-4 py-5 sm:flex-row sm:items-center sm:gap-5">
                    <div className="shrink-0 rounded-md bg-white p-2.5">
                      <QRCodeSVG value={broadcastUrl} size={116} />
                    </div>
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-sm font-medium text-navy">{t('camera.broadcastTitle')}</p>
                      <p className="text-xs text-navy-soft mt-1 leading-relaxed">
                        {t('camera.broadcastHint')}
                      </p>
                      <a
                        href={broadcastUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs font-medium text-teal-600 hover:text-teal-700 break-all"
                      >
                        {t('camera.openBroadcast')}
                      </a>
                    </div>
                  </div>
                )}

                {status === 'approved' && (
                  <button
                    onClick={() => setLiveCamera(c)}
                    className="btn-primary w-full px-4 py-2 text-xs mt-4"
                  >
                    {t('camera.viewLive')}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Form tambah kamera */}
      {isAdmin && (
      <div className="card p-6 mt-4">
        <h2 className="font-serif text-lg font-medium text-navy">{t('camera.addTitle')}</h2>
        <p className="text-xs text-navy-soft mt-1 leading-relaxed">{t('camera.addHint')}</p>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('camera.nameLabel')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('camera.namePlaceholder')}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('camera.destLabel')}</label>
            <select
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
              className={inputClass}
            >
              <option value="">{t('camera.destPlaceholder')}</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.location}
                </option>
              ))}
            </select>
            <p className="text-2xs text-navy-soft mt-1.5">{t('camera.destHint')}</p>
            {dest && !dest.managerUid && (
              <p className="text-2xs text-warn mt-1.5">{t('camera.destNoManager')}</p>
            )}
          </div>

          {/* `error` menyimpan kunci kamus, bukan kalimat jadi. */}
          {error && <p className="text-xs text-danger">{t(error)}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full px-6 py-3 text-sm disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('camera.addTitle')}
          </button>
        </form>
      </div>
      )}
    </>
  );
}
