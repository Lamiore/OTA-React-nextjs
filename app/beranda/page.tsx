/* Hallmark · genre: editorial · macrostructure: Photographic (hero) + Ecosystem Index (grid) · theme: Nusa (preserved) · nav: TopNav pill · footer: Ft1 mast-headed · 2026-08-06 */
import { Suspense } from 'react';
import TopNav from '@/components/desktop/TopNav';
import HeroBanner from '@/components/desktop/HeroBanner';
import DesktopDestinationGrid from '@/components/desktop/DesktopDestinationGrid';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';

export default function Beranda() {
  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-24 md:pb-0">
      <TopNav />
      <HeroBanner />
      <Suspense>
        <DesktopDestinationGrid />
      </Suspense>
      <Footer />
      <BottomNav />
    </main>
  );
}
