'use client';

import { useEffect, useState } from 'react';
import {
  updateProfile,
  linkWithPopup,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { updateUserProfile } from '@/lib/firestore';
import { kelengkapanProfil, nikBerbentukSah } from '@/lib/profile';
import { useLang } from '@/lib/useLang';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const inputClass =
  'w-full rounded-md border border-shore-200 bg-surface px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal-400';

/** Kode error Firebase → kunci kamus; diterjemahkan saat dirender. */
function fbMessageKey(code: string) {
  switch (code) {
    case 'auth/too-many-requests':
      return 'account.tooManyAttempts';
    case 'auth/requires-recent-login':
      return 'account.sessionExpired';
    case 'auth/popup-closed-by-user':
      return 'account.cancelled';
    case 'auth/credential-already-in-use':
    case 'auth/email-already-in-use':
      return 'account.googleInUse';
    default:
      return 'common.error';
  }
}

export default function AccountSettings({ user }: { user: User }) {
  const { t } = useLang();
  const providers = user.providerData.map((p) => p.providerId);
  const [googleLinked, setGoogleLinked] = useState(providers.includes('google.com'));

  // ── Profil: nama + telepon + kota + NIK ──
  const [name, setName] = useState(user.displayName ?? '');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [nik, setNik] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; key: string } | null>(null);

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      setPhone((snap.data()?.phone as string) ?? '');
      setCity((snap.data()?.city as string) ?? '');
      setNik((snap.data()?.nik as string) ?? '');
    });
  }, [user.uid]);

  /**
   * Dihitung dari isi kolom yang SEDANG diketik, bukan dari yang tersimpan:
   * batangnya bergerak sambil mengetik, jadi jelas kolom mana yang menaikkannya.
   * Rumusnya sama dengan yang dipakai lonceng notifikasi — lihat lib/profile.
   */
  const lengkap = kelengkapanProfil({ name, phone, city, nik, emailVerified: user.emailVerified });

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser) return;
    const nm = name.trim();
    if (!nm) {
      setProfileMsg({ ok: false, key: 'account.nameRequired' });
      return;
    }
    // Kosong tetap boleh disimpan — NIK memang tidak wajib, cuma salah satu
    // syarat kelengkapan. Yang ditolak adalah yang diisi tapi bukan 16 angka:
    // menyimpannya diam-diam berarti batangnya tidak naik dan tidak ada satu
    // pun petunjuk kenapa.
    if (nik.trim() && !nikBerbentukSah(nik)) {
      setProfileMsg({ ok: false, key: 'account.nikInvalid' });
      return;
    }
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      if (nm !== (user.displayName ?? '')) {
        await updateProfile(auth.currentUser, { displayName: nm });
      }
      await updateUserProfile(user.uid, {
        phone: phone.trim(),
        city: city.trim(),
        nik: nik.trim(),
      });
      setProfileMsg({ ok: true, key: 'account.profileSaved' });
    } catch {
      setProfileMsg({ ok: false, key: 'common.saveFailed' });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Hubungkan Google ──
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; key: string } | null>(null);

  const linkGoogle = async () => {
    if (!auth?.currentUser) return;
    setLinkMsg(null);
    setLinking(true);
    try {
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      setGoogleLinked(true);
      setLinkMsg({ ok: true, key: 'account.googleLinkedOk' });
    } catch (err: unknown) {
      setLinkMsg({ ok: false, key: fbMessageKey((err as { code?: string }).code ?? '') });
    } finally {
      setLinking(false);
    }
  };

  // Kartu "Ubah Password" dihapus bersama login password: masuk sekarang hanya
  // lewat kode email atau Google, jadi password (kalau akun lama masih punya)
  // tidak dipakai apa pun dan mengubahnya tidak mengubah keamanan akun.

  // Pesan disimpan sebagai kunci kamus, diterjemahkan di sini — supaya ganti
  // bahasa saat banner sedang tampil ikut mengganti isinya.
  const banner = (m: { ok: boolean; key: string } | null) =>
    m && (
      <p
        className={`mt-3 rounded-md px-4 py-2.5 text-xs ${
          m.ok ? 'bg-teal-50 text-teal-700' : 'bg-danger-soft text-danger'
        }`}
      >
        {t(m.key)}
      </p>
    );

  return (
    <div className="card overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-shore-200/80">
        <h2 className="font-serif text-lg font-medium text-navy">{t('account.title')}</h2>
        <p className="text-2xs text-navy-soft mt-0.5">{t('account.subtitle')}</p>
      </div>

      {/* Profil */}
      <form onSubmit={saveProfile} className="px-5 py-4">
        <p className="mb-3 text-sm font-semibold text-navy">{t('account.profile')}</p>

        {/* Kelengkapan profil. Tetap ditampilkan setelah 100% — hilang begitu
            lengkap malah membuat orang mengira bagian ini rusak; yang berhenti
            mengganggu cuma lonceng di navbar. */}
        <div className="mb-4 rounded-md border border-shore-200 bg-shore-50 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-navy">{t('complete.title')}</p>
            <p className="text-sm font-semibold text-navy">{lengkap.persen}%</p>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-shore-200"
            role="progressbar"
            aria-valuenow={lengkap.persen}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('complete.title')}
          >
            <div
              className="h-full rounded-full bg-teal-500 transition-all duration-long"
              style={{ width: `${lengkap.persen}%` }}
            />
          </div>
          <ul className="mt-2.5 space-y-1">
            {lengkap.items.map((it) => (
              <li key={it.key} className="flex items-center gap-2 text-2xs">
                <span
                  aria-hidden
                  className={
                    it.done
                      ? 'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white'
                      : 'h-3.5 w-3.5 shrink-0 rounded-full border border-shore-300'
                  }
                >
                  {it.done && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className={it.done ? 'text-navy-soft line-through' : 'text-navy'}>
                  {t(it.key)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('account.name')}</label>
            <input aria-label={t('account.name')} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder={t('auth.fullNamePlaceholder')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('account.phone')}</label>
            <input aria-label={t('account.phone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder={t('account.phonePlaceholder')}
              inputMode="tel"
            />
            <p className="text-2xs text-navy-soft mt-1.5">{t('account.phoneHint')}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('account.city')}</label>
            <input aria-label={t('account.city')}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
              placeholder={t('account.cityPlaceholder')}
            />
            <p className="text-2xs text-navy-soft mt-1.5">{t('account.cityHint')}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">{t('account.nik')}</label>
            <input aria-label={t('account.nik')}
              value={nik}
              // Angka saja, dipotong di 16: kolom NIK yang menerima huruf cuma
              // menunda penolakannya sampai tombol simpan ditekan.
              onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
              className={inputClass}
              placeholder={t('account.nikPlaceholder')}
              inputMode="numeric"
              autoComplete="off"
            />
            <p className="text-2xs text-navy-soft mt-1.5">{t('account.nikHint')}</p>
          </div>
        </div>
        {banner(profileMsg)}
        <button type="submit" disabled={savingProfile} className="btn-primary w-full px-4 py-2.5 text-sm mt-4 disabled:opacity-50">
          {savingProfile ? t('common.saving') : t('account.saveProfile')}
        </button>
      </form>

      {/* Hubungkan Google — hanya kalau belum terhubung */}
      {!googleLinked && (
        <div className="px-5 py-4 border-t border-shore-200/80">
          <p className="mb-3 text-sm font-semibold text-navy">{t('account.linked')}</p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy">{t('account.linkGoogle')}</p>
              <p className="text-2xs text-navy-soft mt-0.5">{t('account.linkGoogleHint')}</p>
            </div>
            <button
              onClick={linkGoogle}
              disabled={linking}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-shore-200 bg-surface px-4 py-2.5 text-xs font-medium text-navy transition-colors hover:border-shore-300 disabled:opacity-50"
            >
              <GoogleIcon />
              {linking ? 'Menghubungkan...' : 'Hubungkan'}
            </button>
          </div>
          {banner(linkMsg)}
        </div>
      )}

      {googleLinked && (
        <div className="px-5 py-4 border-t border-shore-200/80">
          <p className="mb-3 text-sm font-semibold text-navy">{t('account.linked')}</p>
          <div className="flex items-center gap-3">
            <GoogleIcon />
            <p className="text-sm font-medium text-navy">{t('account.googleLinked')}</p>
            <span className="ml-auto text-teal-500"><CheckIcon /></span>
          </div>
        </div>
      )}

    </div>
  );
}
