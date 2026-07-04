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

export default function DesktopDestinationCard({
  id,
  name,
  location,
  emoji,
  thumbColor,
  tags,
  isLive,
  image,
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
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-2.5">
        <h3 className="text-[15px] font-semibold text-navy leading-snug transition-colors group-hover:text-teal-600">
          {name}
        </h3>

        <div className="flex items-center gap-1.5">
          <PinIcon />
          <span className="text-[12px] text-navy-soft">{location}</span>
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
        <div className="mt-1 flex items-center justify-end border-t border-shore-200 pt-4">
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
