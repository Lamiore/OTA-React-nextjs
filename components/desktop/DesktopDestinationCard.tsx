'use client';

import { useRouter } from 'next/navigation';

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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400 shrink-0">
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
}: Props) {
  const router = useRouter();

  return (
    <div
      className="card group cursor-pointer overflow-hidden hover:-translate-y-1"
      onClick={() => router.push(`/destinations/${id}`)}
    >
      {/* Thumbnail */}
      <div
        className="relative flex h-44 items-center justify-center overflow-hidden"
        style={{
          background: image ? undefined : `linear-gradient(160deg, ${thumbColor} 0%, #F4F0EB 100%)`,
        }}
      >
        {image ? (
          <img
            src={image}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <span className="text-5xl group-hover:scale-110 transition-transform duration-500 ease-out">
            {emoji}
          </span>
        )}
        {isLive && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-teal-600 backdrop-blur-sm shadow-sm">
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
            className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-colors ${saved ? 'text-red-400' : 'text-navy-soft hover:text-red-400'}`}
          >
            <HeartIcon filled={!!saved} />
          </button>
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

        {/* Footer */}
        <div className="mt-1 flex items-center justify-between border-t border-shore-200 pt-4">
          {rating && rating.count > 0 ? (
            <span className="flex items-center gap-1 text-[11px] text-navy-soft">
              <StarIcon />
              <span className="font-semibold text-navy">{rating.avg.toFixed(1)}</span>
              ({rating.count})
            </span>
          ) : (
            <span />
          )}
          <button className="btn-primary px-4 py-2 text-xs group/btn">
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
