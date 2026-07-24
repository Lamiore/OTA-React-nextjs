'use client';

import { useEffect, useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { requestVerificationEmail } from '@/lib/sendVerification';

function MailCheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" />
      <path d="m2 7 8.97 5.7a1.94 1.94 0 0 0 2.06 0L22 7" />
      <path d="m16 19 2 2 4-4" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-20" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function VerifyEmail({ user }: { user: User }) {
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Auto-detect: user klik link verifikasi di tab/HP lain. reload() ambil status
  // terbaru; kalau sudah verified, reload halaman penuh supaya gate ProfileContent
  // membaca emailVerified=true dan menampilkan ProfileView.
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        await user.reload();
        if (auth?.currentUser?.emailVerified) window.location.reload();
      } catch {
        /* transient (offline / token) — biarkan poll berikutnya */
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [user]);

  // Hitung mundur tombol kirim ulang.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const checkNow = async () => {
    setError('');
    setNotice('');
    setChecking(true);
    try {
      await user.reload();
      if (auth?.currentUser?.emailVerified) {
        window.location.reload();
        return;
      }
      setError('Belum terverifikasi. Klik dulu link di email kamu, lalu coba lagi.');
    } catch {
      setError('Gagal memeriksa. Coba lagi.');
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    if (!auth?.currentUser || cooldown > 0) return;
    setError('');
    setNotice('');
    setSending(true);
    try {
      if (!auth.currentUser.email) throw new Error('no-email');
      await requestVerificationEmail(auth.currentUser.email);
      setNotice('Email verifikasi terkirim. Cek inbox (atau folder spam).');
      setCooldown(60);
    } catch {
      setError('Gagal mengirim ulang. Coba lagi.');
    } finally {
      setSending(false);
    }
  };

  const logout = () => {
    if (auth) signOut(auth);
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-md bg-teal-500 mb-5 text-white">
        <MailCheckIcon />
      </div>

      <h2 className="font-serif text-2xl font-medium text-navy sm:text-3xl">Verifikasi email kamu</h2>
      <p className="mt-3 text-sm leading-relaxed text-navy-soft">
        Kami mengirim link verifikasi ke{' '}
        <span className="font-medium text-navy">{user.email}</span>. Klik link itu untuk
        mengaktifkan akun — langkah ini memastikan akunmu asli, bukan palsu.
      </p>

      {/* Status menunggu */}
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3.5 py-1.5 text-xs font-medium text-teal-700">
        <span className="text-teal-500"><LoadingSpinner /></span>
        Menunggu verifikasi…
      </div>

      {notice && (
        <div className="mt-4 rounded-md bg-teal-50 border border-teal-100 px-4 py-3 text-sm text-teal-700 animate-fade-up">
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-md bg-danger-soft border border-danger-rule px-4 py-3 text-sm text-danger animate-fade-up">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <button
          onClick={checkNow}
          disabled={checking}
          className="btn-primary w-full px-4 py-3 text-sm font-medium disabled:opacity-50"
        >
          {checking ? <LoadingSpinner /> : 'Saya sudah verifikasi'}
        </button>
        <button
          onClick={resend}
          disabled={sending || cooldown > 0}
          className="w-full rounded-md border border-shore-200 bg-surface px-4 py-3 text-sm font-medium text-navy transition-colors duration-micro hover:border-shore-300 hover: disabled:opacity-50"
        >
          {sending
            ? 'Mengirim…'
            : cooldown > 0
              ? `Kirim ulang (${cooldown})`
              : 'Belum dapat email? Kirim ulang'}
        </button>
      </div>

      <p className="mt-6 text-sm text-navy-soft">
        Salah email?{' '}
        <button onClick={logout} className="font-medium text-teal-600 hover:text-teal-700 transition-colors">
          Keluar & daftar ulang
        </button>
      </p>
    </div>
  );
}
