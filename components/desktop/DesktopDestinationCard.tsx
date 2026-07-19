'use client';

import { useRouter } from 'next/navigation';
import { formatIDR } from '@/lib/format';

interface Props {
  id: string;
  name: string;
  location: string;
  emoji: string;
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400 shrink-0">
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

/** Ilustrasi "bawah laut" untuk kartu tanpa foto: warna destinasi + cahaya + ombak. */
function EmojiScene({ emoji, thumbColor }: { emoji: string; thumbColor: string }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: thumbColor }} />
      {/* Kedalaman: terang dari kiri-atas, gelap ke kanan-bawah. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 100% at 18% -12%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.1) 42%, transparent 68%), linear-gradient(200deg, transparent 45%, rgba(15,43,60,0.3) 100%)',
        }}
      />
      {/* Garis ombak dekoratif di dasar. */}
      <svg
        viewBox="0 0 400 80"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-14 w-full"
        aria-hidden="true"
      >
        <path d="M0,30 C60,14 120,46 200,30 C280,14 340,46 400,30 L400,80 L0,80 Z" fill="rgba(255,255,255,0.10)" />
        <path d="M0,52 C70,38 140,64 220,50 C300,36 350,62 400,50 L400,80 L0,80 Z" fill="rgba(255,255,255,0.12)" />
      </svg>
      <span className="relative text-5xl drop-shadow-[0_12px_20px_rgba(15,43,60,0.35)] transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-rotate-3">
        {emoji}
      </span>
    </>
  );
}

export default function DesktopDestinationCard({
  id,
  name,
  location,
  emoji,
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

  return (
    <div
      className="card group cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-teal-400/40 hover:shadow-glow"
      onClick={() => router.push(`/destinations/${id}`)}
    >
      {/* Thumbnail */}
      <div className="relative flex h-44 items-center justify-center overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
          />
        ) : (
          <EmojiScene emoji={emoji} thumbColor={thumbColor} />
        )}
        {/* Chip di atas putih: warna teal fixed — token tema akan terbalik di dark mode. */}
        {isLive && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-[#14706E] backdrop-blur-sm shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            LIVE
          </span>
        )}
        {onToggleSave && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
            aria-label={saved ? 'Hapus dari tersimpan' : 'Simpan destinasi'}
            className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-all hover:scale-110 ${saved ? 'text-red-400' : 'text-ink/50 hover:text-red-400'}`}
          >
            <HeartIcon filled={!!saved} />
          </button>
        )}
        {/* Rating — chip kaca di atas thumbnail; teks `ink` tetap gelap di kedua tema. */}
        {rating && rating.count > 0 && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur-sm shadow-sm">
            <StarIcon />
            {rating.avg.toFixed(1)}
            <span className="font-normal text-ink/50">({rating.count})</span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-2.5">
        <h3 className="text-[15px] font-semibold text-navy leading-snug transition-colors group-hover:text-teal-600 capitalize">
          {name}
        </h3>

        <div className="flex items-center gap-1.5">
          <PinIcon />
          <span className="text-[12px] text-navy-soft capitalize">{location}</span>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-shore-100 px-2.5 py-1 text-[10px] font-medium text-navy-soft"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer: harga termurah + CTA */}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-shore-200 pt-4">
          {priceFrom ? (
            <div className="min-w-0 leading-tight">
              <span className="block text-[9px] font-medium uppercase tracking-[0.1em] text-navy-soft">
                Mulai dari
              </span>
              <span className="font-serif text-[17px] font-semibold text-teal-600">
                {formatIDR(priceFrom)}
              </span>
            </div>
          ) : (
            <span />
          )}
          <button className="btn-primary shrink-0 px-4 py-2 text-xs group/btn">
            Booking
            <span className="group-hover/btn:translate-x-0.5 transition-transform duration-200">
              <ArrowIcon />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
