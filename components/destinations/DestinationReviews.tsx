'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthState } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';
import {
  upsertReview,
  deleteReview,
  reviewStats,
  type Review,
} from '@/lib/firestore';

function StarIcon({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/** Baris 5 bintang read-only (dipakai di header & tiap ulasan, juga di dekat judul). */
export function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5 text-star">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} filled={i <= rounded} size={size} />
      ))}
    </span>
  );
}

function fmtDate(ts: unknown, locale: string): string {
  const t = ts as { toMillis?: () => number; seconds?: number } | null;
  const ms = t?.toMillis ? t.toMillis() : typeof t?.seconds === 'number' ? t.seconds * 1000 : Date.now();
  return new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function toMs(ts: unknown): number {
  const t = ts as { toMillis?: () => number; seconds?: number } | null;
  return t?.toMillis ? t.toMillis() : typeof t?.seconds === 'number' ? t.seconds * 1000 : Date.now();
}

interface Props {
  destinationId: string;
  reviews: Review[];
}

export default function DestinationReviews({ destinationId, reviews }: Props) {
  const { user } = useAuthState();
  const { t, locale } = useLang();
  const { avg, count } = reviewStats(reviews);

  const myReview = user ? reviews.find((r) => r.userId === user.uid) : undefined;

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  // Sinkron form ke ulasan tersimpan saat berubah (mis. setelah submit / ganti user).
  // Tidak menimpa saat mengetik karena myReview baru berubah setelah tersimpan.
  useEffect(() => {
    setRating(myReview?.rating ?? 0);
    setComment(myReview?.comment ?? '');
  }, [myReview?.id, myReview?.rating, myReview?.comment]);

  const sorted = [...reviews].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

  const handleSubmit = async () => {
    if (!user || rating < 1) return;
    setSaving(true);
    try {
      await upsertReview(destinationId, user.uid, {
        userName: user.displayName ?? 'Anonim',
        userPhoto: user.photoURL ?? '',
        rating,
        comment: comment.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await deleteReview(destinationId, user.uid);
      setRating(0);
      setComment('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="section-title">{t('dest.reviews')}</h2>
        {count > 0 && (
          <div className="flex items-center gap-2">
            <StarRow value={avg} />
            <span className="text-sm font-semibold text-navy">{avg.toFixed(1)}</span>
            <span className="text-xs text-navy-soft">({count})</span>
          </div>
        )}
      </div>

      {/* Form tulis ulasan / prompt login */}
      {user ? (
        <div className="card p-5 sm:p-6 space-y-3">
          <p className="text-sm font-medium text-navy">
            {myReview ? 'Ubah ulasanmu' : 'Tulis ulasan'}
          </p>
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Beri ${i} bintang`}
                onMouseEnter={() => setHover(i)}
                onClick={() => setRating(i)}
                className={`transition-colors ${(hover || rating) >= i ? 'text-star' : 'text-shore-300'}`}
              >
                <StarIcon filled={(hover || rating) >= i} size={26} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('dest.reviewPlaceholder')}
            rows={3}
            className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving || rating < 1}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {saving ? 'Menyimpan…' : myReview ? 'Perbarui' : 'Kirim Ulasan'}
            </button>
            {myReview && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="btn-ghost px-4 py-2.5 text-sm hover:border-danger-rule hover:text-danger disabled:opacity-50"
              >
                Hapus
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-5 text-center">
          <p className="text-sm text-navy-soft">
            <Link href="/profile" className="text-teal-600 font-medium hover:underline">
              Masuk
            </Link>{' '}
            untuk menulis ulasan.
          </p>
        </div>
      )}

      {/* Daftar ulasan */}
      {sorted.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-navy-soft">{t('dest.beFirstReview')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => (
            <div key={r.id} className="card p-4 sm:p-5">
              <div className="flex items-center gap-3">
                {r.userPhoto ? (
                  <img
                    src={r.userPhoto}
                    alt={r.userName}
                    className="h-9 w-9 rounded-full object-cover border border-shore-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center border border-shore-200 shrink-0">
                    <span className="text-sm font-semibold text-teal-700">
                      {r.userName ? r.userName[0].toUpperCase() : 'U'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{r.userName || 'Anonim'}</p>
                  <div className="flex items-center gap-2">
                    <StarRow value={r.rating} size={13} />
                    <span className="text-2xs text-navy-soft">{fmtDate(r.createdAt, locale)}</span>
                  </div>
                </div>
              </div>
              {r.comment && (
                <p className="text-sm text-navy leading-relaxed mt-3 whitespace-pre-line">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
