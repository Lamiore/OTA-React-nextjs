'use client';

import { useUserRole } from '@/lib/useAuth';
import AuthForm from './AuthForm';
import ProfileView from './ProfileView';
import VerifyEmail from './VerifyEmail';

export default function ProfileContent() {
  const { user, role, loading } = useUserRole();

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16">
      {loading ? null : !user ? (
        <AuthForm />
      ) : !user.emailVerified ? (
        // Sisa era password: akun lama yang belum sempat verifikasi dan
        // sesinya masih hidup. Login lewat kode email menaikkan emailVerified
        // sendiri, jadi jalur ini tidak bisa lagi dimasuki akun baru.
        <VerifyEmail user={user} />
      ) : (
        <ProfileView user={user} role={role} />
      )}
    </section>
  );
}
