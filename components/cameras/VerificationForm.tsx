'use client';

import { useEffect, useState } from 'react';
import {
  subscribeDestinations,
  submitRoleRequest,
  type Destination,
  type MitraVerification,
} from '@/lib/firestore';
import {
  PENGELOLA_AGREEMENT_VERSION,
  validateRoleRequest,
} from '@/lib/verification';

interface Props {
  uid: string;
  /** Data pengajuan sebelumnya (prefill saat ajukan ulang setelah ditolak). */
  initial?: MitraVerification;
  /** Role yang diajukan; "pengelola" menambah pilihan destinasi. */
  requestedRole?: 'mitra' | 'pengelola';
  title?: string;
  description?: string;
}

export default function VerificationForm({
  uid,
  initial,
  requestedRole = 'mitra',
  title = 'Verifikasi Akun Mitra',
  description = 'Untuk mendaftarkan kamera, akunmu perlu diverifikasi admin terlebih dahulu. Lengkapi data di bawah — setelah disetujui, role akunmu naik menjadi mitra.',
}: Props) {
  const isPengelola = requestedRole === 'pengelola';
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [organization, setOrganization] = useState(initial?.organization ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Selalu mulai false, termasuk saat ajukan ulang setelah ditolak: isi
  // perjanjian bisa sudah berubah sejak pengajuan sebelumnya.
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!isPengelola) return;
    const unsub = subscribeDestinations(setDestinations);
    return () => unsub();
  }, [isPengelola]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateRoleRequest({
      fullName,
      phone,
      organization,
      requestedRole,
      destination,
      agreed,
    });
    if (invalid) {
      setError(invalid);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await submitRoleRequest(uid, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        organization: organization.trim(),
        requestedRole,
        // agreedAt tidak dikirim dari sini — submitRoleRequest yang
        // menstempelnya dengan serverTimestamp() begitu agreementVersion ada.
        ...(isPengelola && {
          destination,
          agreementVersion: PENGELOLA_AGREEMENT_VERSION,
        }),
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
      <h2 className="font-serif text-lg font-medium text-navy">{title}</h2>
      <p className="text-sm text-navy-soft mt-2 leading-relaxed">{description}</p>

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

        {isPengelola && (
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">Destinasi yang Dikelola</label>
            <select aria-label="Destinasi yang Dikelola"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">-- Pilih destinasi --</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name} — {d.location}
                </option>
              ))}
            </select>
            <p className="text-2xs text-navy-soft mt-1.5">
              Penetapan akhir destinasi tetap oleh admin setelah pengajuan disetujui.
            </p>
          </div>
        )}

        {isPengelola && (
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
            />
            <span className="text-xs leading-relaxed text-navy-soft">
              Saya sudah membaca dan menyetujui{' '}
              <a
                href="/syarat-pengelola"
                target="_blank"
                rel="noopener"
                className="font-medium text-teal-700 underline underline-offset-2"
              >
                Perjanjian Pengelola
              </a>
              , termasuk ketentuan pembelian paket sensor dan pembayaran
              pengunjung yang diterima langsung oleh pengelola.
            </span>
          </label>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full px-6 py-3 text-sm disabled:opacity-50"
        >
          {submitting ? 'Mengirim...' : isPengelola ? 'Ajukan Jadi Pengelola' : 'Ajukan Verifikasi'}
        </button>
      </form>
    </div>
  );
}
