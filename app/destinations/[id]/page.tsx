'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getPriceItems,
  priceFrom,
  subscribeChildDestinations,
  subscribeReviews,
  reviewStats,
  type Destination,
  type Review,
} from '@/lib/firestore';
import { destinationCameraIds } from '@/lib/destination';
import { stationPath } from '@/lib/realtime';
import { formatIDR, isoDate, waLink } from '@/lib/format';
import TopNav from '@/components/desktop/TopNav';
import DesktopDestinationCard from '@/components/desktop/DesktopDestinationCard';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';
import LiveMonitorPanel from '@/components/destinations/LiveMonitorPanel';
import DestinationReviews, { StarRow } from '@/components/destinations/DestinationReviews';
import { useAuthState } from '@/lib/useAuth';
import { useLang } from '@/lib/useLang';

function ArrowLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}


export default function DestinationDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthState();
  const { t } = useLang();
  const [dest, setDest] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [children, setChildren] = useState<Destination[]>([]);
  /** Sisa stok tiap item untuk HARI INI. null / tidak ada = tanpa batas. */
  const [sisa, setSisa] = useState<Record<string, number | null>>({});
  const initedForId = useRef<string | null>(null);

  useEffect(() => {
    if (!db || !id) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'destinations', id), (snap) => {
      if (snap.exists()) {
        setDest({ id: snap.id, ...snap.data() } as Destination);
      } else {
        setDest(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeReviews(id, setReviews);
  }, [id]);

  // Query terpisah, bukan turunan dari koleksi penuh: halaman ini sudah hanya
  // berlangganan satu dokumen, dan menarik seluruh destinasi cuma untuk mencari
  // anaknya membalik itu jadi pembacaan sekoleksi tiap kali halaman dibuka.
  useEffect(() => {
    if (!id) return;
    return subscribeChildDestinations(id, setChildren);
  }, [id]);

  // Sisa kursi hari ini. Halaman ini tidak punya pemilih tanggal, jadi angkanya
  // dipatok ke hari ini — cukup untuk menjawab "masih ada nggak?" sebelum orang
  // masuk ke formulir, dan tanggal lain tetap dihitung ulang di /booking.
  //
  // Alasan lengkap kenapa isoDate() dan bukan toISOString() ada di lib/format.
  //
  // Lewat route agregat, bukan query langsung: rules menutup baca koleksi
  // bookings, dan yang dikembalikan route itu memang cuma angka — tanpa nama
  // atau nomor telepon siapa pun.
  // Boolean, bukan daftar itemnya: nilainya cuma berubah saat pengelola mulai
  // (atau berhenti) membatasi stok, jadi effect di bawah tidak ikut menembak
  // ulang tiap kali snapshot realtime destinasi masuk.
  const adaStok = dest
    ? getPriceItems(dest).some((it) => typeof it.stock === 'number')
    : false;

  useEffect(() => {
    // Sebagian besar destinasi belum membatasi stok apa pun. Untuk mereka
    // jawabannya sudah pasti "tanpa batas", jadi permintaannya tidak dikirim
    // sama sekali — bukan dikirim lalu hasilnya dibuang.
    if (!id || !adaStok) return;
    const hariIni = isoDate();
    let batal = false;
    fetch(`/api/bookings?dest=${encodeURIComponent(id)}&date=${hariIni}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (batal || !data?.items) return;
        setSisa(
          Object.fromEntries(
            (data.items as { id: string; remaining: number | null }[]).map((a) => [
              a.id,
              a.remaining,
            ]),
          ),
        );
      })
      .catch(() => {
        // Gagal mengambil angka sisa bukan alasan menyembunyikan daftar harga:
        // yang hilang cuma satu baris keterangan, bookingnya tetap jalan.
      });
    return () => {
      batal = true;
    };
  }, [id, adaStok]);

  // Pra-pilih item pertama (biasanya tiket masuk) sekali per destinasi saat
  // harga tersedia. Dikunci per id agar update realtime tidak menimpa pilihan
  // user, tapi tetap ter-reset bila berpindah destinasi.
  useEffect(() => {
    if (!dest || initedForId.current === dest.id) return;
    const items = getPriceItems(dest);
    if (items.length === 0) return;
    setSelectedIds([items[0].id]);
    initedForId.current = dest.id;
  }, [dest]);

  if (loading) {
    return (
      <main className="min-h-dvh bg-shore-50">
        <TopNav compact />
        <div className="mx-auto max-w-4xl animate-pulse space-y-6 px-4 py-10 sm:px-6 lg:px-10">
          <div className="h-64 rounded-md bg-shore-100 sm:h-80" />
          <div className="h-6 w-2/3 rounded-full bg-shore-100" />
          <div className="h-4 w-1/3 rounded-full bg-shore-100" />
          <div className="h-20 rounded-md bg-shore-100" />
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!dest) {
    return (
      <main className="min-h-dvh bg-shore-50">
        <TopNav compact />
        <div className="flex flex-col items-center justify-center gap-4 py-32">
          <p className="text-sm text-navy-soft">{t('dest.notFound')}</p>
          <button onClick={() => router.push('/beranda')} className="btn-primary px-5 py-2.5 text-sm">
            Kembali ke Beranda
          </button>
        </div>
        <BottomNav />
      </main>
    );
  }

  const priceItems = getPriceItems(dest);
  // Satu item berfoto sudah cukup untuk memberi slot foto ke semua item — itu
  // yang menyamakan tinggi kartunya. Nol foto berarti tidak ada slot sama sekali.
  const anyItemImage = priceItems.some((i) => !!i.image);
  const { avg, count } = reviewStats(reviews);

  /**
   * Destinasi ini menjual sesuatu sendiri, bukan cuma menaungi destinasi lain.
   *
   * Kawasan seluas provinsi biasanya berbentuk begitu: harganya menempel di tiap
   * spot, dokumen induknya sendiri tanpa item. Tanpa cabang ini seksi daftar
   * harga tetap dirender untuk mereka — "belum ada daftar harga" berdiri persis
   * di atas tombol Booking yang justru AKTIF (syarat disabled-nya minta
   * priceItems tidak kosong), dan tombol itu mengantar ke /booking tanpa satu
   * item pun. Ajakan bookingnya sudah dipikul tiap kartu spot di atas.
   */
  const sellsDirectly = priceItems.length > 0 || children.length === 0;

  // Tautan keluar, bukan peta tertanam: pengunjung sudah punya aplikasi peta
  // pilihannya sendiri, dan halaman ini tidak perlu menanggung bundel peta.
  const mapsHref =
    typeof dest.lat === 'number' && typeof dest.lng === 'number'
      ? `https://www.google.com/maps/search/?api=1&query=${dest.lat},${dest.lng}`
      : null;
  const waHref = dest.whatsapp
    ? waLink(dest.whatsapp, `Halo, saya mau tanya soal ${dest.name}.`)
    : null;

  const toggleItem = (itemId: string) =>
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    );

  const goToBooking = () => {
    // Butuh akun terverifikasi. Belum login / belum verifikasi → ke /profile
    // (di sana tampil form masuk atau layar verifikasi email).
    if (!user || !user.emailVerified) {
      router.push('/profile');
      return;
    }
    const params = new URLSearchParams({ dest: dest.id });
    if (selectedIds.length > 0) params.set('items', selectedIds.join(','));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-28 md:pb-0">
      <TopNav compact />

      {/* Hero immersive — foto full-bleed, scrim laut-dalam, judul di-overlay. */}
      <section className="grain relative h-[58vh] min-h-[400px] w-full overflow-hidden">
        {dest.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dest.image}
            alt={dest.name}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // Pelat tipografis, bukan emoji — lihat design.md § Per-page allowances.
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: dest.thumbColor }}
            aria-hidden="true"
          >
            <span className="font-serif text-display font-semibold text-white/80">
              {dest.name.trim().charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {/* Scrim kedalaman — dibangun di token `ink` yang selalu gelap. */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 to-ink/85" />

        {/* Back button */}
        <div className="absolute inset-x-0 top-0 z-10">
          <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6 lg:px-10">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-sm border border-white/20 bg-ink/40 px-3.5 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-ink/60"
            >
              <ArrowLeftIcon />
              Kembali
            </button>
          </div>
        </div>

        {/* Judul + lokasi + rating */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-10">
            <h1 className="animate-fade-up font-serif text-display font-semibold capitalize text-white">
              {dest.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-white/80">
                <PinIcon />
                <span className="capitalize">{dest.location}</span>
              </span>
              {count > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <StarRow value={avg} size={15} />
                  <span className="text-sm font-semibold text-white">{avg.toFixed(1)}</span>
                  <span className="text-xs text-white/60">· {count} ulasan</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sheet konten naik di atas foto. */}
      <div className="relative z-10 -mt-6 rounded-t-lg bg-shore-50">
        <article className="mx-auto max-w-4xl animate-fade-in px-4 py-10 sm:px-6 sm:py-12 lg:px-10">
          <div className="space-y-10">
            {/* Aksi cepat — rute & kontak pengelola. Keduanya opsional per
                destinasi; barisnya hilang sendiri kalau dua-duanya kosong. */}
            {/* Jalan naik ke kawasan induk. Wajib ada, bukan pemanis: spot di
                dalam kawasan tidak muncul di beranda maupun pencariannya, jadi
                pengunjung yang tiba dari tautan yang dibagikan tidak punya cara
                lain menemukan kawasannya. Teksnya sengaja umum — nama induknya
                butuh satu pembacaan dokumen lagi, dan tautan ini tidak sepadan
                dengan itu. */}
            {dest.parentId && (
              <Link
                href={`/destinations/${dest.parentId}`}
                className="btn-text -mt-2 inline-flex items-center gap-1.5"
              >
                <ArrowLeftIcon />
                {t('dest.openParent')}
              </Link>
            )}

            {(mapsHref || waHref) && (
              <div className="flex flex-wrap gap-3">
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost px-4 py-2.5 text-sm"
                  >
                    <PinIcon />
                    Rute ke lokasi
                  </a>
                )}
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost px-4 py-2.5 text-sm"
                  >
                    <ChatIcon />
                    Chat pengelola
                  </a>
                )}
              </div>
            )}

            {/* Tags */}
            {dest.tags?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {dest.tags.map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>
            )}

            {/* Deskripsi — kolom prosa terukur, bukan kartu di dalam kolom yang
                sudah punya batas sendiri (design.md § Surface language). */}
            {dest.description && (
              <section>
                <h2 className="section-title">{t('dest.about')}</h2>
                <p className="mt-4 max-w-[65ch] whitespace-pre-line text-base leading-relaxed text-navy">
                  {dest.description}
                </p>
              </section>
            )}

            {/* Galeri — strip geser ber-snap, keluar dari padding kolom supaya
                foto terakhir "mengintip" di tepi layar dan jelas bisa digeser.
                Foto hero (dest.image) sengaja tidak diulang di sini. */}
            {dest.images && dest.images.length > 0 && (
              <section>
                <h2 className="section-title">{t('dest.gallery')}</h2>
                <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
                  {dest.images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt={`${dest.name} — foto ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-48 w-72 shrink-0 snap-start rounded-md object-cover sm:h-56 sm:w-80"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Pantau langsung — kamera (kalau di-link & boleh ditonton) + sensor
                IoT. Di atas item, bukan di bawahnya: kondisi laut hari ini yang
                menentukan pengunjung jadi memesan atau tidak, jadi dia harus
                sudah terbaca sebelum daftar yang dijual. */}
            {(destinationCameraIds(dest).length > 0 || stationPath(dest)) && (
              <LiveMonitorPanel
                cameraDocIds={destinationCameraIds(dest)}
                sensorPath={stationPath(dest)}
              />
            )}

            {/* Satu bagian untuk semua yang ditawarkan destinasi ini: tempat di
                dalamnya yang bisa dibuka lagi, lalu item yang langsung dibeli.
                Dulu dua bagian bersebelahan, dan judul besar kedua memecah satu
                pilihan ("mau apa di sini?") jadi dua keputusan terpisah.

                Judulnya ikut isi: destinasi biasa — yang mayoritas — tetap
                berkepala "Daftar harga" seperti sebelumnya, judul gabungan hanya
                muncul saat kawasan ini memang berisi tempat lain. */}
            {(children.length > 0 || sellsDirectly) && (
            <section>
              <h2 className="section-title">
                {t(children.length > 0 ? 'dest.offeringsTitle' : 'dest.priceList')}
              </h2>

              {children.length > 0 && (
                <>
                  <p className="section-lede">
                    {t(children.length === 1 ? 'dest.insideLedeOne' : 'dest.insideLede', {
                      count: children.length,
                    })}
                  </p>
                  {/* Tiga kolom, bukan dua. Kartunya sama persis dengan beranda,
                      tapi kolom halaman ini max-w-4xl sementara beranda max-w-7xl:
                      dua kolom di sini melebarkan tiap kartu ke ~410px, setengah
                      kali lebih besar daripada kartu yang sama di beranda. Angka
                      kolomnya beda supaya ukuran kartunya yang sama. */}
                  <div className="mt-4 grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3">
                    {children.map((child) => (
                      <div key={child.id} className="h-full">
                        {/* Kartu yang sama persis dengan beranda — sebuah spot di
                            dalam kawasan tetap destinasi utuh, bukan baris daftar.
                            managerUid hanya diteruskan bila spot ini benar-benar
                            punya stasiun: kartu memakainya sebagai penanda "layak
                            dapat ringkasan sensor", dan tiap spot mewarisi
                            managerUid induknya — tanpa saringan ini seluruh grid
                            berisi catatan "stasiun sensor belum terpasang" yang
                            sama, di bawah panel sensor kawasan yang baru saja
                            menayangkan angkanya. */}
                        <DesktopDestinationCard
                          {...child}
                          managerUid={stationPath(child) ? child.managerUid : undefined}
                          priceFrom={priceFrom(child, children)}
                          bookable={getPriceItems(child).length > 0}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Blok harga tetap satu kelompok tersendiri di dalam bagian ini.
                  Tombol Booking di bawah hanya berlaku untuk item di atasnya,
                  bukan untuk kartu tempat — tanpa jarak dan sub-judul ini,
                  "Pilih item dulu" terbaca seolah menunggu salah satu kartu
                  destinasi dipilih, padahal kartu itu memang tidak bisa dipilih. */}
              {sellsDirectly && (
              <div className={children.length > 0 ? 'mt-8 space-y-4' : 'mt-4 space-y-4'}>
                {children.length > 0 && (
                  <h3 className="font-serif text-lg font-semibold text-navy">
                    {t('dest.priceList')}
                  </h3>
                )}
              {priceItems.length > 0 ? (
                // Satu bentuk untuk semua item: baris rapat dengan thumbnail
                // persegi di kiri. Sebelumnya item berfoto jadi kartu bergambar
                // 4:3 sementara tetangganya kartu teks setinggi sepertiganya —
                // satu baris grid berisi dua tinggi yang jauh berbeda, dan yang
                // pendek meninggalkan lubang di bawahnya. Thumbnail berukuran
                // tetap membuat tinggi tiap kartu ditentukan hal yang sama,
                // berfoto atau tidak.
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {priceItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    // null = tanpa batas, jadi tidak ada yang perlu diberitahukan.
                    const sisaHariIni = sisa[item.id] ?? null;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        aria-pressed={isSelected}
                        className={`flex items-center gap-3 rounded-md border p-2.5 text-left transition-colors duration-micro ease-out ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50'
                            : 'border-shore-200 bg-surface hover:border-shore-300'
                        }`}
                      >
                        {/* Slotnya muncul untuk SEMUA item begitu ada satu saja
                            yang berfoto — itu yang membuat tinggi kartunya sama
                            dan teksnya mulai di garis yang sama. Kalau tidak ada
                            satu pun foto di daftar ini, slotnya tidak dirender:
                            sebaris kotak kosong tidak menyeragamkan apa pun,
                            cuma menyisakan ruang mati di kiri tiap kartu. */}
                        {anyItemImage && (
                          <span className="h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-shore-100">
                            {item.image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt={item.label}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            )}
                          </span>
                        )}

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold capitalize leading-snug text-navy">
                            {item.label}
                          </span>
                          {item.description && (
                            // Satu baris, dipotong: dua baris membuat kartu yang
                            // punya keterangan lebih tinggi daripada yang tidak.
                            <span className="mt-0.5 block truncate text-xs text-navy-soft">
                              {item.description}
                            </span>
                          )}
                          <span className="tabular mt-0.5 block text-sm font-semibold text-navy">
                            {formatIDR(item.price)}
                            <span className="text-xs font-normal text-navy-soft"> {item.unit}</span>
                          </span>
                          {/* Habis hari ini SENGAJA tidak mematikan kartunya.
                              Angka ini cuma berlaku hari ini, sedangkan tujuan
                              tombol di bawah adalah formulir yang tanggalnya
                              bebas — mengunci di sini akan memblokir booking
                              untuk minggu depan gara-gara stok hari ini. */}
                          {sisaHariIni !== null && (
                            <span
                              className={`mt-0.5 block text-2xs font-medium ${
                                sisaHariIni === 0 ? 'text-danger' : 'text-navy-soft'
                              }`}
                            >
                              {sisaHariIni === 0
                                ? t('dest.soldOutToday')
                                : t('dest.remainingToday', { n: String(sisaHariIni) })}
                            </span>
                          )}
                        </span>

                        <span
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-xs border transition-colors duration-micro ease-out ${
                            isSelected ? 'border-teal-600 bg-teal-600 text-white' : 'border-shore-300 bg-surface'
                          }`}
                        >
                          {isSelected && <CheckIcon />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-navy-soft">
                  {t('dest.noPriceList')}
                </p>
              )}
              <button
                onClick={goToBooking}
                disabled={priceItems.length > 0 && selectedIds.length === 0}
                className="btn-primary w-full px-6 py-3"
              >
                {priceItems.length > 0
                  ? selectedIds.length > 0
                    ? `Booking · ${selectedIds.length} item`
                    : 'Pilih item dulu'
                  : 'Booking'}
              </button>
              </div>
              )}
            </section>
            )}

            {/* Ulasan pengunjung */}
            <DestinationReviews destinationId={dest.id} reviews={reviews} />
          </div>
        </article>
      </div>

      <Footer />
      <BottomNav />
    </main>
  );
}
