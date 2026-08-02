'use client';

import { useRouter } from 'next/navigation';
import { formatIDR } from '@/lib/format';
import { useLang } from '@/lib/useLang';

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
}: Props) {
  const router = useRouter();
  const { t } = useLang();

  return (
    <div
      className="card group cursor-pointer overflow-hidden hover:border-teal-600"
      onClick={() => router.push(`/destinations/${id}`)}
    >
      {/* Thumbnail */}
      <div className="relative flex h-44 items-center justify-center overflow-hidden">
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
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
            aria-label={t(saved ? 'card.unsave' : 'card.save')}
            aria-pressed={!!saved}
            className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm transition-colors duration-micro ease-out ${saved ? 'text-danger' : 'text-ink/60 hover:text-danger'}`}
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
      <div className="flex flex-col gap-2.5 p-5">
        <h3 className="font-serif text-lg font-semibold capitalize leading-snug text-navy transition-colors duration-micro ease-out group-hover:text-teal-600">
          {name}
        </h3>

        <div className="flex items-center gap-1.5">
          <PinIcon />
          <span className="text-xs text-navy-soft capitalize">{location}</span>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-xs bg-shore-100 px-2.5 py-1 text-2xs font-medium text-navy-soft"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer: harga termurah + CTA */}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-shore-200 pt-4">
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
          <button className="btn-primary shrink-0 px-4 py-2">
            Booking
            <ArrowIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
