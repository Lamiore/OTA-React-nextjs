import TopNav from '@/components/desktop/TopNav';
import HeroBanner from '@/components/desktop/HeroBanner';
import DesktopDestinationGrid from '@/components/desktop/DesktopDestinationGrid';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';

export default function Beranda() {
  return (
    <main className="min-h-dvh bg-shore-50 pb-24 md:pb-0">
      <TopNav />
      <HeroBanner />
      <DesktopDestinationGrid />
      <Footer />
      <BottomNav />
    </main>
  );
}
