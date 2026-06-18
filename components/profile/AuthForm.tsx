'use client';

import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

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

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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

export default function AuthForm({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const getErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/invalid-email': return 'Format email tidak valid.';
      case 'auth/user-not-found': return 'Akun tidak ditemukan.';
      case 'auth/wrong-password': return 'Password salah.';
      case 'auth/invalid-credential': return 'Email atau password salah.';
      case 'auth/email-already-in-use': return 'Email sudah terdaftar.';
      case 'auth/weak-password': return 'Password minimal 6 karakter.';
      case 'auth/too-many-requests': return 'Terlalu banyak percobaan. Coba lagi nanti.';
      case 'auth/popup-closed-by-user': return 'Login dibatalkan.';
      default: return 'Terjadi kesalahan. Coba lagi.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        await ensureUserDoc(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      setError(getErrorMessage(firebaseErr.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!auth) return;
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserDoc(cred.user);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      setError(getErrorMessage(firebaseErr.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500 mb-5 shadow-glow">
          <span className="font-serif text-xl font-semibold text-white">D</span>
        </div>
        <h2 className="font-serif text-2xl font-medium text-navy sm:text-3xl">
          {isLogin ? 'Selamat Datang' : 'Buat Akun Baru'}
        </h2>
        <p className="mt-2 text-sm text-navy-soft">
          {isLogin
            ? 'Masuk untuk melanjutkan petualangan'
            : 'Mulai jelajahi destinasi Sulawesi Utara'}
        </p>
      </div>

      {/* Google button */}
      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-shore-200 bg-surface px-4 py-3 text-[13px] font-medium text-navy transition-all duration-200 hover:border-shore-300 hover:shadow-soft disabled:opacity-50"
      >
        <GoogleIcon />
        {isLogin ? 'Masuk dengan Google' : 'Daftar dengan Google'}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-shore-200" />
        <span className="text-[11px] text-navy-soft uppercase tracking-widest">atau</span>
        <div className="flex-1 h-px bg-shore-200" />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name — register only */}
        {!isLogin && (
          <div className="animate-fade-up">
            <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">
              Nama Lengkap
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-shore-200 bg-surface px-3.5 py-3 transition-all duration-200 focus-within:border-teal-400 focus-within:shadow-glow">
              <span className="text-navy-soft"><UserIcon /></span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                className="flex-1 bg-transparent text-[13px] text-navy placeholder:text-[#A3AEB5] outline-none"
              />
            </div>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">
            Email
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-shore-200 bg-surface px-3.5 py-3 transition-all duration-200 focus-within:border-teal-400 focus-within:shadow-glow">
            <span className="text-navy-soft"><MailIcon /></span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
              className="flex-1 bg-transparent text-[13px] text-navy placeholder:text-[#A3AEB5] outline-none"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-shore-200 bg-surface px-3.5 py-3 transition-all duration-200 focus-within:border-teal-400 focus-within:shadow-glow">
            <span className="text-navy-soft"><LockIcon /></span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? 'Masukkan password' : 'Minimal 6 karakter'}
              required
              minLength={6}
              className="flex-1 bg-transparent text-[13px] text-navy placeholder:text-[#A3AEB5] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-navy-soft hover:text-navy transition-colors"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-red-600 animate-fade-up">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full rounded-xl px-4 py-3 text-[14px] font-medium shadow-glow disabled:opacity-50 disabled:transform-none"
        >
          {loading ? (
            <LoadingSpinner />
          ) : isLogin ? (
            'Masuk'
          ) : (
            'Buat Akun'
          )}
        </button>
      </form>

      {/* Toggle mode */}
      <p className="mt-6 text-center text-[13px] text-navy-soft">
        {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
        <button
          onClick={() => {
            setMode(isLogin ? 'register' : 'login');
            setError('');
          }}
          className="font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          {isLogin ? 'Daftar sekarang' : 'Masuk'}
        </button>
      </p>
    </div>
  );
}
