'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  subscribeDestinations,
  type Destination,
} from '@/lib/firestore';

interface Booking {
  id: string;
  destinationId: string;
  destinationName: string;
  guests: number;
  status: string;
  date: string;
}

export default function PengelolaStatistikPanel({ uid }: { uid: string }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const unsub = subscribeDestinations(setDestinations);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db) return;
    const ref = collection(db, 'bookings');
    const unsub = onSnapshot(ref, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
    });
    return () => unsub();
  }, []);

  const managed = destinations.filter((d) => d.managerUid === uid);
  const managedIds = new Set(managed.map((d) => d.id));
  const managedNames = managed.map((d) => d.name);
  const managedBookings = bookings.filter((b) => managedIds.has(b.destinationId));

  const totalBookings = managedBookings.length;
  const totalGuests = managedBookings.reduce((sum, b) => sum + (b.guests || 0), 0);
  const usedTickets = managedBookings.filter((b) => b.status === 'used').length;

  const stats = [
    {
      label: 'Total Destinasi',
      value: managedIds.size,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" x2="9" y1="3" y2="18" />
          <line x1="15" x2="15" y1="6" y2="21" />
        </svg>
      ),
    },
    {
      label: 'Total Booking',
      value: totalBookings,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Tiket Terjual',
      value: usedTickets,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      ),
    },
    {
      label: 'Total Pengunjung',
      value: totalGuests,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  // Recent bookings (dibatasi ke destinasi kelola pengelola)
  const recentBookings = [...managedBookings]
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="animate-fade-in">
      <h1 className="section-title">Statistik</h1>
      <p className="section-lede">
        {managedNames.length > 0
          ? `Ringkasan wisata destinasi ${managedNames.join(', ')}`
          : 'Destinasi kelola belum ditetapkan admin'}
      </p>

      {managedNames.length === 0 && (
        <div className="card p-4 mt-4 text-center">
          <p className="text-sm text-navy-soft">
            Destinasi kelolamu belum ditetapkan admin. Data akan muncul setelah admin menetapkan destinasi kelolamu.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`h-11 w-11 rounded-md bg-shore-100 text-navy-soft flex items-center justify-center mb-3`}>
              {s.icon}
            </div>
            <p className="tabular font-serif text-2xl font-semibold text-navy">{s.value}</p>
            <p className="text-xs text-navy-soft mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div className="mt-8">
        <h2 className="font-serif text-lg font-medium text-navy mb-4">Booking Terbaru</h2>
        {recentBookings.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-navy-soft">Belum ada booking.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentBookings.map((b) => (
              <div key={b.id} className="card flex items-center gap-4 px-5 py-4">
                <div className="h-10 w-10 rounded-md bg-shore-100 flex items-center justify-center text-navy-soft shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{b.destinationName}</p>
                  <p className="text-xs text-navy-soft">
                    {new Date(b.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} — {b.guests} orang
                  </p>
                </div>
                <span className={`rounded-sm px-2.5 py-1 text-2xs font-medium ${
                  b.status === 'used' ? 'bg-shore-100 text-navy-soft' :
                  b.status === 'confirmed' ? 'bg-teal-100 text-teal-700' :
                  b.status === 'cancelled' ? 'bg-danger-soft text-danger' :
                  'bg-warn-soft text-warn'
                }`}>
                  {b.status === 'used' ? 'Sudah Digunakan' : b.status === 'confirmed' ? 'Dikonfirmasi' : b.status === 'cancelled' ? 'Dibatalkan' : 'Menunggu'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
