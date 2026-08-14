// Tanpa 'use client' sendiri, sama seperti TicketModal dan PaymentModal:
// komponen ini menerima prop berupa fungsi, dan itu hanya sah bila yang
// meng-import-nya sudah komponen klien — halaman booking memang begitu.
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { nextDays } from '@/lib/format';
import type { DateFit } from '@/lib/destination';
import { useLang } from '@/lib/useLang';

/**
 * Pemilih tanggal booking: sebaris kartu tanggal yang bisa digeser, dengan sisa
 * kuota tertulis di kartunya sendiri.
 *
 * Alasannya bukan gaya. Kuota berlaku per tanggal, jadi satu-satunya tempat
 * angka itu berguna adalah saat tanggalnya sedang dipilih — di input tanggal
 * bawaan, orang baru tahu tanggalnya penuh setelah memilih, mengisi sisa
 * formulir, lalu ditolak.
 *
 * Hanya maju, tidak ada tombol mundur: server menolak tanggal lampau, jadi
 * kartu kemarin cuma tombol yang dijamin gagal. Untuk tanggal di luar
 * jangkauan strip ada input bawaan di bawahnya — sengaja tetap `type="date"`,
 * bukan kalender buatan sendiri, karena di ponsel pemilih bawaan sistem lebih
 * enak dipakai daripada apa pun yang bisa ditiru di sini.
 */

/** Sepanjang dua minggu: cukup untuk hampir semua rencana jalan, dan masih muat digeser tanpa terasa tak berujung. */
const HARI = 14;

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

interface DateStripProps {
  /** Tanggal terpilih, YYYY-MM-DD. String kosong = belum memilih. */
  value: string;
  onChange: (date: string) => void;
  /** Sisa & kecukupan kuota untuk satu tanggal. */
  fitOf: (date: string) => DateFit;
  /** Batas bawah input bawaan — tanggal hari ini menurut waktu lokal. */
  min: string;
}

export default function DateStrip({ value, onChange, fitOf, min }: DateStripProps) {
  const { t, locale } = useLang();
  // Sekali per pemasangan. Tanpa memo, tiap render menghasilkan array tanggal
  // baru — tidak salah, cuma kerja sia-sia di komponen yang ikut berubah tiap
  // kali jumlah item digeser.
  const days = useMemo(() => nextDays(HARI), []);
  /** Input bawaan disembunyikan sampai diminta; strip yang jadi jalan utama. */
  const [lainTampil, setLainTampil] = useState(false);

  // Rentang bulan dihitung dari ujung ke ujung, bukan dari kartu yang sedang
  // terlihat: tidak ada pendengar scroll di proyek ini (design.md), dan label
  // yang berubah saat digeser tetap tidak akan benar tanpa itu.
  const bulan = useMemo(() => {
    const nama = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    const awal = nama(days[0]);
    const akhir = nama(days[days.length - 1]);
    return awal === akhir ? awal : `${awal} – ${akhir}`;
  }, [days, locale]);

  // Tanggal di luar strip tetap harus terbaca sebagai tanggal terpilih.
  const diLuarStrip = value !== '' && !days.includes(value);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="block text-xs font-medium text-navy-soft">{t('booking.dateLabel')}</label>
        <span className="text-2xs capitalize text-navy-soft/70">{bulan}</span>
      </div>

      {/* Bergulir di dalam kotaknya sendiri — halaman tidak boleh ikut bergeser
          ke samping.
          Padding, dan SENGAJA tanpa margin negatif penyeimbang: margin negatif
          membuat kotak ini 8px lebih lebar daripada induknya, dan karena
          induknya overflow visible, kelebihan itu menular sampai ke atas —
          halaman jadi bisa digeser ke samping di layar sempit. Padding di dalam
          kotak gulir memberi ruang yang sama untuk cincin fokus kartu pertama
          dan terakhir tanpa melebarkan apa pun. */}
      <div
        role="group"
        aria-label={t('booking.dateLabel')}
        className="flex gap-2 overflow-x-auto p-1"
      >
        {days.map((iso) => {
          const d = new Date(`${iso}T00:00:00`);
          const { remaining, fits } = fitOf(iso);
          // Dua hal berbeda, dan sengaja tidak disatukan. `habis` berarti tidak
          // ada sisa sama sekali; `!fits` juga terjadi saat sisanya ada tapi
          // lebih sedikit daripada yang diminta. Kalau keduanya sama-sama
          // ditulis "Habis", tanggal bersisa 10 yang diminta 12 akan mengaku
          // kosong — dan orang menyerah alih-alih mengurangi jumlahnya.
          const habis = remaining === 0;
          const dipilih = value === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              disabled={!fits}
              aria-pressed={dipilih}
              className={clsx(
                'flex w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-md border px-2 py-2.5 transition-colors duration-micro ease-out',
                dipilih
                  ? 'border-teal-600 bg-teal-50'
                  : 'border-shore-200 bg-surface hover:border-shore-300',
                // Satu sinyal untuk yang tidak bisa dipilih: diredupkan. Bukan
                // coretan plus warna plus border lain sekaligus.
                !fits && 'opacity-40',
              )}
            >
              <span className="text-2xs capitalize text-navy-soft">
                {d.toLocaleDateString(locale, { weekday: 'short' })}
              </span>
              <span className="tabular text-base font-semibold leading-none text-navy">
                {d.getDate()}
              </span>
              {/* Baris ketiga cuma muncul kalau tanggal ini memang dibatasi.
                  Tanggal tanpa data (belum ada yang terjual, atau muatannya
                  gagal) TIDAK boleh ditulis "Habis" — diam lebih jujur. */}
              {remaining !== null && (
                <span
                  className={clsx(
                    'text-2xs font-medium leading-none',
                    fits ? 'text-navy-soft' : 'text-danger',
                  )}
                >
                  {habis ? t('booking.dateFull') : t('booking.remaining', { n: String(remaining) })}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {lainTampil || diLuarStrip ? (
        <input
          aria-label={t('booking.otherDate')}
          type="date"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal-400"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLainTampil(true)}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
        >
          <CalendarIcon />
          {t('booking.otherDate')}
        </button>
      )}
    </div>
  );
}
