'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';

export type UserRole = 'user' | 'pengelola' | 'admin';

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { user, loading };
}

export function useUserRole() {
  const { user, loading: authLoading } = useAuthState();
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !db) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    // Dokumen users/{uid} dibuat sekali saat daftar/login Google di AuthForm.
    // Jangan bikin ulang di sini: sesi yang masih hidup setelah akunnya dihapus
    // admin akan menghidupkan lagi dokumennya tiap halaman dimuat.
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data();
      setRole((data?.role as UserRole) ?? 'user');
      setRoleLoading(false);
    });

    return () => unsub();
  }, [user, authLoading]);

  return { user, role, loading: authLoading || roleLoading };
}
