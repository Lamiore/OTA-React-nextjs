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
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400 shrink-0">
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

export default function DestinationCard({
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
    <div className="flex rounded-2xl border border-shore-200/80 bg-surface overflow-hidden shadow-soft hover:shadow-lift transition-all duration-300">
      {/* Thumbnail */}
      <div
        className="w-[90px] shrink-0 flex items-center justify-center relative overflow-hidden"
        style={{ background: image ? undefined : `linear-gradient(160deg, ${thumbColor} 0%, #F4F0EB 100%)` }}
      >
        {image ? (
          <img src={image} alt={name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">{emoji}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-3.5 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-navy leading-tight capitalize">
            {name}
          </h3>
          {onToggleSave && (
            <button
              onClick={onToggleSave}
              aria-label={saved ? 'Hapus dari tersimpan' : 'Simpan destinasi'}
              className={`shrink-0 -mt-1 -mr-1 p-1 transition-colors ${saved ? 'text-red-400' : 'text-shore-300 hover:text-red-300'}`}
            >
              <HeartIcon filled={!!saved} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <PinIcon />
          <span className="text-[11px] text-navy-soft capitalize">{location}</span>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {isLive && (
            <span className="bg-teal-50 text-teal-600 text-[9px] font-medium px-2 py-0.5 rounded-full">
              LIVE
            </span>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="bg-shore-100 text-navy-soft text-[9px] font-medium px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          {rating && rating.count > 0 ? (
            <span className="flex items-center gap-1 text-[10px] text-navy-soft">
              <StarIcon />
              <span className="font-semibold text-navy">{rating.avg.toFixed(1)}</span>
              ({rating.count})
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={() => router.push(`/destinations/${id}`)}
            className="bg-teal-500 text-white rounded-lg px-3 py-1 text-[10px] font-medium hover:bg-teal-600 transition-colors duration-200"
          >
            Booking
          </button>
        </div>
      </div>
    </div>
  );
}
