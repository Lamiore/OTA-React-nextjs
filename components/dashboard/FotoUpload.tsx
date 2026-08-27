'use client';

import { useId, useState } from 'react';
import { fotoError, uploadFoto } from '@/lib/storage';

type Props = {
  /** Daftar URL foto yang sedang tersimpan di field ini. */
  urls: string[];
  onChange: (urls: string[]) => void;
  /**
   * true  → foto baru **ditambahkan** ke daftar (galeri).
   * false → foto baru **menggantikan** yang lama (foto utama, foto item).
   */
  multiple?: boolean;
  label?: string;
  disabled?: boolean;
};

export default function FotoUpload({
  urls,
  onChange,
  multiple = false,
  label = 'Unggah foto',
  disabled = false,
}: Props) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    setBusy(true);
    try {
      const daftar = multiple ? Array.from(files) : [files[0]];
      // Ditolak sebelum satu berkas pun dikirim: kalau berkas ke-3 kebesaran,
      // dua yang pertama tidak jadi ikut naik lalu terlantar di bucket.
      const salah = daftar.map(fotoError).find(Boolean);
      if (salah) throw new Error(salah);
      const baru = await Promise.all(daftar.map(uploadFoto));
      onChange(multiple ? [...urls, ...baru] : baru);
    } catch (e) {
      // Penolakan Storage Rules sampai ke sini sebagai error biasa. Ditampilkan
      // apa adanya supaya gagal-unggah tidak pernah senyap.
      setError(e instanceof Error ? e.message : 'Foto gagal diunggah.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="h-16 w-16 rounded-sm border border-shore-200 object-cover"
              />
              <button
                type="button"
                aria-label={`Hapus foto ${i + 1}`}
                disabled={disabled || busy}
                onClick={() => onChange(urls.filter((u) => u !== url))}
                className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full border border-shore-200 bg-surface text-xs leading-none text-navy-soft hover:border-danger-rule hover:text-danger transition-colors disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label
        htmlFor={inputId}
        className={`btn-ghost inline-flex px-3 py-2 text-sm ${
          disabled || busy ? 'pointer-events-none opacity-50' : 'cursor-pointer'
        }`}
      >
        {busy ? 'Mengunggah…' : urls.length > 0 && !multiple ? 'Ganti foto' : label}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple={multiple}
        disabled={disabled || busy}
        className="sr-only"
        // Direset supaya memilih berkas yang sama dua kali tetap memicu onChange.
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {error && <p className="text-2xs text-danger">{error}</p>}
    </div>
  );
}
