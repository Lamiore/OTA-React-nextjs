'use client';

import { useEffect, useState } from 'react';
import {
  subscribeDestinations,
  submitRoleRequest,
  type Destination,
  type MitraVerification,
} from '@/lib/firestore';
import { AGREEMENT, validateRoleRequest } from '@/lib/verification';

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
  const agreement = AGREEMENT[requestedRole];
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [organization, setOrganization] = useState(initial?.organization ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [shippingAddress, setShippingAddress] = useState(initial?.shippingAddress ?? '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? '');
  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState(initial?.recipientPhone ?? '');
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
      shippingAddress,
      postalCode,
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
        agreementVersion: agreement.version,
        ...(isPengelola && {
          destination,
          shippingAddress: shippingAddress.trim(),
          postalCode: postalCode.trim(),
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
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
          <div className="rounded-md border border-shore-200 bg-shore-50/60 p-4 space-y-4">
            <div>
              <h3 className="text-xs font-medium text-navy">Pengiriman Paket Sensor</h3>
              <p className="text-2xs text-navy-soft mt-1 leading-relaxed">
                Paket sensor dikirim ke alamatmu, tidak dipasang di tempat oleh
                petugas. Panduan pemasangan dan koordinasi jadwal dilakukan lewat
                WhatsApp ke nomor di atas.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-navy mb-1.5">Alamat Pengiriman</label>
              <textarea aria-label="Alamat Pengiriman"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={3}
                placeholder="Jalan & no., RT/RW, kelurahan, kecamatan, kota/kabupaten, provinsi — sebutkan juga patokan terdekat"
                className={`${inputClass} resize-y`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy mb-1.5">Kode Pos</label>
              <input aria-label="Kode Pos"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                inputMode="numeric"
                maxLength={5}
                placeholder="95371"
                className={inputClass}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-navy mb-1.5">
                  Nama Penerima <span className="font-normal text-navy-soft">(opsional)</span>
                </label>
                <input aria-label="Nama Penerima"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={fullName.trim() || 'Sama dengan pendaftar'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy mb-1.5">
                  No. HP Penerima <span className="font-normal text-navy-soft">(opsional)</span>
                </label>
                <input aria-label="No. HP Penerima"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  inputMode="tel"
                  placeholder={phone.trim() || 'Sama dengan pendaftar'}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-2xs text-navy-soft leading-relaxed">
              Kosongkan kolom penerima kalau kamu sendiri yang menerima paketnya.
            </p>
          </div>
        )}

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
              href={agreement.path}
              target="_blank"
              rel="noopener"
              className="font-medium text-teal-700 underline underline-offset-2"
            >
              {agreement.label}
            </a>
            {isPengelola
              ? ', termasuk kewajiban membeli paket sensor dari Nusa dan pembayaran pengunjung yang diterima langsung oleh pengelola.'
              : ', termasuk kewajiban membeli kamera dari Nusa dan pemasangannya oleh petugas Nusa.'}
          </span>
        </label>

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
