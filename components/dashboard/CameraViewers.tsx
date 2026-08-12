'use client';

import { useState } from 'react';
import {
  addCameraViewer,
  removeCameraViewer,
  setCameraPublic,
  type Camera,
} from '@/lib/firestore';

/**
 * Siapa yang boleh menonton satu kamera: publik, atau daftar email tertentu.
 *
 * Mode publik membuka kamera untuk semua pengguna yang sudah masuk — dipakai
 * untuk kamera pemandangan yang memang jadi daya tarik destinasi. Mode khusus
 * memakai daftar email; pengelola menambahkannya setelah pembeli paket membayar
 * — pemberian akses sengaja manual, bukan otomatis dari booking, supaya
 * pengelola yang memutuskan.
 *
 * Daftar emailnya tetap tersimpan selama mode publik menyala, jadi menutup
 * kamera lagi mengembalikan penonton berbayarnya utuh.
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
  const isPublic = camera.isPublic === true;

  const handleMode = async (next: boolean) => {
    if (next === isPublic) return;
    setBusy(true);
    setError('');
    try {
      await setCameraPublic(camera.id, next);
    } catch {
      setError('Gagal mengubah akses. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xs font-medium text-navy">Siapa yang boleh menonton</p>
        {editable ? (
          // Dua tombol, bukan satu sakelar: mode yang sedang berlaku kelihatan
          // langsung tanpa harus menerjemahkan posisi sakelar jadi arti.
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleMode(false)}
              disabled={busy}
              aria-pressed={!isPublic}
              className={`chip ${!isPublic ? 'chip-active' : ''} disabled:opacity-50`}
            >
              Khusus penonton
            </button>
            <button
              type="button"
              onClick={() => handleMode(true)}
              disabled={busy}
              aria-pressed={isPublic}
              className={`chip ${isPublic ? 'chip-active' : ''} disabled:opacity-50`}
            >
              Publik
            </button>
          </div>
        ) : (
          <span className="chip">{isPublic ? 'Publik' : 'Khusus penonton'}</span>
        )}
      </div>

      <p className="text-2xs text-navy-soft mt-1.5 leading-relaxed">
        {isPublic
          ? 'Siarannya tayang di halaman destinasi untuk semua pengguna yang sudah masuk. Daftar email di bawah tersimpan, tapi tidak dipakai selama mode publik menyala.'
          : 'Hanya email di daftar ini yang bisa menonton, dan siarannya muncul di halaman Monitoring milik mereka — bukan di halaman destinasi yang dilihat umum.'}
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
