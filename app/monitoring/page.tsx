import TopNav from '@/components/desktop/TopNav';
import BottomNav from '@/components/mobile/BottomNav';
import PageParallaxHero from '@/components/desktop/PageParallaxHero';
import SensorPanel from '@/components/monitoring/SensorPanel';
import CameraPanel from '@/components/monitoring/CameraPanel';
import StatsPanel from '@/components/monitoring/StatsPanel';
import HistoryPanel from '@/components/monitoring/HistoryPanel';

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
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <div className="flex flex-col gap-16 lg:flex-row lg:items-start lg:gap-10">
          <div className="w-full lg:sticky lg:top-24 lg:w-[480px] lg:shrink-0">
            <CameraPanel />
          </div>
          <div className="flex flex-col gap-16 lg:min-w-0 lg:flex-1">
            <SensorPanel />
            <StatsPanel />
            <HistoryPanel />
          </div>
        </div>
      </section>
      <BottomNav />
    </main>
  );
}
