'use client';

import { useState } from 'react';
import { addCameraViewer, removeCameraViewer, type Camera } from '@/lib/firestore';

/**
 * Daftar email yang boleh menonton satu kamera. Pengelola menambahkannya
 * setelah pembeli paket membayar — pemberian akses sengaja manual, bukan
 * otomatis dari booking, supaya pengelola yang memutuskan.
 *
 * `editable` false untuk admin: rule tulisnya bertumpu pada kepemilikan
 * (`ownerUid`), jadi tombolnya cuma akan menghasilkan permission-denied.
 */
export default function CameraViewers({
  camera,
  editable,
}: {
  camera: Camera;
  editable: boolean;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const viewers = camera.viewers ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    // Cukup cek ada "@" dan bukan di tepi: yang menentukan cocok atau tidak
    // adalah alamat email akun Firebase-nya, dan itu tidak bisa divalidasi
    // dari sini. Penyaring ini hanya menahan salah ketik yang kentara.
    if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await addCameraViewer(camera.id, email);
      setEmail('');
    } catch {
      setError('Gagal menambahkan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (target: string) => {
    setBusy(true);
    setError('');
    try {
      await removeCameraViewer(camera.id, target);
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-md border border-shore-200 bg-shore-50/60 p-4">
      <p className="text-2xs font-medium text-navy">Penonton kamera</p>
      <p className="text-2xs text-navy-soft mt-1 leading-relaxed">
        Email di daftar ini bisa melihat siaran langsung kamera di halaman
        destinasinya. Tambahkan setelah pembeli paket membayar.
      </p>

      {viewers.length === 0 ? (
        <p className="text-xs text-navy-soft mt-3">Belum ada penonton yang ditambahkan.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {viewers.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-2 rounded-sm border border-shore-200 bg-surface px-2.5 py-1 text-2xs text-navy"
            >
              {v}
              {editable && (
                <button
                  onClick={() => handleRemove(v)}
                  disabled={busy}
                  aria-label={`Hapus ${v}`}
                  className="text-navy-soft hover:text-danger transition-colors disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {editable && (
        <form onSubmit={handleAdd} className="mt-3 flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            placeholder="email@contoh.com"
            aria-label="Email penonton baru"
            className="flex-1 min-w-0 rounded-md border border-shore-200 bg-surface px-3 py-2 text-xs text-navy outline-none transition-colors focus:border-teal-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary shrink-0 px-4 py-2 text-xs disabled:opacity-50"
          >
            Tambah
          </button>
        </form>
      )}

      {error && <p className="text-2xs text-danger mt-2">{error}</p>}
    </div>
  );
}
