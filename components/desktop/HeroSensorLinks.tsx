'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { subscribeDestinations } from '@/lib/firestore';
import { stationPath, subscribeMonitoring, type SensorReading } from '@/lib/realtime';
import { useLang } from '@/lib/useLang';

/**
 * Kartu stasiun sensor di sebelah kotak cari hero — satu destinasi berstasiun
 * per kartu, bergeser sendiri tiap 30 detik, menuju halaman destinasinya.
 *
 * Sumbernya RTDB `monitoring/<stationId>/latest` lewat stationPath, sama dengan
 * yang dibaca kartu destinasi dan LiveMonitorPanel. Bukan `monitoring_data` di
 * Firestore yang dipakai DesktopSensorStrip/SensorScroll: koleksi itu tidak
 * pernah diisi firmware dan kedua komponennya tidak dirender di mana pun.
 */

type Station = { id: string; name: string; location?: string; path: string };

/** Lebar tiap kartu di dalam track; sisanya menyisakan siluet kartu berikutnya. */
const SLIDE_W = 'w-[86%]';

/**
 * Jarak satu giliran, diukur dari dua kartu pertama — bukan scrollWidth/jumlah:
 * track punya gap antar kartu dan satu penahan di ujung, jadi pembagian itu
 * meleset dan indeksnya bisa tertinggal satu.
 */
function slideStep(el: HTMLElement): number {
  const [a, b] = [el.children[0], el.children[1]] as HTMLElement[];
  return a && b ? b.offsetLeft - a.offsetLeft : el.clientWidth;
}

function StationCard({ station }: { station: Station }) {
  const { t } = useLang();
  const [data, setData] = useState<SensorReading | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setData(null);
    return subscribeMonitoring(station.path, setData);
  }, [station.path]);

  // Detak yang sama dengan SensorStrip di kartu destinasi: RTDB menyimpan nilai
  // terakhir walau paketnya mati, jadi tanpa ini kartu yang sempat live akan
  // bertuliskan Live selamanya — dan membantah kartu di grid pada layar yang sama.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(i);
  }, []);

  const live = !!data?.updatedAt && now - data.updatedAt < 15000;
  const temp =
    typeof data?.tempDS18 === 'number' && !Number.isNaN(data.tempDS18)
      ? data.tempDS18.toFixed(1)
      : '--';

  return (
    <Link
      href={`/destinations/${station.id}`}
      className="flex items-center justify-between gap-3 rounded-md border border-shore-200 bg-surface px-4 py-3 transition-colors duration-micro ease-out hover:border-teal-600"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-navy">{station.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-navy-soft">
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-teal-500 motion-safe:animate-pulse' : 'bg-shore-300'}`}
          />
          {live ? 'Live' : 'Offline'}
          {station.location && <span className="truncate">· {station.location}</span>}
        </span>
      </span>
      <span className="tabular shrink-0 text-right">
        <span className="block text-sm font-semibold text-navy">
          {temp}
          <span className="ml-0.5 text-2xs font-normal text-navy-soft">°C</span>
        </span>
        <span className="block text-2xs text-navy-soft">{t('monitor.waterTemp')}</span>
      </span>
    </Link>
  );
}

export default function HeroSensorLinks() {
  const { t } = useLang();
  const [stations, setStations] = useState<Station[]>([]);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeDestinations((destinations) => {
        // Dedupe per path: stationPath memulangkan `monitoring/latest` yang sama
        // untuk tiap destinasi lama yang hasMonitoring-nya true tapi stationId-nya
        // kosong, jadi tanpa ini dua destinasi memajang angka yang identik.
        const seen = new Set<string>();
        setStations(
          destinations.flatMap((d) => {
            const path = stationPath(d);
            if (!path || seen.has(path)) return [];
            seen.add(path);
            return [{ id: d.id, name: d.name, location: d.location, path }];
          })
        );
      }),
    []
  );

  // Bergeser sendiri tiap 30 detik, memutar di ujung. scrollTo, bukan transform
  // yang diatur state: geser-jari di ponsel jadi jalan tanpa kode tambahan dan
  // scroll-snap yang membetulkan posisi akhirnya — pola yang sama dengan
  // CameraCarousel di LiveMonitorPanel.
  useEffect(() => {
    if (stations.length < 2) return;
    const i = setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const step = slideStep(el);
      const next = (Math.round(el.scrollLeft / step) + 1) % stations.length;
      el.scrollTo({ left: next * step, behavior: 'smooth' });
    }, 30000);
    return () => clearInterval(i);
  }, [stations.length]);

  // Tanpa stasiun, kotak kosong melayang di atas foto hero lebih buruk daripada
  // tidak ada apa-apa.
  if (stations.length === 0) return null;

  return (
    // reveal-nya di sini, bukan di pembungkus milik HeroBanner: pembungkus yang
    // isinya null tetap jadi flex item, dan gap-8 hero menyisakan celah kosong.
    <aside
      className="reveal w-full shrink-0 lg:w-80"
      style={{ '--i': 5 } as CSSProperties}
    >
      {/* Putih penuh + drop-shadow, bukan putih 80%: label ini duduk di sisi
          kanan hero, bagian scrim paling terang — pola yang sama dipakai sapaan
          di HeroBanner. */}
      <p className="mb-2 flex items-center justify-between gap-2 text-2xs font-medium uppercase tracking-wide text-white drop-shadow-sm">
        {t('home.sensorPanelTitle')}
        {stations.length > 1 && (
          <span className="tabular normal-case tracking-normal">
            {index + 1}/{stations.length}
          </span>
        )}
      </p>

      {stations.length === 1 ? (
        <StationCard station={stations[0]} />
      ) : (
        <div
          ref={trackRef}
          // Indeks diturunkan dari posisi scroll, bukan disimpan terpisah:
          // geser jari dan pergantian otomatis jadi ikut sumber yang sama.
          onScroll={(e) => {
            const el = e.currentTarget;
            const step = slideStep(el);
            if (step) setIndex(Math.round(el.scrollLeft / step) % stations.length);
          }}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-1 scrollbar-hide"
        >
          {stations.map((s, i) => (
            <div
              key={s.path}
              // Yang tidak sedang giliran diredupkan jadi siluet — cukup untuk
              // menandai masih ada stasiun lain tanpa merebut perhatian.
              className={`${SLIDE_W} shrink-0 snap-start transition-opacity duration-short ${
                i === index ? 'opacity-100' : 'opacity-50'
              }`}
            >
              <StationCard station={s} />
            </div>
          ))}
          {/* Penahan seukuran siluet. Tanpa ini kartu terakhir tidak bisa
              menepi ke kiri, jadi giliran terakhir melempar kartunya ke kanan —
              posisinya berpindah-pindah tiap putaran. */}
          <div className="w-[14%] shrink-0" aria-hidden />
        </div>
      )}
    </aside>
  );
}
