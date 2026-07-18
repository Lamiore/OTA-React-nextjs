'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from './useAuth';
import { subscribeSavedDestinations, toggleSavedDestination } from './firestore';

/** Wishlist destinasi user login — savedIds real-time + toggle. Belum login → kosong, toggle no-op. */
export function useSavedDestinations() {
  const { user } = useAuthState();
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setSavedIds([]);
      return;
    }
    return subscribeSavedDestinations(user.uid, setSavedIds);
  }, [user]);

  const toggle = (destinationId: string) => {
    if (!user) return;
    toggleSavedDestination(user.uid, destinationId, savedIds.includes(destinationId));
  };

  return { user, savedIds, toggle };
}
