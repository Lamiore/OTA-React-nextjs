'use client';

import type { User } from 'firebase/auth';
import type { UserRole } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';
import { canManageCameras } from '@/lib/firestore';
import CameraManager from './CameraManager';

interface Props {
  user: User;
  role: UserRole | null;
}

/**
 * View Kamera di halaman /kamera. Pengelola & admin mendaftarkan dan memantau
 * kameranya di sini. Pengguna biasa tidak punya kamera sendiri — kamera yang
 * boleh ditontonnya muncul di halaman destinasi begitu pengelola menambahkan
 * emailnya, jadi di sini cukup keterangan ke mana harus melihat.
 */
export default function CameraSection({ user, role }: Props) {
  const { t } = useLang();
  const manager = canManageCameras(role);

  return (
    <>
      <h1 className="font-serif text-2xl font-medium text-navy sm:text-3xl">{t('camera.title')}</h1>
      <p className="mt-2 text-sm text-navy-soft">
        {manager ? t('camera.lede') : t('camera.ledeViewer')}
      </p>

      <div className="mt-6">
        {manager ? (
          <CameraManager user={user} />
        ) : (
          <div className="card p-6">
            <p className="text-sm text-navy-soft leading-relaxed">{t('camera.viewerNote')}</p>
          </div>
        )}
      </div>
    </>
  );
}
