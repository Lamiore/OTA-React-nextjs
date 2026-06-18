'use client';

import { useRouter } from 'next/navigation';

interface Props {
  id: string;
  name: string;
  location: string;
  emoji: string;
  thumbColor: string;
  tags: string[];
  priceStart: number;
  isLive?: boolean;
  description?: string;
  image?: string;
}

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy-soft shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const formatRp = (n: number) => `Rp ${(n / 1000).toFixed(0)}k`;

export default function DestinationCard({
  id,
  name,
  location,
  emoji,
  thumbColor,
  tags,
  priceStart,
  isLive,
  image,
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
        <h3 className="text-[13px] font-semibold text-navy leading-tight">
          {name}
        </h3>

        <div className="flex items-center gap-1">
          <PinIcon />
          <span className="text-[11px] text-navy-soft">{location}</span>
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
          <span className="text-[12px] text-navy font-semibold">
            {formatRp(priceStart)}
            <span className="text-navy-soft font-normal">/pax</span>
          </span>
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
