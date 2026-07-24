'use client';

import { useEffect, useState } from 'react';
import {
  updateProfile,
  linkWithPopup,
  reauthenticateWithCredential,
  updatePassword,
  GoogleAuthProvider,
  EmailAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { updateUserPhone } from '@/lib/firestore';

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

function fbMessage(code: string) {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Password sekarang salah.';
    case 'auth/weak-password':
      return 'Password baru minimal 6 karakter.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi nanti.';
    case 'auth/requires-recent-login':
      return 'Sesi kedaluwarsa. Keluar lalu masuk lagi, kemudian coba ulang.';
    case 'auth/popup-closed-by-user':
      return 'Dibatalkan.';
    case 'auth/credential-already-in-use':
    case 'auth/email-already-in-use':
      return 'Akun Google itu sudah terpakai di akun lain.';
    default:
      return 'Terjadi kesalahan. Coba lagi.';
  }
}

export default function AccountSettings({ user }: { user: User }) {
  const providers = user.providerData.map((p) => p.providerId);
  const hasPassword = providers.includes('password');
  const [googleLinked, setGoogleLinked] = useState(providers.includes('google.com'));

  // ── Profil: nama + telepon ──
  const [name, setName] = useState(user.displayName ?? '');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      setPhone((snap.data()?.phone as string) ?? '');
    });
  }, [user.uid]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser) return;
    const nm = name.trim();
    if (!nm) {
      setProfileMsg({ ok: false, text: 'Nama wajib diisi.' });
      return;
    }
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      if (nm !== (user.displayName ?? '')) {
        await updateProfile(auth.currentUser, { displayName: nm });
      }
      await updateUserPhone(user.uid, phone.trim());
      setProfileMsg({ ok: true, text: 'Profil tersimpan.' });
    } catch {
      setProfileMsg({ ok: false, text: 'Gagal menyimpan. Coba lagi.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Hubungkan Google ──
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const linkGoogle = async () => {
    if (!auth?.currentUser) return;
    setLinkMsg(null);
    setLinking(true);
    try {
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      setGoogleLinked(true);
      setLinkMsg({ ok: true, text: 'Google terhubung. Lain kali bisa masuk pakai Google.' });
    } catch (err: unknown) {
      setLinkMsg({ ok: false, text: fbMessage((err as { code?: string }).code ?? '') });
    } finally {
      setLinking(false);
    }
  };

  // ── Ubah password ──
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser || !user.email) return;
    if (newPw.length < 6) {
      setPwMsg({ ok: false, text: 'Password baru minimal 6 karakter.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: 'Konfirmasi password tidak sama.' });
      return;
    }
    setPwMsg(null);
    setSavingPw(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, curPw);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPw);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ ok: true, text: 'Password berhasil diubah.' });
    } catch (err: unknown) {
      setPwMsg({ ok: false, text: fbMessage((err as { code?: string }).code ?? '') });
    } finally {
      setSavingPw(false);
    }
  };

  const banner = (m: { ok: boolean; text: string } | null) =>
    m && (
      <p
        className={`mt-3 rounded-md px-4 py-2.5 text-xs ${
          m.ok ? 'bg-teal-50 text-teal-700' : 'bg-danger-soft text-danger'
        }`}
      >
        {m.text}
      </p>
    );

  return (
    <div className="card overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-shore-200/80">
        <h2 className="font-serif text-lg font-medium text-navy">Pengaturan Akun</h2>
        <p className="text-2xs text-navy-soft mt-0.5">Kelola data akun & keamanan</p>
      </div>

      {/* Profil */}
      <form onSubmit={saveProfile} className="px-5 py-4">
        <p className="mb-3 text-sm font-semibold text-navy">Profil</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">Nama</label>
            <input aria-label="Nama" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Nama lengkap" />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy mb-1.5">Nomor Telepon</label>
            <input aria-label="Nomor Telepon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="cth: 0812-3456-7890"
              inputMode="tel"
            />
            <p className="text-2xs text-navy-soft mt-1.5">Dipakai admin untuk menghubungi kamu (mis. via WhatsApp).</p>
          </div>
        </div>
        {banner(profileMsg)}
        <button type="submit" disabled={savingProfile} className="btn-primary w-full px-4 py-2.5 text-sm mt-4 disabled:opacity-50">
          {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
        </button>
      </form>

      {/* Hubungkan Google — hanya kalau belum terhubung */}
      {!googleLinked && (
        <div className="px-5 py-4 border-t border-shore-200/80">
          <p className="mb-3 text-sm font-semibold text-navy">Akun Tertaut</p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy">Hubungkan Google</p>
              <p className="text-2xs text-navy-soft mt-0.5">Biar lain kali bisa masuk tanpa password.</p>
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
          <p className="mb-3 text-sm font-semibold text-navy">Akun Tertaut</p>
          <div className="flex items-center gap-3">
            <GoogleIcon />
            <p className="text-sm font-medium text-navy">Google terhubung</p>
            <span className="ml-auto text-teal-500"><CheckIcon /></span>
          </div>
        </div>
      )}

      {/* Ubah password — hanya untuk akun email/password */}
      {hasPassword && (
        <form onSubmit={changePassword} className="px-5 py-4 border-t border-shore-200/80">
          <p className="mb-3 text-sm font-semibold text-navy">Ubah Password</p>
          <div className="space-y-3">
            <input
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              className={inputClass}
              placeholder="Password sekarang"
              autoComplete="current-password"
              required
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className={inputClass}
              placeholder="Password baru (min. 6 karakter)"
              autoComplete="new-password"
              required
            />
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className={inputClass}
              placeholder="Konfirmasi password baru"
              autoComplete="new-password"
              required
            />
          </div>
          {banner(pwMsg)}
          <button type="submit" disabled={savingPw} className="btn-primary w-full px-4 py-2.5 text-sm mt-4 disabled:opacity-50">
            {savingPw ? 'Menyimpan...' : 'Ubah Password'}
          </button>
        </form>
      )}
    </div>
  );
}
