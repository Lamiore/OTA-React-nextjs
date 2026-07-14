'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type UserRole = 'user' | 'mitra' | 'pengelola' | 'admin';

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

async function ensureUserDoc(user: User) {
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
}

export function useUserRole() {
  const { user, loading: authLoading } = useAuthState();
  const [role, setRole] = useState<UserRole | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !db) {
      setRole(null);
      setLocation(null);
      setRoleLoading(false);
      return;
    }

    ensureUserDoc(user);

    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data();
      setRole((data?.role as UserRole) ?? 'user');
      setLocation((data?.location as string) ?? null);
      setRoleLoading(false);
    });

    return () => unsub();
  }, [user, authLoading]);

  return { user, role, location, loading: authLoading || roleLoading };
}
