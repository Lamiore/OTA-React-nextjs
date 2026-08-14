'use client';

import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cameraStatus, subscribeCameraServerUrl, type Camera } from '@/lib/firestore';
import { subscribeMonitoring, type SensorReading } from '@/lib/realtime';
import { useLang } from '@/lib/useLang';

interface Props {
  /** Id dokumen kamera yang ditautkan ke destinasi ini. Boleh lebih dari satu. */
  cameraDocIds: string[];
  /** Path RTDB paket sensor destinasi ini (dari stationPath); null = tanpa sensor. */
  sensorPath: string | null;
}

interface Metric {
  label: string;
  value: string;
  unit: string;
  icon: ReactNode;
}

function fmt(n: number | undefined, digits = 1) {
  return typeof n === 'number' && !Number.isNaN(n) ? n.toFixed(digits) : '--';
}

/** Umur data → teks relatif ringkas (detik/menit/jam/hari). */
function relTime(sec: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (sec < 5) return t('monitor.justNow');
  if (sec < 60) return t('monitor.secsAgo', { n: sec });
  if (sec < 3600) return t('monitor.minsAgo', { n: Math.floor(sec / 60) });
  if (sec < 86400) return t('monitor.hoursAgo', { n: Math.floor(sec / 3600) });
  return t('monitor.daysAgo', { n: Math.floor(sec / 86400) });
}

/**
 * Satu kotak siaran. Berdiri sendiri karena status "frame pertama sudah masuk"
 * dan "koneksinya gagal" itu milik masing-masing kamera — kalau ditaruh di
 * induknya, satu kamera mati akan menampilkan pesan gagal di semua kamera.
 */
function CameraFeed({ cam, serverUrl }: { cam: Camera; serverUrl: string | null }) {
  const { t } = useLang();
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const src = cam.streamUrl
    ? cam.streamUrl
    : serverUrl === null
      ? null // masih memuat alamat server
      : serverUrl === ''
        ? '' // alamat server belum diatur
        : `${serverUrl.replace(/\/+$/, '')}/stream/${cam.cameraId}`;

  useEffect(() => {
    setError(false);
    setLoaded(false);
  }, [src]);

  // "Live" hanya kalau frame beneran masuk — koneksi terbuka tanpa frame ≠ live.
  const streaming = !!src && !error && loaded;

  return (
    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-ink">
      {src === null ? (
        <div className="absolute inset-0 animate-pulse bg-white/5" />
      ) : src === '' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
          <p className="text-sm">{t('camera.noServerUrl')}</p>
          <p className="text-xs text-white/50">{t('camera.noServerUrlHintAdmin')}</p>
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
          <p className="text-sm">{t('camera.noConnection')}</p>
          <p className="text-xs text-white/50">{t('camera.noConnectionHint')}</p>
        </div>
      ) : (
        <>
          <img
            key={src}
            src={src}
            alt={`Stream ${cam.name}`}
            className="w-full h-full object-contain"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
          {!loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-white/70">
              <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
              <p className="text-sm">{t('monitor.connectingCamera')}</p>
            </div>
          )}
        </>
      )}

      {streaming && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-xs bg-teal-500 px-2.5 py-1 text-2xs font-medium text-white shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Live
        </span>
      )}

      {cam.name && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-4 pt-10 pb-3">
          <p className="text-sm font-medium text-white drop-shadow-sm">{cam.name}</p>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={dir === 'left' ? 'rotate-180' : undefined}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/**
 * Geser antar kamera saat destinasinya punya lebih dari satu.
 *
 * Semua kamera tetap terpasang di dalam track, cuma digeser — bukan
 * dirender-ulang satu per satu. Ini yang penting: siaran MJPEG harus
 * menyambung ulang dari nol setiap kali <img>-nya dilepas, jadi kalau kamera
 * ditukar dengan cara mengganti isi DOM, tiap pindah kamera berarti menunggu
 * buffer lagi. Jumlah koneksinya pun sama saja dengan tata letak grid
 * sebelumnya — semuanya memang sudah tersambung.
 *
 * Menggesernya pakai scroll-snap CSS, bukan transform yang diatur JS: dengan
 * begitu geser-jari di ponsel jalan sendiri tanpa kode tambahan, dan tombol
 * panah cukup memanggil scrollTo.
 */
export function CameraCarousel({ cams, serverUrl }: { cams: Camera[]; serverUrl: string | null }) {
  const { t } = useLang();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Satu kamera tidak butuh track, tombol, maupun titik — tampil apa adanya.
  if (cams.length === 1) return <CameraFeed cam={cams[0]} serverUrl={serverUrl} />;

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    // Memutar: dari kamera terakhir, "berikutnya" kembali ke yang pertama.
    // Dengan begitu tombolnya tidak pernah mati dan tidak perlu status disabled.
    const next = (i + cams.length) % cams.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        // Indeks diturunkan dari posisi scroll, bukan disimpan terpisah: geser
        // jari dan tombol panah jadi ikut sumber yang sama, jadi titiknya tidak
        // pernah menunjuk kamera yang berbeda dari yang sedang terlihat.
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide"
      >
        {cams.map((c) => (
          <div key={c.id} className="w-full shrink-0 snap-center">
            <CameraFeed cam={c} serverUrl={serverUrl} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => goTo(index - 1)}
        aria-label={t('monitor.prevCamera')}
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ChevronIcon dir="left" />
      </button>
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        aria-label={t('monitor.nextCamera')}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <ChevronIcon dir="right" />
      </button>

      <div className="mt-2.5 flex justify-center gap-1.5">
        {cams.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={t('monitor.goToCamera', { n: i + 1 })}
            aria-current={i === index ? 'true' : undefined}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-5 bg-teal-600' : 'w-1.5 bg-shore-300 hover:bg-shore-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Langganan satu paket sensor + detak umur datanya.
 *
 * Detaknya perlu karena RTDB menyimpan nilai terakhir walau paketnya mati:
 * tanpa jam yang jalan, stasiun yang sempat live akan bertuliskan Live selamanya.
 */
export function useSensorReading(sensorPath: string | null) {
  const [data, setData] = useState<SensorReading | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!sensorPath) return;
    setData(null);
    setReady(false);
    return subscribeMonitoring(sensorPath, (d) => {
      setData(d);
      setReady(true);
    });
  }, [sensorPath]);

  // Detaknya menyesuaikan umur data, bukan 1 detik selamanya.
  //
  // Tiap detak me-render ulang seluruh panel — enam kartu metrik berikut SVG-nya
  // dan kartu GPS. Presisi satu detik cuma berguna selagi datanya masih segar,
  // karena di situlah label Live/Offline berpindah dan relTime() masih berbicara
  // dalam detik. Lewat semenit, teksnya sudah dalam satuan menit: 29 detak dari
  // 30 tidak mengubah satu piksel pun.
  //
  // setTimeout yang menjadwalkan dirinya sendiri, bukan setInterval: umur data
  // dinilai ulang tiap detak. Dengan setInterval, stasiun yang mati sesudah
  // sempat segar akan terkunci di detak 1 detik selamanya — effect-nya tidak
  // pernah jalan lagi karena updatedAt-nya justru berhenti berubah.
  useEffect(() => {
    if (!sensorPath) return;
    let t: ReturnType<typeof setTimeout>;

    const jadwalkan = () => {
      const umur = data?.updatedAt ? Date.now() - data.updatedAt : 0;
      t = setTimeout(() => {
        setNow(Date.now());
        jadwalkan();
      }, umur < 60_000 ? 1000 : 30_000);
    };

    // Tab di latar belakang tidak perlu detak sama sekali; saat kembali,
    // jamnya disetel ulang sekali supaya angkanya tidak terlihat tertinggal.
    const onVisibilitas = () => {
      clearTimeout(t);
      if (!document.hidden) {
        setNow(Date.now());
        jadwalkan();
      }
    };

    jadwalkan();
    document.addEventListener('visibilitychange', onVisibilitas);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisibilitas);
    };
  }, [sensorPath, data?.updatedAt]);

  const ageSec = data?.updatedAt ? Math.max(0, Math.round((now - data.updatedAt) / 1000)) : null;
  return { data, ready, ageSec, isLive: ageSec !== null && ageSec < 15 };
}

/**
 * Enam kotak metrik + status Live/Offline. `cols` biar kolom sempit tidak sesak.
 *
 * memo() bukan hiasan: `now` yang berdetak di useSensorReading me-render ulang
 * induknya, sementara props ke sini (data, ready, isLive) tidak ikut berubah di
 * antara dua kedatangan data. Tanpa memo, tiap detak membangun ulang seluruh
 * array metrik berikut enam SVG di dalamnya.
 */
export const SensorGrid = memo(function SensorGrid({
  data,
  ready,
  isLive,
  cols = 'grid-cols-2 sm:grid-cols-3',
}: {
  data: SensorReading | null;
  ready: boolean;
  isLive: boolean;
  cols?: string;
}) {
  const { t } = useLang();

  const metrics: Metric[] = [
    {
      label: t('monitor.airTemp'),
      value: fmt(data?.tempDHT),
      unit: '°C',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
        </svg>
      ),
    },
    {
      label: t('monitor.humidity'),
      value: fmt(data?.humidity),
      unit: '%',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z" />
        </svg>
      ),
    },
    {
      label: t('monitor.waterTemp'),
      value: fmt(data?.tempDS18),
      unit: '°C',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
          <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
          <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        </svg>
      ),
    },
    {
      label: t('monitor.weather'),
      // Status utama besar, nilai mentah sensor ditaruh di slot unit (kecil & redup).
      value: data?.rainStatus ?? '--',
      unit: data?.rainStatus && typeof data.rainValue === 'number' ? `(${data.rainValue})` : '',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M16 14v6" />
          <path d="M8 14v6" />
          <path d="M12 16v6" />
        </svg>
      ),
    },
    {
      label: t('monitor.windSpeed'),
      value: fmt(data?.windSpeed, 2),
      unit: 'km/h',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
          <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
          <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
        </svg>
      ),
    },
    {
      label: t('monitor.flowRate'),
      value: fmt(data?.flowRate, 2),
      unit: 'L/min',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 4.8 7 3c-.29 1.8-1.14 3.13-2.29 4.06S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05Z" />
          <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-navy">{t('monitor.sensorsTitle')}</p>
        <span className={`chip ${isLive ? 'chip-active' : ''}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-navy-soft'}`} />
          {!ready ? t('monitor.connecting') : isLive ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className={`grid ${cols} gap-3`}>
        {metrics.map((m) => (
          <div key={m.label} className="rounded-md border border-shore-200/80 bg-surface p-3.5 transition-colors hover:border-teal-200">
            <div className={`h-9 w-9 rounded-sm bg-shore-100 text-navy-soft flex items-center justify-center mb-2.5`}>
              {m.icon}
            </div>
            <p className="text-lg font-semibold text-navy leading-tight">
              {m.value}
              {m.unit && <span className="ml-1 text-xs font-normal text-navy-soft">{m.unit}</span>}
            </p>
            <p className="text-2xs text-navy-soft mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

/** Koordinat stasiun + tautan peta; sebelum fix satelit jadi baris "mencari".
 *  memo() dengan alasan yang sama seperti SensorGrid: detak jam tidak mengubah
 *  koordinat, jadi tidak perlu menyentuh kartu ini. */
export const GpsCard = memo(function GpsCard({ data }: { data: SensorReading | null }) {
  const { t } = useLang();
  const lat = data?.latitude;
  const lng = data?.longitude;
  const hasFix =
    !!data?.gpsValid &&
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    (lat !== 0 || lng !== 0);

  return (
    <div className="rounded-md border border-shore-200/80 bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-sm bg-ok-soft text-ok flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <p className="text-2xs text-navy-soft">{t('monitor.gpsTitle')}</p>
            {hasFix ? (
              <p className="text-base font-semibold text-navy leading-tight">
                {lat!.toFixed(6)}, {lng!.toFixed(6)}
              </p>
            ) : (
              <p className="text-sm font-medium text-navy-soft">
                {t('monitor.gpsSearching')}
                {typeof data?.satellites === 'number' && data.satellites > 0
                  ? ` (${t('monitor.gpsVisible', { n: data.satellites })})`
                  : ''}
              </p>
            )}
          </div>
        </div>
        {hasFix && (
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="chip whitespace-nowrap"
          >
            {t('monitor.openMap')}
          </a>
        )}
      </div>
      {hasFix && (
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-2xs text-navy-soft">
          <span>{t('monitor.satellites')}: {data?.satellites ?? '--'}</span>
          {typeof data?.altitude === 'number' && (
            <span>{t('monitor.altitude')}: {data.altitude.toFixed(0)} m</span>
          )}
          {typeof data?.speed === 'number' && (
            <span>{t('monitor.speed')}: {data.speed.toFixed(1)} km/h</span>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Panel "Pantau Langsung" gabungan: stream kamera + sensor IoT dalam satu card.
 *
 * Kameranya dibaca langsung dari dokumen `cameras/{docId}`, bukan dari field
 * yang didenormalisasi ke dokumen destinasi. Itu disengaja: dokumen destinasi
 * dibaca publik, jadi id stream yang menempel di sana bisa dipakai siapa pun
 * merakit URL siaran sendiri. Sekarang rules yang jadi satu-satunya gerbang —
 * pembaca tanpa hak kena permission-denied dan blok kameranya tidak dirender.
 * Tidak ada pengecekan role di komponen ini.
 *
 * Sensor dibaca dari cabang RTDB milik paket sensor destinasi ini (sensorPath).
 */
export default function LiveMonitorPanel({ cameraDocIds, sensorPath }: Props) {
  const { t } = useLang();
  const hasMonitoring = !!sensorPath;

  // ── Kamera ──
  // Satu langganan per kamera, hasilnya dikumpulkan per id. Kamera yang ditolak
  // rules (pengunjung tanpa hak) jatuh jadi null dan tidak ikut dirender —
  // itulah sebabnya daftar yang tayang diturunkan dari isi map ini, bukan dari
  // panjang cameraDocIds.
  const [cams, setCams] = useState<Record<string, Camera | null>>({});
  const [serverUrl, setServerUrl] = useState<string | null>(null); // null = loading

  // Dibekukan jadi string supaya array literal baru tiap render tidak memicu
  // langganan ulang setiap kali komponen induk render.
  const idsKey = cameraDocIds.join(',');

  useEffect(() => {
    // Reset dulu, sinkron: tanpa ini, pindah destinasi lewat navigasi sisi-klien
    // membiarkan kamera destinasi LAMA tetap tampil sampai snapshot baru datang.
    setCams({});
    if (!db) return;
    const ids = idsKey ? idsKey.split(',') : [];
    // Callback error wajib: pengunjung tanpa hak MEMANG kena permission-denied
    // di sini. Tanpa penanganan, listener-nya mati dan tiap kunjungan halaman
    // destinasi publik meninggalkan error di konsol.
    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db!, 'cameras', id),
        (snap) =>
          setCams((prev) => ({
            ...prev,
            [id]: snap.exists() ? ({ id: snap.id, ...snap.data() } as Camera) : null,
          })),
        () => setCams((prev) => ({ ...prev, [id]: null }))
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [idsKey]);

  // Urutannya mengikuti urutan yang diatur admin, bukan urutan datangnya
  // snapshot — kalau tidak, kamera bisa lompat-lompat posisi saat dimuat.
  // Kamera yang belum disetujui server VPS tidak punya siaran untuk ditampilkan.
  //
  // Halaman destinasi memajang kamera publik saja. Kamera khusus penonton tetap
  // terbaca akun yang berhak (rules tidak berubah), tapi tempatnya di halaman
  // Monitoring: di sini isinya sama untuk semua pengunjung, jadi tidak ada
  // pengunjung yang melihat kotak siaran yang orang di sebelahnya tidak lihat.
  const visibleCams = cameraDocIds
    .map((id) => cams[id])
    .filter((c): c is Camera => !!c && cameraStatus(c) === 'approved' && c.isPublic === true);
  const hasCamera = visibleCams.length > 0;
  // Kamera legacy punya streamUrl sendiri dan tidak butuh alamat server.
  const needsServerUrl = visibleCams.some((c) => !c.streamUrl);

  useEffect(() => {
    if (!needsServerUrl) return;
    return subscribeCameraServerUrl(setServerUrl);
  }, [needsServerUrl]);

  // ── Sensor ──
  const { data, ready, ageSec, isLive } = useSensorReading(sensorPath);

  if (!hasCamera && !hasMonitoring) return null;

  const subtitle =
    hasCamera && hasMonitoring
      ? t('monitor.subtitleBoth')
      : hasCamera
        ? t('monitor.subtitleCamera')
        : t('monitor.subtitleSensor');

  const bothSides = hasCamera && hasMonitoring;

  const cameraBlock = hasCamera && (
    <CameraCarousel cams={visibleCams} serverUrl={serverUrl} />
  );

  const sensorBlock = hasMonitoring && (
    <SensorGrid
      data={data}
      ready={ready}
      isLive={isLive}
      // Dua kolom saja saat sensor berdampingan dengan kamera: kolomnya sempit.
      cols={bothSides ? 'grid-cols-2' : undefined}
    />
  );

  const gpsBlock = hasMonitoring && <GpsCard data={data} />;

  return (
    // Bagian, bukan kartu: blok kamera / GPS / sensor di dalamnya sudah punya
    // batas sendiri, jadi bungkus `.card` di sini menghasilkan kartu-dalam-kartu
    // (design.md § Surface language). Kepala bagiannya kini sejajar dengan
    // "Tentang", "Daftar harga", dan "Ulasan" di halaman yang sama.
    <section className="animate-fade-in">
      <h2 className="section-title">{t('dest.liveMonitor')}</h2>
      <p className="section-lede">{subtitle}</p>

      {/* Body: desktop dua kolom (kamera + GPS di kiri, sensor di kanan) bila
          keduanya ada — biar tinggi kedua kolom seimbang; selain itu ditumpuk. */}
      {bothSides ? (
        <div className="mt-4 lg:mt-5 lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">
          <div className="space-y-3 lg:col-span-3">
            {cameraBlock}
            {gpsBlock}
          </div>
          <div className="mt-5 lg:mt-0 lg:col-span-2">{sensorBlock}</div>
        </div>
      ) : (
        <div className="mt-4 space-y-4 lg:mt-5">
          {cameraBlock}
          {sensorBlock}
          {gpsBlock}
        </div>
      )}

      {ageSec !== null && (
        <p className="mt-4 text-xs text-navy-soft">
          {t('monitor.updated', { when: relTime(ageSec, t) })}
        </p>
      )}
    </section>
  );
}
