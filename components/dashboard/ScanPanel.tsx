'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';
import { db } from '@/lib/firebase';
import { checkInBooking, type Booking } from '@/lib/firestore';

const READER_ID = 'qr-reader';

type ScanResult =
  | { kind: 'valid'; booking: Booking }
  | { kind: 'used'; booking: Booking }
  | { kind: 'cancelled'; booking: Booking }
  | { kind: 'notfound' }
  | { kind: 'invalid' }
  | { kind: 'error' };

/**
 * Ambil booking id dari payload QR "OTA-TICKET|{id}|{name}|{date}".
 * id divalidasi sebagai auto-id Firestore (20 char alfanumerik) untuk mencegah
 * path injection saat dipakai di doc(db, 'bookings', id).
 */
function parseTicketId(text: string): string | null {
  const parts = text.split('|');
  if (parts[0] !== 'OTA-TICKET' || !parts[1]) return null;
  if (!/^[A-Za-z0-9]{20}$/.test(parts[1])) return null;
  return parts[1];
}

function dateLabel(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Format Firestore Timestamp dengan aman (tipe disimpan sebagai unknown). */
function checkedInLabel(v: unknown): string | null {
  const ts = v as { toDate?: () => Date } | undefined;
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return null;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-navy-soft">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-navy">{value}</p>
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className="rounded-2xl border border-shore-200 bg-surface p-4">
      <p className="font-serif text-lg font-medium text-navy">{booking.destinationName}</p>
      <p className="mt-0.5 text-[12px] text-navy-soft">{dateLabel(booking.date)}</p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Detail label="Pemesan" value={booking.name} />
        <Detail label="Jumlah" value={`${booking.guests} orang`} />
        <Detail label="Telepon" value={booking.phone} />
        <Detail label="Kode Tiket" value={'OTA-' + booking.id.slice(0, 8).toUpperCase()} />
      </div>
    </div>
  );
}

export default function ScanPanel() {
  const [scanning, setScanning] = useState(true);
  const [scanKey, setScanKey] = useState(0);
  const [camError, setCamError] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const busyRef = useRef(false); // cegah pemrosesan decode ganda

  const handleDecoded = useCallback(async (text: string) => {
    if (busyRef.current) return;
    busyRef.current = true;

    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* sudah berhenti */ }
    }
    setScanning(false);

    const id = parseTicketId(text);
    if (!id || !db) {
      setResult({ kind: 'invalid' });
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'bookings', id));
      if (!snap.exists()) {
        setResult({ kind: 'notfound' });
        return;
      }
      const booking = { id: snap.id, ...snap.data() } as Booking;
      if (booking.status === 'cancelled') setResult({ kind: 'cancelled', booking });
      else if (booking.status === 'used') setResult({ kind: 'used', booking });
      else setResult({ kind: 'valid', booking });
    } catch {
      setResult({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let instance: Html5QrcodeType | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        instance = new Html5Qrcode(READER_ID);
        scannerRef.current = instance;
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (decodedText: string) => { void handleDecoded(decodedText); },
          () => { /* abaikan error per-frame */ },
        );
      } catch {
        if (!cancelled) setCamError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (instance) {
        instance.stop().catch(() => { /* abaikan */ });
      }
    };
  }, [scanning, scanKey, handleDecoded]);

  const handleCheckIn = async () => {
    if (!result || result.kind !== 'valid') return;
    setCheckInError(null);
    setCheckingIn(true);
    try {
      const outcome = await checkInBooking(result.booking.id);
      if (outcome === 'success') {
        setCheckedIn(true);
      } else if (outcome === 'already-used') {
        setCheckInError('Tiket sudah digunakan (mungkin oleh petugas lain).');
      } else if (outcome === 'cancelled') {
        setCheckInError('Tiket sudah dibatalkan.');
      } else {
        setCheckInError('Tiket tidak ditemukan.');
      }
    } catch {
      setCheckInError('Gagal check-in. Periksa koneksi atau izin akses Firestore.');
    } finally {
      setCheckingIn(false);
    }
  };

  const reset = () => {
    busyRef.current = false;
    setResult(null);
    setCheckedIn(false);
    setCheckInError(null);
    setCamError(false);
    setScanKey((k) => k + 1);
    setScanning(true);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-medium text-navy">Scan Tiket</h1>
      <p className="mt-1 text-sm text-navy-soft">Arahkan kamera ke QR tiket pengunjung untuk check-in</p>

      <div className="mt-6 max-w-md">
        {scanning ? (
          <div className="card p-5">
            <div id={READER_ID} className="overflow-hidden rounded-2xl border border-shore-200 bg-ink/5" />
            {camError ? (
              <div className="mt-4 text-center">
                <p className="text-[13px] text-red-600">Tidak bisa mengakses kamera. Pastikan izin kamera diberikan dan halaman dibuka via localhost/HTTPS.</p>
                <button onClick={reset} className="btn-primary rounded-xl px-5 py-2.5 text-[13px] mt-3">Coba Lagi</button>
              </div>
            ) : (
              <p className="mt-3 text-center text-[12px] text-navy-soft">Mencari QR tiket…</p>
            )}
          </div>
        ) : (
          <div className="card p-5 space-y-4">
            {result?.kind === 'invalid' && (
              <p className="text-[14px] font-medium text-red-600">QR tidak valid. Bukan tiket OTA.</p>
            )}
            {result?.kind === 'notfound' && (
              <p className="text-[14px] font-medium text-red-600">Tiket tidak ditemukan.</p>
            )}
            {result?.kind === 'error' && (
              <p className="text-[14px] font-medium text-red-600">Gagal membaca tiket. Periksa koneksi atau izin akses Firestore.</p>
            )}
            {result?.kind === 'cancelled' && (
              <>
                <div className="rounded-xl bg-red-100 px-3 py-2 text-[13px] font-medium text-red-600">Tiket ini sudah dibatalkan.</div>
                <BookingCard booking={result.booking} />
              </>
            )}
            {result?.kind === 'used' && (
              <>
                <div className="rounded-xl bg-amber-100 px-3 py-2 text-[13px] font-medium text-amber-700">
                  Tiket sudah digunakan{checkedInLabel(result.booking.checkedInAt) ? ` · ${checkedInLabel(result.booking.checkedInAt)}` : ''}.
                </div>
                <BookingCard booking={result.booking} />
              </>
            )}
            {result?.kind === 'valid' && !checkedIn && (
              <>
                <div className="rounded-xl bg-teal-100 px-3 py-2 text-[13px] font-medium text-teal-700">Tiket valid.</div>
                <BookingCard booking={result.booking} />
                {checkInError && (
                  <div className="rounded-xl bg-red-100 px-3 py-2 text-[13px] font-medium text-red-600">{checkInError}</div>
                )}
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="btn-primary w-full rounded-xl px-4 py-2.5 text-[13px] disabled:opacity-50"
                >
                  {checkingIn ? 'Memproses…' : 'Konfirmasi Check-in'}
                </button>
              </>
            )}
            {result?.kind === 'valid' && checkedIn && (
              <>
                <div className="rounded-xl bg-teal-100 px-3 py-2 text-[13px] font-medium text-teal-700">Check-in berhasil! Tiket dicatat sebagai terjual.</div>
                <BookingCard booking={result.booking} />
              </>
            )}

            <button onClick={reset} className="btn-ghost w-full rounded-xl px-4 py-2.5 text-[13px]">Scan Lagi</button>
          </div>
        )}
      </div>
    </div>
  );
}
