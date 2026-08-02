/* Hallmark · genre: atmospheric · macrostructure: Ecosystem Index · theme: Nusa (preserved) · nav: N5 floating-pill · footer: Ft5 statement · 2026-07-20 */
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
