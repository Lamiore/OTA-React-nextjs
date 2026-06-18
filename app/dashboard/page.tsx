'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/lib/useAuth';
import DashboardSidebar, { type DashboardPage } from '@/components/dashboard/DashboardSidebar';
import StatistikPanel from '@/components/dashboard/StatistikPanel';
import PengelolaStatistikPanel from '@/components/dashboard/PengelolaStatistikPanel';
import ScanPanel from '@/components/dashboard/ScanPanel';
import DestinasiPanel from '@/components/dashboard/DestinasiPanel';
import PenggunaPanel from '@/components/dashboard/PenggunaPanel';

export default function Dashboard() {
  const { user, role, loading } = useUserRole();
  const router = useRouter();
  const [page, setPage] = useState<DashboardPage>('statistik');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/profile');
    } else if (role && role !== 'admin' && role !== 'pengelola') {
      router.replace('/beranda');
    }
  }, [user, role, loading, router]);

  if (loading || !user || !role || (role !== 'admin' && role !== 'pengelola')) {
    return null;
  }

  return (
    <div className="flex min-h-dvh bg-shore-50">
      <DashboardSidebar
        active={page}
        onNavigate={setPage}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(!mobileOpen)}
        role={role}
      />
      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          {page === 'statistik' && (role === 'admin' ? <StatistikPanel /> : <PengelolaStatistikPanel />)}
          {page === 'scan' && <ScanPanel />}
          {page === 'destinasi' && role === 'admin' && <DestinasiPanel />}
          {page === 'pengguna' && role === 'admin' && <PenggunaPanel />}
        </div>
      </main>
    </div>
  );
}
