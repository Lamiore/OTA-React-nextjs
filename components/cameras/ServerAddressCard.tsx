'use client';

import { useEffect, useRef, useState } from 'react';
import { setCameraServerUrl, subscribeCameraServerUrl } from '@/lib/firestore';
import { useLang } from '@/lib/useLang';

/**
 * Pengaturan alamat server kamera lokal (camera-server). Disimpan di
 * Firestore (settings/cameraServer) supaya saat WiFi/IP laptop berubah cukup
 * diganti sekali di sini — semua kamera langsung mengikuti.
 */
export default function ServerAddressCard() {
  const { t } = useLang();
  const [saved, setSaved] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);

  useEffect(
    () =>
      subscribeCameraServerUrl((url) => {
        setSaved(url);
        // Isi input hanya dari snapshot pertama; setelahnya jangan menimpa ketikan.
        if (!loadedRef.current) {
          loadedRef.current = true;
          setValue(url);
        }
      }),
    [],
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(url)) {
      setError('camera.urlScheme');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await setCameraServerUrl(url);
      setValue(url);
    } catch {
      setError('camera.urlSaveFailed');
    } finally {
      setSaving(false);
    }
  };

  const dirty = value.trim().replace(/\/+$/, '') !== saved;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-base font-medium text-navy">{t('camera.serverAddress')}</h2>
        {!dirty && saved && (
          <span className="rounded-sm bg-teal-50 px-2 py-0.5 text-2xs font-medium text-teal-600">
            {t('common.saved')}
          </span>
        )}
      </div>
      <p className="text-xs text-navy-soft mt-1.5 leading-relaxed">{t('camera.serverAddressHint')}</p>
      <form onSubmit={handleSave} className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="url"
          placeholder="http://192.168.1.5:5001"
          className="min-w-0 flex-1 rounded-md border border-shore-200 bg-surface px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal-400"
        />
        <button
          type="submit"
          disabled={saving || !dirty}
          className="btn-primary px-4 py-2.5 text-sm shrink-0 disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </form>
      {/* `error` menyimpan kunci kamus, bukan kalimat jadi. */}
      {error && <p className="text-xs text-danger mt-2">{t(error)}</p>}
    </div>
  );
}
