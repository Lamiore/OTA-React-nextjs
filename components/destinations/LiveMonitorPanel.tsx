'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cameraStatus, subscribeCameraServerUrl, type Camera } from '@/lib/firestore';
import { subscribeMonitoring, type SensorReading } from '@/lib/realtime';
import { useLang } from '@/lib/useLang';

interface Props {
  /** Id dokumen kamera yang ditautkan ke destinasi ini. */
  cameraDocId?: string;
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
export default function LiveMonitorPanel({ cameraDocId, sensorPath }: Props) {
  const { t } = useLang();
  const hasMonitoring = !!sensorPath;

  // ── Kamera ──
  const [cam, setCam] = useState<Camera | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null); // null = loading
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false); // frame pertama sudah masuk

  useEffect(() => {
    if (!cameraDocId || !db) {
      setCam(null);
      return;
    }
    // Callback error wajib: pengunjung tanpa hak MEMANG kena permission-denied
    // di sini. Tanpa penanganan, listener-nya mati dan tiap kunjungan halaman
    // destinasi publik meninggalkan error di konsol.
    return onSnapshot(
      doc(db, 'cameras', cameraDocId),
      (snap) => setCam(snap.exists() ? ({ id: snap.id, ...snap.data() } as Camera) : null),
      () => setCam(null),
    );
  }, [cameraDocId]);

  // Kamera yang belum disetujui server VPS tidak punya siaran untuk ditampilkan.
  const hasCamera = !!cam && cameraStatus(cam) === 'approved';
  const cameraName = cam?.name;

  useEffect(() => {
    if (!hasCamera || cam?.streamUrl) return; // legacy tidak butuh server URL
    return subscribeCameraServerUrl(setServerUrl);
  }, [hasCamera, cam?.streamUrl]);

  const src = !hasCamera
    ? ''
    : cam!.streamUrl
      ? cam!.streamUrl
      : serverUrl === null
        ? null // masih memuat alamat server
        : serverUrl === ''
          ? '' // alamat server belum diatur
          : `${serverUrl.replace(/\/+$/, '')}/stream/${cam!.cameraId}`;

  useEffect(() => {
    setError(false);
    setLoaded(false);
  }, [src]);

  // "Live" hanya kalau frame beneran masuk — koneksi terbuka tanpa frame ≠ live.
  const streaming = !!src && !error && loaded;

  // ── Sensor ──
  const [data, setData] = useState<SensorReading | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!sensorPath) return;
    setData(null);
    setReady(false);
    const unsub = subscribeMonitoring(sensorPath, (d) => {
      setData(d);
      setReady(true);
    });
    return () => unsub();
  }, [sensorPath]);

  useEffect(() => {
    if (!hasMonitoring) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasMonitoring]);

  if (!hasCamera && !hasMonitoring) return null;

  const ageSec = data?.updatedAt ? Math.max(0, Math.round((now - data.updatedAt) / 1000)) : null;
  const isLive = ageSec !== null && ageSec < 15;

  const lat = data?.latitude;
  const lng = data?.longitude;
  const hasFix =
    !!data?.gpsValid &&
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    (lat !== 0 || lng !== 0);
  const mapsUrl = hasFix ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  const subtitle =
    hasCamera && hasMonitoring
      ? t('monitor.subtitleBoth')
      : hasCamera
        ? t('monitor.subtitleCamera')
        : t('monitor.subtitleSensor');

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

  const bothSides = hasCamera && hasMonitoring;
  const metricCols = bothSides ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';

  const cameraBlock = hasCamera && (
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
            alt={`Stream ${cameraName ?? 'kamera'}`}
            className="w-full h-full object-contain"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
          {!loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-white/70">
              <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
              <p className="text-sm">Menghubungkan ke kamera…</p>
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

      {cameraName && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-4 pt-10 pb-3">
          <p className="text-sm font-medium text-white drop-shadow-sm">{cameraName}</p>
        </div>
      )}
    </div>
  );

  const sensorBlock = hasMonitoring && (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-navy">Sensor Lingkungan</p>
        <span className={`chip ${isLive ? 'chip-active' : ''}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-navy-soft'}`} />
          {!ready ? 'Menghubungkan…' : isLive ? 'Live' : 'Offline'}
        </span>
      </div>

      <div className={`grid ${metricCols} gap-3`}>
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

  const gpsBlock = hasMonitoring && (
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
            <p className="text-2xs text-navy-soft">Lokasi Stasiun (GPS)</p>
            {hasFix ? (
              <p className="text-base font-semibold text-navy leading-tight">
                {lat!.toFixed(6)}, {lng!.toFixed(6)}
              </p>
            ) : (
              <p className="text-sm font-medium text-navy-soft">
                Mencari sinyal satelit…
                {typeof data?.satellites === 'number' && data.satellites > 0
                  ? ` (${data.satellites} terlihat)`
                  : ''}
              </p>
            )}
          </div>
        </div>
        {hasFix && (
          <a href={mapsUrl!} target="_blank" rel="noopener noreferrer" className="chip whitespace-nowrap">
            Buka di Peta
          </a>
        )}
      </div>
      {hasFix && (
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-2xs text-navy-soft">
          <span>Satelit: {data?.satellites ?? '--'}</span>
          {typeof data?.altitude === 'number' && <span>Ketinggian: {data.altitude.toFixed(0)} m</span>}
          {typeof data?.speed === 'number' && <span>Kecepatan: {data.speed.toFixed(1)} km/h</span>}
        </div>
      )}
    </div>
  );

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
