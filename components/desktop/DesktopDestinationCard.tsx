'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatIDR } from '@/lib/format';
import { useLang } from '@/lib/useLang';
import { stationPath, subscribeMonitoring, type SensorReading } from '@/lib/realtime';

interface Props {
  id: string;
  name: string;
  location: string;
  thumbColor: string;
  tags: string[];
  isLive?: boolean;
  description?: string;
  image?: string;
  rating?: { avg: number; count: number };
  saved?: boolean;
  onToggleSave?: () => void;
  /** Harga item termurah — tampil sebagai "Mulai dari Rp X". */
  priceFrom?: number;
  /** Uid pengelola. Terisi = kartu ini dapat ringkasan sensor. */
  managerUid?: string;
  /** Dua field yang menentukan cabang RTDB sensor (lihat stationPath). */
  hasMonitoring?: boolean;
  stationId?: string;
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-star shrink-0">
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

/**
 * Pelat tipografis untuk kartu tanpa foto: inisial destinasi diset dalam serif
 * di atas bidang warna destinasi sendiri.
 *
 * Menggantikan emoji-sebagai-ilustrasi. Emoji dirender oleh OS, jadi tampil
 * berbeda di tiap perangkat dan tidak pernah masuk sistem tipografi halaman —
 * ini salah satu penanda AI yang paling cepat terbaca.
 */
function TypographicPlate({ name, thumbColor }: { name: string; thumbColor: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: thumbColor }}
      aria-hidden="true"
    >
      <span className="font-serif text-3xl font-semibold text-white/85">
        {name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

/**
 * Ringkasan sensor di kartu destinasi berpengelola — tiga angka teratas dari
 * paket sensor yang sama dengan yang dibaca LiveMonitorPanel di halaman
 * destinasi, bukan sumber kedua yang bisa berbeda isi.
 *
 * Chip Live/Offline ikut umur data, bukan sekadar "langganan sudah tersambung":
 * paket sensor yang mati membiarkan nilai terakhirnya tetap ada di RTDB, jadi
 * tanpa cek umur kartu ini akan memajang angka dua minggu lalu seolah live.
 *
 * Dipisah dari kartu dengan hairline, bukan kotak berbingkai sendiri: kotak di
 * dalam .card adalah card-in-card, yang dilarang design.md — dan secara visual
 * ia membuat kartu destinasi terbaca dua lapis dalam, paling berat di grid.
 */
function SensorStrip({ path }: { path: string }) {
  const { t } = useLang();
  const [data, setData] = useState<SensorReading | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setData(null);
    return subscribeMonitoring(path, setData);
  }, [path]);

  // Tanpa detak ini, kartu yang sempat live tetap bertuliskan Live selamanya:
  // onValue hanya menembak saat ada data baru, dan data baru justru yang berhenti.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(i);
  }, []);

  const live = !!data?.updatedAt && now - data.updatedAt < 15000;
  const num = (v: number | undefined) =>
    typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(1) : '--';

  const items = [
    { label: t('monitor.waterTemp'), value: num(data?.tempDS18), unit: '°C' },
    { label: t('monitor.airTemp'), value: num(data?.tempDHT), unit: '°C' },
    { label: t('card.weather'), value: data?.rainStatus ?? '--', unit: '' },
  ];

  return (
    <div className="border-t border-shore-200 pt-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-2xs font-medium text-navy-soft">{t('card.sensorTitle')}</span>
        <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-navy-soft">
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-teal-500 motion-safe:animate-pulse' : 'bg-shore-300'}`}
          />
          {live ? 'Live' : 'Offline'}
        </span>
      </div>
      <div className="tabular grid grid-cols-3 gap-2">
        {items.map((m) => (
          <div key={m.label} className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-navy">
              {m.value}
              {m.unit && <span className="ml-0.5 text-2xs font-normal text-navy-soft">{m.unit}</span>}
            </p>
            <p className="mt-0.5 truncate text-2xs text-navy-soft">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DesktopDestinationCard({
  id,
  name,
  location,
  thumbColor,
  tags,
  isLive,
  image,
  rating,
  saved,
  onToggleSave,
  priceFrom,
  managerUid,
  hasMonitoring,
  stationId,
}: Props) {
  const { t } = useLang();
  // Kartu berpengelola selalu menyebut sensornya, termasuk yang stasiunnya
  // belum terpasang — kalau baris ini hilang, kartunya masuk bagian
  // "Destinasi Terpantau" tanpa satu pun tanda kenapa dia beda.
  const sensorPath = managerUid ? stationPath({ hasMonitoring, stationId }) : null;

  return (
    // Kartunya <article> ber-`relative`, bukan <div onClick>. Seluruh bidang
    // tetap bisa diklik lewat overlay ::after milik tautan judul (pola stretched
    // link), tapi sekarang ada satu target yang bisa di-Tab dan punya href —
    // div onClick kemarin tidak terjangkau keyboard sama sekali. Tombol simpan
    // dan Booking duduk di z-10 supaya tidak tertutup overlay itu, dan tidak
    // bersarang di dalam tautan.
    // `h-full` + kolom flex supaya baris footer (harga & Booking) rata di
    // seluruh kartu satu baris, berapa pun panjang nama dan jumlah tag-nya.
    <article className="card group relative flex h-full flex-col overflow-hidden hover:border-teal-600">
      {/* Thumbnail — 4:3, foto memikul lebih banyak kartu daripada strip 176px
          sebelumnya, dan tingginya ikut lebar kolom jadi barisnya rata. */}
      <div className="relative flex aspect-[4/3] shrink-0 items-center justify-center overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <TypographicPlate name={name} thumbColor={thumbColor} />
        )}
        {/* Pelat di atas foto: warna tetap terang/gelap, tidak ikut membalik di
            dark mode, karena latarnya selalu fotografi. */}
        {isLive && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-xs bg-white/90 px-2.5 py-1 text-2xs font-semibold text-ink backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-ink motion-safe:animate-pulse" />
            LIVE
          </span>
        )}
        {onToggleSave && (
          <button
            onClick={onToggleSave}
            aria-label={t(saved ? 'card.unsave' : 'card.save')}
            aria-pressed={!!saved}
            className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm transition-colors duration-micro ease-out ${saved ? 'text-danger' : 'text-ink/60 hover:text-danger'}`}
          >
            <HeartIcon filled={!!saved} />
          </button>
        )}
        {rating && rating.count > 0 && (
          <span className="tabular absolute bottom-3 left-3 flex items-center gap-1 rounded-xs bg-white/90 px-2.5 py-1 text-2xs font-semibold text-ink backdrop-blur-sm">
            <StarIcon />
            {rating.avg.toFixed(1)}
            <span className="font-normal text-ink/60">({rating.count})</span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <h3 className="font-serif text-lg font-semibold capitalize leading-snug text-navy transition-colors duration-micro ease-out group-hover:text-teal-600">
          <Link href={`/destinations/${id}`} className="after:absolute after:inset-0 after:content-['']">
            {name}
          </Link>
        </h3>

        <div className="flex items-center gap-1.5">
          <PinIcon />
          <span className="text-xs text-navy-soft capitalize">{location}</span>
        </div>

        {/* Tags — dipotong tiga. Destinasi bertag banyak dulu menumbuhkan blok
            ini sampai dua baris dan menggeser harga tiap kartu ke tinggi yang
            berbeda; grid marketplace butuh baris yang rata. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-xs bg-shore-100 px-2.5 py-1 text-2xs font-medium text-navy-soft"
            >
              {tag}
            </span>
          ))}
        </div>

        {managerUid &&
          (sensorPath ? (
            <SensorStrip path={sensorPath} />
          ) : (
            <p className="border-t border-shore-200 pt-3 text-2xs text-navy-soft">
              {t('card.sensorNone')}
            </p>
          ))}

        {/* Footer: harga termurah + CTA.
            Tombolnya kini menuju /booking?dest=<id> — sebelumnya ini <button>
            tanpa onClick yang cuma menggelembung ke onClick kartu, jadi label
            "Booking" mengantar ke halaman destinasi, bukan ke booking. */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-shore-200 pt-4">
          {priceFrom ? (
            <div className="tabular min-w-0 leading-tight">
              <span className="block text-2xs text-navy-soft">{t('card.priceFrom')}</span>
              <span className="font-serif text-lg font-semibold text-navy">
                {formatIDR(priceFrom)}
              </span>
            </div>
          ) : (
            <span />
          )}
          <Link href={`/booking?dest=${id}`} className="btn-primary relative z-10 shrink-0 px-4 py-2">
            {t('nav.booking')}
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}
