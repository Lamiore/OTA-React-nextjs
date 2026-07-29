'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/lib/useAuth';
import TopNav from '@/components/desktop/TopNav';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';
import CameraSection from '@/components/cameras/CameraSection';

// Halaman kamera berdiri sendiri supaya bisa jadi tujuan nav di TopNav.
// Sebelumnya sub-view di /profile, tapi pil aktif navbar butuh pathname sendiri.
export default function Kamera() {
  const { user, role, loading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !user.emailVerified)) router.replace('/profile');
  }, [user, loading, router]);

  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-24 md:pb-0">
      <TopNav compact />
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16">
        {loading || !user || !user.emailVerified ? null : <CameraSection user={user} role={role} />}
      </section>
      <Footer />
      <BottomNav />
    </main>
  );
}
