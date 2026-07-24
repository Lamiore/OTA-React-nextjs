'use client';

import { useState } from 'react';
import { submitMitraVerification, type MitraVerification } from '@/lib/firestore';

interface Props {
  uid: string;
  /** Data pengajuan sebelumnya (prefill saat ajukan ulang setelah ditolak). */
  initial?: MitraVerification;
}

export default function VerificationForm({ uid, initial }: Props) {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [organization, setOrganization] = useState(initial?.organization ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !organization.trim()) {
      setError('Semua kolom wajib diisi.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await submitMitraVerification(uid, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        organization: organization.trim(),
      });
      // Tidak reset/pindah view di sini: CameraSection berpindah ke kartu
      // status pending begitu onSnapshot dokumen user menerima perubahan.
    } catch {
      setError('Gagal mengirim pengajuan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-md border border-shore-200 bg-surface px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal-400';

  return (
    <div className="card p-6">
      <h2 className="font-serif text-lg font-medium text-navy">Verifikasi Akun Mitra</h2>
      <p className="text-sm text-navy-soft mt-2 leading-relaxed">
        Untuk mendaftarkan kamera, akunmu perlu diverifikasi admin terlebih dahulu.
        Lengkapi data di bawah — setelah disetujui, role akunmu naik menjadi mitra.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-navy mb-1.5">Nama Lengkap</label>
          <input aria-label="Nama Lengkap"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nama penanggung jawab"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1.5">No. HP</label>
          <input aria-label="No. HP"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1.5">Instansi/Organisasi</label>
          <input aria-label="Instansi/Organisasi"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Operator dive, resort, komunitas, ..."
            className={inputClass}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full px-6 py-3 text-sm disabled:opacity-50"
        >
          {submitting ? 'Mengirim...' : 'Ajukan Verifikasi'}
        </button>
      </form>
    </div>
  );
}
