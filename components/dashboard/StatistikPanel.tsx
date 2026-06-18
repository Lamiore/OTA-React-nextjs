'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeDestinations, subscribeUsers, type Destination, type AppUser } from '@/lib/firestore';

export default function StatistikPanel() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [bookings, setBookings] = useState<{ status: string }[]>([]);

  useEffect(() => {
    const unsub1 = subscribeDestinations(setDestinations);
    const unsub2 = subscribeUsers(setUsers);
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'bookings'), (snap) => {
      setBookings(snap.docs.map((d) => ({ status: (d.data().status as string) ?? '' })));
    });
    return () => unsub();
  }, []);

  const usedTickets = bookings.filter((b) => b.status === 'used').length;
  const totalPengelola = users.filter((u) => u.role === 'pengelola').length;
  const totalAdmin = users.filter((u) => u.role === 'admin').length;

  const stats = [
    {
      label: 'Total Destinasi',
      value: destinations.length,
      color: 'bg-teal-100 text-teal-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" x2="9" y1="3" y2="18" />
          <line x1="15" x2="15" y1="6" y2="21" />
        </svg>
      ),
    },
    {
      label: 'Total Pengguna',
      value: users.length,
      color: 'bg-blue-100 text-blue-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: 'Pengelola',
      value: totalPengelola,
      color: 'bg-amber-100 text-amber-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      label: 'Admin',
      value: totalAdmin,
      color: 'bg-purple-100 text-purple-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      label: 'Tiket Terjual',
      value: usedTickets,
      color: 'bg-teal-100 text-teal-600',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-medium text-navy">Statistik</h1>
      <p className="mt-1 text-sm text-navy-soft">Ringkasan data platform</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`h-11 w-11 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
              {s.icon}
            </div>
            <p className="text-2xl font-semibold text-navy">{s.value}</p>
            <p className="text-[12px] text-navy-soft mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
