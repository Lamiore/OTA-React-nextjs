import TopNav from '@/components/desktop/TopNav';
import BottomNav from '@/components/mobile/BottomNav';
import PageParallaxHero from '@/components/desktop/PageParallaxHero';
import SensorPanel from '@/components/monitoring/SensorPanel';
import CameraPanel from '@/components/monitoring/CameraPanel';
import StatsPanel from '@/components/monitoring/StatsPanel';

export default function Monitoring() {
  return (
    <main className="min-h-dvh bg-shore-50 pb-24 md:pb-0">
      <TopNav />
      <PageParallaxHero
        badge="Sea Conditions"
        title="Monitoring"
        description="Pantau kondisi laut real-time untuk perjalanan yang aman dan nyaman."
        imageUrl="https://commons.wikimedia.org/wiki/Special:FilePath/Liang%20Beach%20Bunaken.JPG"
      />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <CameraPanel />
        <StatsPanel />
        <SensorPanel />
      </section>
      <BottomNav />
    </main>
  );
}
