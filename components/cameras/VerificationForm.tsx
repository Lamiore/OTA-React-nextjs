'use client';

import { useState } from 'react';
import { submitRoleRequest, type RoleVerification } from '@/lib/firestore';
import { AGREEMENT, LAND_RIGHTS, validateRoleRequest } from '@/lib/verification';
import { useLang } from '@/lib/useLang';

interface Props {
  uid: string;
  /** Data pengajuan sebelumnya (prefill saat ajukan ulang setelah ditolak). */
  initial?: RoleVerification;
  title?: string;
  description?: string;
}

export default function VerificationForm({ uid, initial, title, description }: Props) {
  const { t } = useLang();
  const agreement = AGREEMENT.pengelola;
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [organization, setOrganization] = useState(initial?.organization ?? '');
  // Destinasi ditulis bebas, bukan dipilih dari daftar: dokumennya baru dibuat
  // saat pengajuan disetujui, jadi tidak ada yang bisa dipilih lebih dulu.
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [destinationLocation, setDestinationLocation] = useState(
    initial?.destinationLocation ?? ''
  );
  const [destinationDescription, setDestinationDescription] = useState(
    initial?.destinationDescription ?? ''
  );
  const [landRights, setLandRights] = useState(initial?.landRights ?? '');
  const [declaredRights, setDeclaredRights] = useState(false);
  const [shippingAddress, setShippingAddress] = useState(initial?.shippingAddress ?? '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? '');
  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState(initial?.recipientPhone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Selalu mulai false, termasuk saat ajukan ulang setelah ditolak: isi
  // perjanjian bisa sudah berubah sejak pengajuan sebelumnya.
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateRoleRequest({
      fullName,
      phone,
      organization,
      destination,
      destinationLocation,
      destinationDescription,
      landRights,
      declaredRights,
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
        // agreedAt tidak dikirim dari sini — submitRoleRequest yang
        // menstempelnya dengan serverTimestamp() begitu agreementVersion ada.
        agreementVersion: agreement.version,
        destination: destination.trim(),
        destinationLocation: destinationLocation.trim(),
        destinationDescription: destinationDescription.trim(),
        landRights,
        // Disimpan, bukan cuma divalidasi: Pasal 2 ayat 4 memakai pernyataan
        // ini sebagai dasar pencabutan, jadi harus ada jejaknya.
        declaredRights: true,
        shippingAddress: shippingAddress.trim(),
        postalCode: postalCode.trim(),
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
      });
      // Tidak reset/pindah view di sini: PengelolaRequest berpindah ke kartu
      // status pending begitu onSnapshot dokumen user menerima perubahan.
    } catch {
      setError('verifyForm.submitFailed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-md border border-shore-200 bg-surface px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal-400';

  return (
    <div className="card p-6">
      {/* Default judul/keterangan diambil dari kamus di sini, bukan di daftar
          parameter — nilai bawaan parameter tidak bisa memanggil hook. */}
      <h2 className="font-serif text-lg font-medium text-navy">{title ?? t('verifyForm.title')}</h2>
      <p className="text-sm text-navy-soft mt-2 leading-relaxed">
        {description ?? t('verifyForm.desc')}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-navy mb-1.5">{t('auth.fullName')}</label>
          <input aria-label={t('auth.fullName')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('verifyForm.namePlaceholder')}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1.5">{t('verifyForm.phone')}</label>
          <input aria-label={t('verifyForm.phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy mb-1.5">{t('verifyForm.org')}</label>
          <input aria-label={t('verifyForm.org')}
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder={t('verifyForm.orgPlaceholder')}
            className={inputClass}
          />
        </div>

        <div className="rounded-md border border-shore-200 bg-shore-50/60 p-4 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-navy">{t('verifyForm.proposedDest')}</h3>
            <p className="text-2xs text-navy-soft mt-1 leading-relaxed">
              {t('verifyForm.proposedDestHint')}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('verifyForm.destName')}</label>
            <input aria-label={t('verifyForm.destName')}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={t('verifyForm.destNamePlaceholder')}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('verifyForm.destLocation')}</label>
            <input aria-label={t('verifyForm.destLocation')}
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
              placeholder={t('verifyForm.destLocationPlaceholder')}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('verifyForm.destDesc')}</label>
            <textarea aria-label={t('verifyForm.destDesc')}
              value={destinationDescription}
              onChange={(e) => setDestinationDescription(e.target.value)}
              rows={3}
              placeholder={t('verifyForm.destDescPlaceholder')}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">
              {t('verifyForm.landRights')}
            </label>
            <select aria-label={t('verifyForm.landRights')}
              value={landRights}
              onChange={(e) => setLandRights(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">{t('verifyForm.pickLandRights')}</option>
              {LAND_RIGHTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="text-2xs text-navy-soft mt-1.5 leading-relaxed">
              {t('verifyForm.landRightsHint')}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-shore-200 bg-shore-50/60 p-4 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-navy">{t('verifyForm.shipping')}</h3>
            <p className="text-2xs text-navy-soft mt-1 leading-relaxed">
              {t('verifyForm.shippingHint')}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('verifyForm.shipAddress')}</label>
            <textarea aria-label={t('verifyForm.shipAddress')}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              rows={3}
              placeholder={t('verifyForm.shipAddressPlaceholder')}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('verifyForm.postalCode')}</label>
            <input aria-label={t('verifyForm.postalCode')}
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
                {t('verifyForm.recipientName')} <span className="font-normal text-navy-soft">{t('verifyForm.optional')}</span>
              </label>
              <input aria-label={t('verifyForm.recipientName')}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={fullName.trim() || t('verifyForm.sameAsApplicant')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy mb-1.5">
                {t('verifyForm.recipientPhone')} <span className="font-normal text-navy-soft">{t('verifyForm.optional')}</span>
              </label>
              <input aria-label={t('verifyForm.recipientPhone')}
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                inputMode="tel"
                placeholder={phone.trim() || t('verifyForm.sameAsApplicant')}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-2xs text-navy-soft leading-relaxed">
            {t('verifyForm.recipientNote')}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={declaredRights}
            onChange={(e) => setDeclaredRights(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
          />
          <span className="text-xs leading-relaxed text-navy-soft">
            {t('verifyForm.declareRights')}
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
          />
          <span className="text-xs leading-relaxed text-navy-soft">
            {t('verifyForm.readAgreed')}{' '}
            <a
              href={agreement.path}
              target="_blank"
              rel="noopener"
              className="font-medium text-teal-700 underline underline-offset-2"
            >
              {agreement.label}
            </a>
            {t('verifyForm.agreeTailPengelola')}
          </span>
        </label>

        {/* `error` menyimpan kunci kamus, bukan kalimat jadi. */}
        {error && <p className="text-xs text-danger">{t(error)}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full px-6 py-3 text-sm disabled:opacity-50"
        >
          {submitting ? t('verifyForm.submitting') : t('verifyForm.submitPengelola')}
        </button>
      </form>
    </div>
  );
}
