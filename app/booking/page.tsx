'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthState } from '@/lib/useAuth';
import {
  createBooking,
  getPriceItems,
  isHourly,
  updateBooking,
  MAX_HOURS,
  type Booking as BookingDoc,
  type Destination,
  type PriceItem,
} from '@/lib/firestore';
import {
  dateFit,
  hoursFromLines,
  qtyFromLines,
  type ItemAvailability,
} from '@/lib/destination';
import { formatIDR, isoDate } from '@/lib/format';
import { useLang } from '@/lib/useLang';
import clsx from 'clsx';
import TopNav from '@/components/desktop/TopNav';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';
import BookingHistory from '@/components/booking/BookingHistory';
import DateStrip from '@/components/booking/DateStrip';

function CheckCircleIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-500">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthState();
  const { t, locale } = useLang();
  const destId = searchParams.get('dest');
  const preselect = searchParams.get('items');
  /**
   * Id booking yang sedang diubah. Halaman yang sama dipakai untuk membuat dan
   * mengubah — bukan modal terpisah: pemilihan item, strip tanggal beserta sisa
   * stoknya, dan kolom durasi semuanya sudah di sini, dan ringkasan harga di
   * sebelah kanan harus memakai rumus yang sama persis.
   */
  const editId = searchParams.get('edit');

  const [destination, setDestination] = useState<Destination | null>(null);
  const [loadingDest, setLoadingDest] = useState(!!destId);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  /**
   * Kunci i18n, bukan teks jadi: booking yang tidak bisa diubah harus tetap
   * berganti bahasa saat pengguna menukar bahasa setelah pesannya muncul.
   * Terisi = formulirnya tidak dirender sama sekali.
   */
  const [editError, setEditError] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  // Alasan lengkap kenapa bukan toISOString() ada di isoDate (lib/format).
  const today = isoDate();

  const [form, setForm] = useState({
    date: '',
    phone: '',
    notes: '',
  });

  /**
   * Nama pemesan — dibaca dari akun, tidak bisa diubah di sini. Cuma untuk
   * dilihat: yang tersimpan di tiket ditentukan server dari akun yang sama
   * (lihat create di /api/bookings), jadi kolom ini tidak ikut terkirim.
   */
  const namaAkun = user?.displayName?.trim() || user?.email?.split('@')[0] || '';

  const [qty, setQty] = useState<Record<string, number>>({});
  /**
   * Sisa per item, per tanggal — diambil sekali untuk seluruh destinasi.
   *
   * Satu muatan, bukan satu per tanggal yang dipilih: strip tanggal harus bisa
   * menulis angka di keempat belas kartunya sekaligus, dan angka itu ikut
   * berubah tiap kali jumlah item digeser. Menembak jaringan tiap perubahan
   * jumlah akan membuat strip berkedip untuk data yang sudah ada di tangan.
   */
  const [days, setDays] = useState<Record<string, ItemAvailability[]>>({});
  /** Sisa saat belum ada satu pun penjualan — dasar untuk tanggal yang kosong. */
  const [dasar, setDasar] = useState<ItemAvailability[]>([]);

  /** Lama sewa, satu angka untuk seluruh booking. Lihat BookingRequest.hours. */
  const [hours, setHours] = useState(1);

  const priceItems = destination ? getPriceItems(destination) : [];
  const totalQty = priceItems.reduce((s, it) => s + (qty[it.id] ?? 0), 0);
  const selectedItems = priceItems.filter((it) => (qty[it.id] ?? 0) > 0);
  /**
   * Pengali harga baris: item per jam ikut durasi, sisanya sekali bayar.
   * Rumusnya harus sama persis dengan lineTotal di lib/destination — yang di
   * layar cuma perkiraan, tapi perkiraan yang meleset dari tagihan lebih buruk
   * daripada tidak menampilkan angka sama sekali.
   */
  const kali = (it: PriceItem) => (isHourly(it) ? hours : 1);
  const total = priceItems.reduce((s, it) => s + it.price * (qty[it.id] ?? 0) * kali(it), 0);
  /** Kolom durasi cuma muncul kalau ada item per jam yang benar-benar dipilih. */
  const adaPerJam = selectedItems.some(isHourly);

  /**
   * Sisa per item pada tanggal yang SEDANG dipilih. Tanggal yang belum menjual
   * apa pun tidak dikirim server, jadi jatuh ke `dasar` — stok penuh, bukan
   * "tidak diketahui". Belum memilih tanggal berarti belum ada yang bisa
   * dikatakan sama sekali.
   */
  const sisaTanggal: ItemAvailability[] = form.date ? (days[form.date] ?? dasar) : [];

  /** Sisa item ini; null berarti tanpa batas. */
  const sisaOf = (id: string) =>
    sisaTanggal.find((a) => a.id === id)?.remaining ?? null;

  /**
   * Ringkasan satu tanggal untuk strip. Dihitung dari `days` yang sudah di
   * tangan — jadi mengubah jumlah item langsung menulis ulang keempat belas
   * kartunya tanpa satu pun permintaan baru.
   */
  const fitOf = (tanggal: string) => dateFit(days[tanggal] ?? dasar, qty);

  const setItemQty = (id: string, next: number) => {
    const batas = sisaOf(id);
    // Dikunci di sini, bukan cuma dicek saat submit: tombol + yang tetap bisa
    // ditekan melewati sisa stok cuma menyiapkan penolakan beberapa detik lagi.
    const maks = batas === null ? Number.MAX_SAFE_INTEGER : batas;
    setQty((q) => ({ ...q, [id]: Math.min(Math.max(0, next), maks) }));
  };

  // Load destination if destId provided
  useEffect(() => {
    if (!destId || !db) {
      setLoadingDest(false);
      if (editId) setEditError('booking.editNotFound');
      return;
    }
    getDoc(doc(db, 'destinations', destId)).then((snap) => {
      if (snap.exists()) {
        setDestination({ id: snap.id, ...snap.data() } as Destination);
      } else if (editId) {
        // Mode ubah menunggu destinasinya sebelum bisa mengisi formulir, jadi
        // destinasi yang tidak ada berarti menunggu selamanya. Membuat booking
        // baru tidak punya masalah ini: kartu "tidak ada destinasi dipilih"
        // yang tampil, dan halamannya tetap bisa ditinggalkan.
        setEditError('booking.editNotFound');
        setLoadingEdit(false);
      }
      setLoadingDest(false);
    });
  }, [destId, editId]);

  // Isi formulir dari booking yang sedang diubah.
  //
  // Menunggu `destination` lebih dulu, bukan berjalan sendiri: jumlah per item
  // harus disaring terhadap daftar harga yang berlaku SEKARANG (lihat
  // qtyFromLines), dan daftar itu baru ada setelah destinasinya termuat.
  useEffect(() => {
    if (!editId || !destination || !db) return;
    let batal = false;
    getDoc(doc(db, 'bookings', editId))
      .then((snap) => {
        if (batal) return;
        const b = snap.exists() ? (snap.data() as BookingDoc) : null;
        // Booking milik orang lain tidak sampai ke sini — rules menolak
        // pembacaannya, jadi jatuh ke .catch di bawah. Yang diperiksa di sini
        // adalah booking sendiri yang sudah lewat titik bisa-diubah.
        if (!b) return setEditError('booking.editNotFound');
        if (b.paymentStatus === 'paid' || b.status === 'cancelled') {
          return setEditError('booking.editLocked');
        }
        const isi = qtyFromLines(b.items, getPriceItems(destination));
        // Kosong berarti tidak ada satu pun item yang masih bisa dipesan:
        // booking lama yang barisnya belum ber-id, atau itemnya sudah dihapus
        // pengelola. Menyimpan dari keadaan itu akan menghapus isi bookingnya.
        if (Object.keys(isi).length === 0) return setEditError('booking.editUnsupported');
        setForm({ date: b.date ?? '', phone: b.phone ?? '', notes: b.notes ?? '' });
        setQty(isi);
        setHours(hoursFromLines(b.items));
      })
      .catch(() => {
        if (!batal) setEditError('booking.editNotFound');
      })
      .finally(() => {
        if (!batal) setLoadingEdit(false);
      });
    return () => {
      batal = true;
    };
  }, [editId, destination]);

  // Default qty: item yang dibawa dari halaman detail (?items=), atau item
  // pertama (biasanya tiket masuk) bila tidak ada pra-pilihan.
  useEffect(() => {
    // Mode ubah punya isinya sendiri dari booking yang tersimpan — tanpa
    // penjaga ini, effect di bawah menimpanya dengan "tiket masuk ×1".
    if (editId) return;
    if (!destination) return;
    const items = getPriceItems(destination);
    if (items.length === 0) return;
    const preIds = preselect
      ? preselect.split(',').filter((id) => items.some((it) => it.id === id))
      : [];
    if (preIds.length > 0) {
      const entries = preIds.map((id): [string, number] => [id, 1]);
      setQty(Object.fromEntries(entries));
    } else {
      setQty({ [items[0].id]: 1 });
    }
  }, [destination, preselect]);

  // Sisa stok seluruh tanggal, sekali per destinasi. Tidak bergantung pada
  // form.date: strip harus menulis angka di semua kartunya sebelum satu pun
  // tanggal dipilih, dan itu justru inti gunanya.
  useEffect(() => {
    if (!destId) return;
    let batal = false;
    fetch(`/api/bookings?dest=${encodeURIComponent(destId)}&days=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (batal || !data) return;
        setDays((data.days ?? {}) as Record<string, ItemAvailability[]>);
        setDasar((data.items ?? []) as ItemAvailability[]);
      })
      .catch(() => {
        // Gagal memuat angka sisa bukan alasan memblokir formulir: server tetap
        // memeriksanya saat membayar, jadi yang hilang cuma angka di layar —
        // dan `dasar` yang kosong membuat semua tanggal terbaca tanpa batas,
        // bukan habis. Menutup tanggal karena jaringan gagal jauh lebih buruk
        // daripada membiarkan server yang menolak nanti.
      });
    return () => {
      batal = true;
    };
  }, [destId]);

  // Jumlah yang terlanjur dipilih diturunkan kalau tanggal barunya lebih sempit.
  //
  // Sengaja hanya bergantung pada tanggal & data yang termuat, bukan pada objek
  // sisaTanggal — objek itu dibentuk ulang tiap render, dan effect yang
  // mengejarnya akan berjalan tanpa henti.
  useEffect(() => {
    if (!form.date) return;
    const av = days[form.date] ?? dasar;
    setQty((q) => {
      let berubah = false;
      const next: Record<string, number> = {};
      for (const [id, n] of Object.entries(q)) {
        const batas = av.find((a) => a.id === id)?.remaining ?? null;
        const dipangkas = batas === null ? n : Math.min(n, batas);
        if (dipangkas !== n) berubah = true;
        next[id] = dipangkas;
      }
      return berubah ? next : q;
    });
  }, [form.date, days, dasar]);

  // Booking yang dibuka untuk diubah bisa menemukan stoknya sudah habis diambil
  // orang lain — jumlahnya dipangkas effect di atas sampai nol, tombol simpan
  // mati, dan tanpa kalimat ini tidak ada satu pun petunjuk kenapa.
  useEffect(() => {
    if (editId && !loadingEdit && !editError && form.date && totalQty === 0) {
      setError(t('booking.itemFull'));
    }
  }, [editId, loadingEdit, editError, form.date, totalQty, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) {
      router.push('/profile');
      return;
    }
    if (!destination) {
      setError('Pilih destinasi terlebih dahulu.');
      return;
    }
    if (totalQty === 0) {
      setError('Pilih minimal satu item.');
      return;
    }
    // Dulu ini dikerjakan atribut `required` pada input tanggal. Input itu
    // sekarang cuma muncul kalau pengguna menekan "Tanggal lain", jadi
    // penjaganya harus pindah ke sini — tanpa ini, formulir tanpa tanggal
    // terkirim dan ditolak server dengan pesan yang jauh lebih membingungkan.
    if (!form.date) {
      setError(t('booking.needDate'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      // Yang dikirim cuma "item mana, berapa banyak" — harga & total dihitung
      // ulang server dari dokumen destinasi. Angka di ringkasan sebelah kanan
      // murni perkiraan untuk dilihat, bukan yang ditagihkan.
      if (editId) {
        // Destinasi tidak ikut dikirim: server membacanya dari dokumen
        // bookingnya sendiri (lihat update di /api/bookings).
        await updateBooking({
          bookingId: editId,
          date: form.date,
          phone: form.phone,
          notes: form.notes,
          qty,
          hours,
        });
      } else {
        await createBooking({
          destinationId: destination.id,
          date: form.date,
          phone: form.phone,
          notes: form.notes,
          qty,
          hours,
        });
      }
      setSuccess(true);
    } catch (err) {
      const code = (err as Error | null)?.message;
      // 'full' = stoknya keburu diambil orang lain. Bukan kegagalan sistem, jadi
      // pesannya harus beda — kalau disamakan dengan "coba lagi", pengunjung
      // mengulang terus untuk kursi yang memang sudah tidak ada.
      //
      // 'already-paid'/'cancelled' malah terminal: bookingnya berubah di tempat
      // lain sementara layar ini terbuka, dan mengulang tidak akan menolong.
      setError(
        code === 'full'
          ? t('booking.itemFull')
          : code === 'already-paid' || code === 'cancelled'
            ? t('booking.editLocked')
            : t('booking.failed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Tanpa destinasi terpilih (mis. dari tab Booking) → tampilkan daftar booking yang berlangsung
  if (!destId) {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in">
        <BookingHistory variant="active" />
      </div>
    );
  }

  // Booking yang tidak bisa diubah (sudah dibayar, dibatalkan, atau item-nya
  // tidak ada lagi di daftar harga). Formulirnya sengaja tidak dirender: yang
  // tampil di situ tidak akan sama dengan yang bisa disimpan server.
  if (editError) {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in text-center py-16">
        <div className="card p-8 sm:p-10 flex flex-col items-center gap-4">
          <p className="text-sm text-navy-soft">{t(editError)}</p>
          <button
            onClick={() => router.push('/booking')}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            {t('booking.backToBookings')}
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in text-center py-16">
        <div className="card p-8 sm:p-10 flex flex-col items-center gap-4">
          <CheckCircleIcon />
          <h2 className="font-serif text-xl font-medium text-navy">
            {t(editId ? 'booking.editSuccessTitle' : 'booking.successTitle')}
          </h2>
          <p className="text-sm text-navy-soft max-w-xs">
            {t(editId ? 'booking.editSuccessBody' : 'booking.successBody', {
              dest: destination?.name ?? '',
              date: new Date(form.date).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            })}
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => router.push('/booking')}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              {t('booking.goToPayment')}
            </button>
            {/* "Booking Lagi" cuma masuk akal setelah membuat: sesudah
                mengubah, mengosongkan formulir yang sama malah mengundang
                booking kedua yang tidak diminta siapa pun. */}
            {!editId && (
              <button
                onClick={() => {
                  setSuccess(false);
                  setForm({ date: '', phone: '', notes: '' });
                  setQty(priceItems.length > 0 ? { [priceItems[0].id]: 1 } : {});
                  setHours(1);
                }}
                className="btn-ghost px-5 py-2.5 text-sm"
              >
                {t('booking.bookAgain')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Menahan formulir sampai isi bookingnya termuat. Merender lebih awal berarti
  // pengguna sempat melihat "tiket masuk ×1" — yang bukan isi bookingnya — lalu
  // angkanya melompat sendiri beberapa ratus milidetik kemudian.
  if (loadingEdit) {
    return (
      <div className="w-full max-w-5xl mx-auto animate-fade-in">
        <div className="card p-8 animate-pulse space-y-4">
          <div className="h-4 w-1/3 rounded-full bg-shore-100" />
          <div className="h-4 w-2/3 rounded-full bg-shore-100" />
          <div className="h-4 w-1/2 rounded-full bg-shore-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
      <h1 className="section-title">{t(editId ? 'booking.editTitle' : 'booking.title')}</h1>
      <p className="section-lede">{t(editId ? 'booking.editLede' : 'booking.lede')}</p>

      {/* minmax(0,1fr), bukan 1fr: kolom grid punya min-width:auto, jadi isi
          yang lebih lebar dari ruangnya MELEBARKAN kolomnya alih-alih bergulir
          di dalamnya. Sebelum ini, strip tanggal mendorong ringkasan keluar
          layar dan seluruh halaman ikut bisa digeser ke samping. */}
      <form onSubmit={handleSubmit} className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:items-start">
        {/* KIRI: field-field */}
        <div className="space-y-5">
            {/* Destination info */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-navy-soft">{t('booking.destination')}</label>
              {loadingDest ? (
                <div className="rounded-md border border-shore-200 bg-surface px-3.5 py-3 animate-pulse">
                  <div className="h-4 w-2/3 rounded-full bg-shore-100" />
                </div>
              ) : destination ? (
                <div className="rounded-md border border-teal-200 bg-teal-50/50 px-4 py-3 flex items-center gap-3">
                  {destination.image ? (
                    <img src={destination.image} alt={destination.name} className="h-10 w-10 rounded-sm object-cover shrink-0" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm font-serif text-lg font-semibold text-white" style={{ background: destination.thumbColor }} aria-hidden="true">{destination.name.trim().charAt(0).toUpperCase()}</span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate capitalize">{destination.name}</p>
                    <p className="text-xs text-navy-soft capitalize">{destination.location}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-shore-200 bg-surface px-4 py-3">
                  <p className="text-sm text-navy-soft">{t('booking.noDestination')} <button type="button" onClick={() => router.push('/beranda#destinasi')} className="text-teal-600 hover:text-teal-700 font-medium">{t('booking.pickFromHome')}</button></p>
                </div>
              )}
            </div>

            {/* Pilih item harga */}
            {destination && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-soft">{t('booking.selectItems')}</label>
                {priceItems.length === 0 ? (
                  <div className="rounded-md border border-shore-200 bg-surface px-4 py-3">
                    <p className="text-sm text-navy-soft">{t('booking.noPrices')}</p>
                  </div>
                ) : (
                  <div className="rounded-md border border-shore-200 bg-surface divide-y divide-shore-100">
                    {priceItems.map((it) => {
                      const batas = sisaOf(it.id);
                      const habis = batas === 0;
                      const mentok = batas !== null && (qty[it.id] ?? 0) >= batas;
                      return (
                      <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy truncate capitalize">{it.label}</p>
                          <p className="text-xs text-navy-soft">
                            {formatIDR(it.price)} <span className="text-navy-soft/70">{it.unit}</span>
                          </p>
                          {/* Angka sisa cuma muncul kalau item ini memang dibatasi
                              DAN tanggalnya sudah dipilih — tanpa tanggal, "sisa"
                              tidak punya arti. */}
                          {batas !== null && (
                            <p className={clsx('mt-0.5 text-2xs font-medium', habis ? 'text-danger' : 'text-navy-soft')}>
                              {habis ? t('booking.soldOut') : t('booking.remaining', { n: String(batas) })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            aria-label={t('booking.decrease', { item: it.label })}
                            onClick={() => setItemQty(it.id, (qty[it.id] ?? 0) - 1)}
                            className="h-7 w-7 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:text-navy hover:border-shore-300 transition-colors"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-medium text-navy">{qty[it.id] ?? 0}</span>
                          <button
                            type="button"
                            aria-label={t('booking.increase', { item: it.label })}
                            onClick={() => setItemQty(it.id, (qty[it.id] ?? 0) + 1)}
                            disabled={mentok}
                            className="h-7 w-7 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:text-navy hover:border-shore-300 transition-colors disabled:opacity-40 disabled:hover:border-shore-200 disabled:hover:text-navy-soft"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Durasi ditaruh menempel pada daftar item, bukan di baris
                    Tanggal/Jumlah Orang: yang ditanyakan di sini menyangkut
                    item tertentu, dan kolomnya ikut hilang begitu item per jam
                    terakhir dilepas. */}
                {adaPerJam && (
                  <div className="mt-3">
                    <label htmlFor="booking-hours" className="mb-1.5 block text-xs font-medium text-navy-soft">
                      {t('booking.hoursLabel')}
                    </label>
                    <input
                      id="booking-hours"
                      type="number"
                      min={1}
                      max={MAX_HOURS}
                      value={hours}
                      onChange={(e) =>
                        // `|| 1` menangkap input yang dikosongkan: Number('')
                        // itu 0, dan 0 jam berarti tagihan nol untuk alat yang
                        // tetap dibawa pulang.
                        setHours(
                          Math.min(MAX_HOURS, Math.max(1, Math.floor(Number(e.target.value)) || 1)),
                        )
                      }
                      className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                    />
                    <p className="mt-1 text-2xs text-navy-soft">{t('booking.hoursHint')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tanggal — selebar kolom, bukan lagi separuh di sebelah Jumlah
                Orang: kartunya perlu ruang untuk digeser, dan angka sisa di
                tiap kartu adalah alasan utama seksi ini ada. */}
            <DateStrip
              value={form.date}
              onChange={(date) => setForm((f) => ({ ...f, date }))}
              fitOf={fitOf}
              min={today}
            />

            {/* Jumlah Orang tidak ditanyakan lagi: jumlahnya sudah disebut per
                item di atas, dan dua angka yang bisa berbeda cuma menyisakan
                pertanyaan mana yang benar saat tiketnya di-scan. */}

            {/* Nama — dari akun, tidak bisa diubah di sini. Yang tersimpan di
                tiket ditentukan server dari akun yang sama, jadi ini benar-benar
                cuma tampilan. */}
            <div>
              {/* Tanpa bintang: bukan lagi kolom yang diisi. */}
              <label className="mb-1.5 block text-xs font-medium text-navy-soft">{t('booking.name')}</label>
              <div className="w-full rounded-md border border-shore-200 bg-shore-50 px-3.5 py-2.5 text-sm text-navy">
                {namaAkun || <span className="text-navy-soft">{t('booking.namePlaceholder')}</span>}
              </div>
              <p className="mt-1 text-2xs text-navy-soft">{t('booking.nameHint')}</p>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="booking-phone" className="mb-1.5 block text-xs font-medium text-navy-soft">{t('booking.phoneLabel')}</label>
              <input
                  id="booking-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08xxxxxxxxxx"
                required
                className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="booking-notes" className="mb-1.5 block text-xs font-medium text-navy-soft">{t('booking.notesLabel')}</label>
              <textarea
                  id="booking-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t('booking.notesPlaceholder')}
                rows={3}
                className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors resize-none"
              />
            </div>

        </div>

        {/* KANAN: ringkasan sticky */}
        <aside className="mt-6 lg:mt-0 lg:sticky lg:top-24">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-navy">{t('booking.summary')}</h2>

            {selectedItems.length > 0 ? (
              <div className="space-y-2">
                {selectedItems.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-navy-soft capitalize">
                      {it.label}{' '}
                      <span className="text-navy-soft/60">
                        ×{qty[it.id] ?? 0}
                        {/* Durasi dicetak per baris, bukan sekali di bawah:
                            dalam satu booking bisa ada tiket masuk yang tidak
                            ikut dikali jam di sebelah alat selam yang ikut. */}
                        {isHourly(it) && ` · ${t('booking.hour', { n: String(hours) })}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-navy">{formatIDR(it.price * (qty[it.id] ?? 0) * kali(it))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-navy-soft">{t('booking.noItems')}</p>
            )}

            <div className="flex items-center justify-between border-t border-shore-100 pt-3">
              <span className="text-sm text-navy-soft">{t('booking.estTotal')}</span>
              <span className="text-lg font-semibold text-navy">{formatIDR(total)}</span>
            </div>

            {error && (
              <div className="rounded-md bg-danger-soft border border-danger-rule px-4 py-3 text-sm text-danger animate-fade-up">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !destination || totalQty === 0}
              className="btn-primary w-full px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {submitting
                ? t('booking.submitting')
                : t(editId ? 'booking.editSubmit' : 'booking.confirm')}
            </button>

            {/* Jalan keluar dari mode ubah tanpa menyimpan. Tanpa ini satu-satunya
                cara mundur adalah tombol back browser, yang di aplikasi terpasang
                (standalone PWA) tidak selalu ada. */}
            {editId && (
              <button
                type="button"
                onClick={() => router.push('/booking')}
                className="btn-ghost w-full px-4 py-2.5 text-sm"
              >
                {t('booking.editCancel')}
              </button>
            )}

            {!user ? (
              <p className="text-center text-xs text-navy-soft">
                {t('booking.needLoginPre')}<button type="button" onClick={() => router.push('/profile')} className="text-teal-600 font-medium hover:text-teal-700">{t('booking.needLoginLink')}</button>{t('booking.needLoginPost')}
              </p>
            ) : !user.emailVerified ? (
              <p className="text-center text-xs text-navy-soft">
                <button type="button" onClick={() => router.push('/profile')} className="text-teal-600 font-medium hover:text-teal-700">{t('booking.needVerifyLink')}</button>{t('booking.needVerifyPost')}
              </p>
            ) : null}
          </div>
        </aside>
      </form>
    </div>
  );
}

export default function Booking() {
  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-28 md:pb-0">
      <TopNav compact />
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <Suspense>
          <BookingContent />
        </Suspense>
      </section>
      <Footer />
      <BottomNav />
    </main>
  );
}
