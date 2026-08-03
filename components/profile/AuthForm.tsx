'use client';

import { useState, useEffect, useRef } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useLang } from '@/lib/useLang';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

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

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
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

const CODE_LENGTH = 6;

/**
 * Masuk tanpa password: isi email, terima kode 6 digit, ketik kodenya. Tidak
 * ada lagi pisah daftar/masuk — kalau emailnya belum punya akun, akunnya
 * dibuat di /api/auth/verify-code saat kodenya benar.
 */
export default function AuthForm() {
  const { t } = useLang();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  // Nama tidak ditanya di sini — akun baru lahir tanpa nama dan diisi belakangan
  // di Profil › Pengaturan. Satu kolom saja di layar masuk.
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  // Hitung mundur tombol kirim ulang — cerminan jeda 60 detik di server.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const ensureUserDoc = async (user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }) => {
    if (!db) return;
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? '',
        role: 'user',
        createdAt: serverTimestamp(),
      });
    }
  };

  const sendCode = async (resend = false) => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const { error: code } = await res.json().catch(() => ({ error: '' }));
        if (code === 'cooldown') {
          // Kode sebelumnya masih hidup — lanjut ke layar kode, bukan mentok.
          setStep('code');
          setCooldown(60);
          setNotice('auth.codeStillValid');
          return;
        }
        setError(code === 'email-invalid' ? 'auth.invalidEmail' : 'auth.sendFailed');
        return;
      }
      setStep('code');
      setCode('');
      setCooldown(60);
      if (resend) setNotice('auth.codeResent');
    } catch {
      setError('auth.sendFailedNetwork');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (value: string) => {
    if (!auth) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        setCode('');
        codeRef.current?.focus();
        switch (data.error) {
          case 'wrong':
            setError('auth.codeWrong');
            break;
          case 'expired':
          case 'none':
            setError('auth.codeExpired');
            break;
          case 'locked':
            setError('auth.codeLocked');
            break;
          default:
            setError('auth.verifyFailed');
        }
        return;
      }
      const cred = await signInWithCustomToken(auth, data.token);
      await ensureUserDoc(cred.user);
    } catch {
      setError('auth.verifyFailed');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    // Kirim otomatis begitu digit ke-6 masuk — tidak ada tombol untuk ditekan.
    if (digits.length === CODE_LENGTH && !loading) verifyCode(digits);
  };

  const handleGoogle = async () => {
    if (!auth) return;
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserDoc(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(code === 'auth/popup-closed-by-user' ? 'auth.cancelled' : 'common.error');
    } finally {
      setLoading(false);
    }
  };

  // `error`/`notice` menyimpan kunci kamus, bukan kalimat jadi — kalau bahasa
  // diganti saat pesan sedang tampil, pesannya ikut berganti.
  const messages = (
    <>
      {notice && (
        <div className="rounded-md bg-teal-50 border border-teal-100 px-4 py-3 text-sm text-teal-700 animate-fade-up">
          {t(notice)}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-danger-soft border border-danger-rule px-4 py-3 text-sm text-danger animate-fade-up">
          {t(error)}
        </div>
      )}
    </>
  );

  if (step === 'code') {
    return (
      <div className="w-full max-w-md mx-auto animate-fade-in text-center">
        <h2 className="section-title">{t('auth.checkEmailTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-soft">
          {t('auth.codeSentTo', { digits: CODE_LENGTH, email: email.trim() })}
        </p>

        <input
          ref={codeRef}
          aria-label={t('auth.codeLabel')}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          disabled={loading}
          placeholder="······"
          className="mt-7 w-full rounded-md border border-shore-200 bg-surface px-4 py-4 text-center font-mono text-3xl tracking-[0.5em] text-navy placeholder:text-shore-300 outline-none transition-colors duration-micro focus:border-teal-400 disabled:opacity-50"
        />

        {loading && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-teal-700">
            <LoadingSpinner /> {t('auth.checkingCode')}
          </div>
        )}

        <div className="mt-4 space-y-3 text-left">{messages}</div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => sendCode(true)}
            disabled={loading || cooldown > 0}
            className="w-full rounded-md border border-shore-200 bg-surface px-4 py-3 text-sm font-medium text-navy transition-colors duration-micro hover:border-shore-300 disabled:opacity-50"
          >
            {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
          </button>
        </div>

        <p className="mt-6 text-sm text-navy-soft">
          {t('auth.wrongEmail')}{' '}
          <button
            onClick={() => {
              setStep('email');
              setCode('');
              setError('');
              setNotice('');
            }}
            className="font-medium text-teal-600 hover:text-teal-700 transition-colors"
          >
            {t('auth.changeEmail')}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="section-title">{t('auth.signInTitle')}</h2>
        <p className="mt-2 text-sm text-navy-soft">{t('auth.signInLede')}</p>
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-md border border-shore-200 bg-surface px-4 py-3 text-sm font-medium text-navy transition-colors duration-micro hover:border-shore-300 disabled:opacity-50"
      >
        <GoogleIcon />
        {t('auth.continueGoogle')}
      </button>

      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-shore-200" />
        <span className="text-xs text-navy-soft">{t('auth.or')}</span>
        <div className="flex-1 h-px bg-shore-200" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendCode();
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-medium text-navy-soft mb-1.5">{t('auth.email')}</label>
          <div className="flex items-center gap-3 rounded-md border border-shore-200 bg-surface px-3.5 py-3 transition-colors duration-micro focus-within:border-teal-400">
            <span className="text-navy-soft"><MailIcon /></span>
            <input
              aria-label={t('auth.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
              autoComplete="email"
              className="flex-1 bg-transparent text-sm text-navy placeholder:text-navy-soft outline-none"
            />
          </div>
        </div>

        {messages}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:transform-none"
        >
          {loading ? <LoadingSpinner /> : t('auth.sendCode')}
        </button>
      </form>

      <p className="mt-6 text-center text-xs leading-relaxed text-navy-soft">
        {t('auth.newAccountHint')}
      </p>
    </div>
  );
}
