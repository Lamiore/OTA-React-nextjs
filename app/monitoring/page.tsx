'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';
import {
  cameraStatus,
  subscribeCameraServerUrl,
  subscribeDestinations,
  type Camera,
  type Destination,
} from '@/lib/firestore';
import { destinationCameraIds } from '@/lib/destination';
import { stationPath } from '@/lib/realtime';
import {
  CameraCarousel,
  GpsCard,
  SensorGrid,
  useSensorReading,
} from '@/components/destinations/LiveMonitorPanel';
import TopNav from '@/components/desktop/TopNav';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';

/**
 * Isi halaman ini: tiap destinasi yang punya kamera yang boleh ditonton akun ini,
 * berikut sensor stasiunnya.
 *
 * Sensornya menempel pada kamera, bukan berdiri sendiri: paket monitoring yang
 * dibuka pengelola itu satu barang — siaran DAN angka lingkungannya. Destinasi
 * yang kameranya tidak boleh ditonton akun ini tidak muncul sama sekali, walau
 * stasiunnya hidup. Ini keputusan tampilan, bukan gerbang data: angka RTDB yang
 * sama tetap tayang di hero beranda dan di halaman destinasinya masing-masing,
 * dan memang tidak bisa ditutup dari sini — RTDB-lah yang menentukan siapa boleh
 * membacanya, bukan komponen ini.
 *
 * Daftarnya tidak diambil lewat query koleksi `cameras`. Rules bukan filter:
 * cabang yang mengizinkan penonton berbunyi `email in resource.data.viewers`,
 * dan itu bergantung pada isi tiap dokumen — sebuah query koleksi tidak bisa
 * membuktikannya di muka, jadi Firestore menolak seluruh query, bukan
 * menyaringnya. Maka jalannya sama persis dengan halaman destinasi: berlangganan
 * dokumen kamera satu per satu, dan yang ditolak rules jatuh jadi null lalu tidak
 * ikut tampil. Itu juga yang membuat halaman ini tidak mungkin menayangkan lebih
 * dari yang dibolehkan — gerbangnya tetap di server, bukan di cabang if di sini.
 *
 * Seluruh destinasi ditelusuri, bukan hanya yang tingkat atas: admin boleh
 * menautkan kamera ke spot di dalam sebuah kawasan, dan kamera itu harus ikut
 * muncul di sini persis seperti di halaman spotnya.
 */
function useMonitorGroups() {
  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [cams, setCams] = useState<Record<string, Camera | null>>({});

  useEffect(() => subscribeDestinations(setDestinations), []);

  // Dibekukan jadi string supaya array baru tiap render tidak memicu langganan
  // ulang ke seluruh kamera setiap kali komponen ini render.
  const idsKey = Array.from(
    new Set((destinations ?? []).flatMap((d) => destinationCameraIds(d)))
  ).join(',');

  useEffect(() => {
    setCams({});
    if (!db) return;
    const ids = idsKey ? idsKey.split(',') : [];
    // Callback error wajib ada: penonton tanpa hak MEMANG kena permission-denied
    // di sini, dan itu jalur normal — tanpa penanganan, listener-nya mati diam.
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

  const totalIds = idsKey ? idsKey.split(',').length : 0;
  // "Semua sudah dijawab" — bukan sekadar "ada isinya". Daftar destinasi masih
  // null selama snapshot pertama, dan tiap kamera baru terhitung setelah rules
  // menjawab boleh/tidak. Tanpa dua syarat ini halaman mengedipkan ajakan beli
  // paket ke orang yang justru sudah punya hak menonton.
  const settled = destinations !== null && Object.keys(cams).length >= totalIds;

  // Urut nama dulu, baru dedupe stasiun. stationPath memulangkan
  // `monitoring/latest` yang sama untuk tiap destinasi lama yang hasMonitoring-nya
  // true tapi stationId-nya kosong; tanpa dedupe, dua judul destinasi memajang
  // angka yang persis sama di satu layar. Yang pertama menurut abjad memegangnya.
  const seen = new Set<string>();
  const groups = (destinations ?? [])
    .map((dest) => ({
      dest,
      // Kamera khusus penonton saja. Yang publik sudah tayang di halaman
      // destinasinya untuk semua orang, jadi menampilkannya lagi di sini cuma
      // menggandakan siaran yang sama — halaman ini gunanya justru mengumpulkan
      // yang TIDAK muncul di halaman destinasi.
      cams: destinationCameraIds(dest)
        .map((id) => cams[id])
        .filter(
          (c): c is Camera => !!c && cameraStatus(c) === 'approved' && c.isPublic !== true
        ),
      sensorPath: stationPath(dest),
    }))
    // Disaring sebelum dedupe, bukan sesudah: destinasi tanpa kamera yang boleh
    // ditonton akun ini tidak boleh sempat memegang stasiunnya. Kalau tidak,
    // destinasi berkamera yang berbagi `monitoring/latest` dengannya kehilangan
    // sensor yang justru jadi haknya.
    .filter((g) => g.cams.length > 0)
    .sort((a, b) => a.dest.name.localeCompare(b.dest.name))
    .map((g) => {
      if (!g.sensorPath || seen.has(g.sensorPath)) return { ...g, sensorPath: null };
      seen.add(g.sensorPath);
      return g;
    });

  return { groups, settled };
}

/** Sensor satu stasiun: grid metrik + kartu GPS. Hook-nya per stasiun. */
function StationSensors({ sensorPath }: { sensorPath: string }) {
  const { data, ready, isLive } = useSensorReading(sensorPath);
  return (
    <div className="space-y-3">
      <SensorGrid data={data} ready={ready} isLive={isLive} />
      <GpsCard data={data} />
    </div>
  );
}

/** Kotak pesan sepenuh lebar untuk dua keadaan kosong halaman ini. */
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <p className="font-serif text-lg font-semibold text-navy">{title}</p>
      <p className="mt-2.5 text-sm leading-relaxed text-navy-soft">{body}</p>
    </div>
  );
}

export default function MonitoringPage() {
  const { user, loading } = useAuthState();
  const { t } = useLang();
  const { groups, settled } = useMonitorGroups();
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  // Satu kelompok = satu destinasi yang kameranya boleh ditonton; daftar kosong
  // berarti akun ini memang belum dapat kamera apa pun.
  const hasCamera = groups.length > 0;

  // Satu langganan alamat server untuk seluruh halaman: semua siaran menunjuk
  // server kamera yang sama, jadi tiap kelompok tidak perlu berlangganan sendiri.
  useEffect(() => subscribeCameraServerUrl(setServerUrl), []);

  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-24 md:pb-0">
      <TopNav compact />
      <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
        <h1 className="section-title">{t('monitorPage.title')}</h1>
        <p className="section-lede">{t('monitorPage.lede')}</p>

        <div className="mt-8 space-y-10">
          {groups.map(({ dest, cams, sensorPath }) => (
            <div key={dest.id}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-serif text-lg font-semibold capitalize text-navy">
                  {dest.name}
                </h2>
                <Link
                  href={`/destinations/${dest.id}`}
                  className="text-xs font-medium text-teal-700 underline-offset-4 hover:underline"
                >
                  {t('monitorPage.openDest')}
                </Link>
              </div>
              <div className="space-y-4">
                {cams.length > 0 && <CameraCarousel cams={cams} serverUrl={serverUrl} />}
                {sensorPath && <StationSensors sensorPath={sensorPath} />}
              </div>
            </div>
          ))}

          {/* Tanpa kamera, daftarnya memang kosong — jadi kotak ini praktis
              selalu berdiri sendiri. Tetap ditaruh di bawah daftar, bukan
              menggantikannya: kelompok yang sudah tayang tidak boleh hilang
              selagi kamera destinasi lain masih ditunggu jawabannya. */}
          {loading ? null : !user ? (
            <EmptyState
              title={t('monitorPage.signInTitle')}
              body={t('monitorPage.signInBody')}
            />
          ) : !hasCamera && settled ? (
            <EmptyState
              title={t('monitorPage.emptyTitle')}
              // Emailnya disebut apa adanya karena itu persis yang harus
              // didiktekan ke pengelola: allowlist kamera dicocokkan per email,
              // bukan per akun, jadi salah satu huruf berarti tetap tidak masuk.
              body={t('monitorPage.emptyBody', { email: user.email ?? '' })}
            />
          ) : null}
        </div>
      </section>
      <Footer />
      <BottomNav />
    </main>
  );
}
