'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import type { UserRole } from '@/lib/useAuth';
import { subscribeUserBookings, subscribeUserReviews, type Booking } from '@/lib/firestore';
import BookingHistory from '@/components/booking/BookingHistory';
import AccountSettings from '@/components/profile/AccountSettings';
import PengelolaRequest from '@/components/profile/PengelolaRequest';
import RoleBadge, { roleInfo } from '@/components/profile/RoleBadge';
import SavedDestinations from '@/components/profile/SavedDestinations';
import Link from 'next/link';
import { useTheme } from '@/lib/useTheme';
import { useLang } from '@/lib/useLang';
import { LANGS } from '@/lib/i18n';
import { waLink } from '@/lib/format';

function LogOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </svg>
  );
}

// Kontak dukungan Nusa. Nomor kosong = tombol WhatsApp disembunyikan
// (waLink mengembalikan null), jadi tidak ada tautan mati di halaman bantuan.
const SUPPORT_EMAIL = 'ilham_lam@icloud.com';
const SUPPORT_WA = '';

const faq: { group: string; items: { q: string; a: string }[] }[] = [
  {
    group: 'Akun',
    items: [
      {
        q: 'Kenapa saya diminta verifikasi email?',
        a: 'Setelah daftar pakai email & password, kami kirim link verifikasi ke alamat kamu. Halaman profil, booking, dan kamera baru terbuka setelah link itu diklik. Masuk lewat Google langsung terverifikasi, jadi langkah ini dilewati.',
      },
      {
        q: 'Link verifikasi tidak masuk, bagaimana?',
        a: 'Cek folder Spam atau Promosi dulu. Kalau tetap tidak ada, tekan tombol kirim ulang di halaman verifikasi — email lama akan digantikan yang baru. Pastikan alamat email yang dipakai tidak salah ketik.',
      },
      {
        q: 'Cara ganti nama, nomor telepon, atau password?',
        a: 'Buka Profil › Pengaturan. Nama dan nomor telepon bisa diubah di kartu paling atas. Ganti password hanya tersedia untuk akun email & password; akun Google diatur lewat pengaturan akun Google.',
      },
    ],
  },
  {
    group: 'Booking & pembayaran',
    items: [
      {
        q: 'Bagaimana cara memesan tiket?',
        a: 'Buka halaman destinasi, tekan Booking, lalu pilih jenis tiket dan jumlahnya. Isi tanggal kunjungan, nama, dan nomor telepon, lalu kirim. Tiket langsung terbit dengan status Terkonfirmasi.',
      },
      {
        q: 'Metode pembayaran apa saja yang tersedia?',
        a: 'Transfer bank (BCA, Mandiri, BNI), e-wallet (GoPay, OVO, DANA), atau tunai di lokasi. Pilih metodenya lewat tombol Bayar di Riwayat Booking. Tiket tetap berlaku walau statusnya belum lunas — pembayaran tunai diselesaikan di loket.',
      },
      {
        q: 'Di mana tiket dan QR-nya?',
        a: 'Profil › Riwayat Booking, lalu buka booking yang dimaksud. Tunjukkan QR di layar kepada petugas saat check-in. Satu tiket hanya bisa dipindai sekali; setelah itu statusnya berubah jadi Terpakai.',
      },
      {
        q: 'Bisa membatalkan booking?',
        a: 'Bisa, lewat Riwayat Booking › Batalkan. Pembatalan bersifat permanen — tiket yang sudah dibatalkan tidak bisa diaktifkan lagi, jadi pastikan dulu sebelum konfirmasi. Untuk pengembalian dana, hubungi pengelola destinasi.',
      },
      {
        q: 'Bagaimana kalau mau ubah tanggal atau jumlah orang?',
        a: 'Pengubahan belum bisa dilakukan sendiri dari aplikasi. Hubungi pengelola destinasi lewat tombol WhatsApp di halaman destinasi, atau batalkan booking lalu pesan ulang dengan data yang benar.',
      },
    ],
  },
  {
    group: 'Destinasi & pemantauan',
    items: [
      {
        q: 'Angka suhu dan cuaca di halaman destinasi itu dari mana?',
        a: 'Dari sensor IoT yang terpasang di destinasi tersebut: suhu udara, kelembapan, suhu air, kondisi cuaca, dan kecepatan angin. Nilainya diperbarui real-time. Destinasi tanpa sensor tidak menampilkan panel ini.',
      },
      {
        q: 'Kenapa data sensor menampilkan tanda "--"?',
        a: 'Artinya perangkat sedang tidak mengirim data — biasanya karena listrik atau koneksi di lokasi terputus. Angka akan muncul lagi sendiri begitu perangkat kembali online.',
      },
      {
        q: 'Cara menyimpan destinasi favorit?',
        a: 'Tekan ikon hati di kartu destinasi. Semua yang tersimpan bisa dibuka lagi lewat Profil › Tersimpan. Fitur ini butuh akun yang sudah masuk.',
      },
    ],
  },
  {
    group: 'Pengelola & kamera',
    items: [
      {
        q: 'Bagaimana cara jadi pengelola destinasi?',
        a: 'Buka Profil › Pengaturan › Jadi Pengelola, lalu isi nama lengkap, nomor HP, instansi, dan destinasi yang dikelola. Pengajuan ditinjau admin; statusnya (menunggu, disetujui, ditolak) muncul di kartu yang sama.',
      },
      {
        q: 'Kenapa kamera saya berstatus "Menunggu admin"?',
        a: 'Setiap kamera baru harus disetujui admin sebelum bisa disiarkan. Selama masih menunggu, QR dan alamat server belum aktif. Kalau pengajuan ditolak, hapus kamera itu lalu daftarkan ulang dengan data yang benar.',
      },
    ],
  },
  {
    group: 'Lainnya',
    items: [
      {
        q: 'Ada asisten yang bisa ditanya soal destinasi?',
        a: 'Ada. Tombol chat di pojok kanan bawah menjawab pertanyaan soal destinasi, harga, dan cara booking berdasarkan katalog terbaru. Untuk urusan yang butuh manusia, hubungi kami lewat kontak di bawah.',
      },
      {
        q: 'Cara mengaktifkan mode gelap?',
        a: 'Profil › Pengaturan › Mode Gelap. Pilihannya tersimpan di perangkat ini dan tetap berlaku saat aplikasi dibuka lagi.',
      },
    ],
  },
];

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

/** `key` yang menautkan item ke aksinya; labelnya diterjemahkan saat render. */
const menuItems = [
  {
    key: 'camera',
    labelKey: 'profile.camera',
    descKey: 'profile.cameraDesc',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
  },
  {
    key: 'history',
    labelKey: 'profile.bookingHistory',
    descKey: 'profile.historyDesc',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    key: 'saved',
    labelKey: 'profile.saved',
    descKey: 'profile.savedDesc',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  },
  {
    key: 'settings',
    labelKey: 'profile.settings',
    descKey: 'profile.settingsDesc',
    icon: <SettingsIcon />,
  },
  {
    key: 'help',
    labelKey: 'profile.help',
    descKey: 'profile.helpDesc',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
];

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useLang();
  return (
    <button
      onClick={onClick}
      className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-navy-soft transition-colors hover:text-navy"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {t('common.back')}
    </button>
  );
}

export default function ProfileView({ user, role }: { user: User; role: UserRole | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'menu' | 'riwayat' | 'tersimpan' | 'pengaturan' | 'bantuan'>(
    searchParams.get('view') === 'riwayat' ? 'riwayat' : 'menu'
  );
  const { theme, setTheme, mounted } = useTheme();
  const isDark = theme === 'dark';
  const { lang, setLang, t } = useLang();

  // Statistik profil — real-time dari Firestore.
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  useEffect(() => subscribeUserBookings(user.uid, setBookings), [user.uid]);
  useEffect(() => subscribeUserReviews(user.uid, (r) => setReviewCount(r.length)), [user.uid]);
  const bookingCount = bookings.length;

  const menuActions: Record<string, () => void> = {
    camera: () => router.push('/kamera'),
    history: () => setView('riwayat'),
    saved: () => setView('tersimpan'),
    settings: () => setView('pengaturan'),
    help: () => setView('bantuan'),
  };

  const roleCard = role ? roleInfo[role] : undefined;

  const initials = user.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? 'U';

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  if (view === 'riwayat') {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in">
        <BackButton onClick={() => setView('menu')} />
        <BookingHistory />
      </div>
    );
  }

  if (view === 'tersimpan') {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in">
        <BackButton onClick={() => setView('menu')} />
        <SavedDestinations />
      </div>
    );
  }

  if (view === 'bantuan') {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in">
        <BackButton onClick={() => setView('menu')} />

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-shore-200/80">
            <h2 className="font-serif text-lg font-medium text-navy">Bantuan &amp; Dukungan</h2>
            <p className="text-2xs text-navy-soft mt-0.5">Pertanyaan yang sering ditanyakan</p>
          </div>

          {faq.map((section) => (
            <section key={section.group}>
              <h3 className="bg-shore-50 px-5 py-2 text-2xs font-semibold uppercase tracking-wide text-navy-soft">
                {section.group}
              </h3>
              <div className="divide-y divide-shore-200/80">
                {/* <details> = accordion tanpa state & tanpa JS; sudah bisa dibuka
                    keyboard dan dibaca screen reader apa adanya. */}
                {section.items.map((item) => (
                  <details key={item.q} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 text-sm font-medium text-navy transition-colors hover:bg-shore-50 [&::-webkit-details-marker]:hidden">
                      <span className="flex-1">{item.q}</span>
                      <span className="shrink-0 text-shore-300 transition-transform duration-short group-open:rotate-90">
                        <ChevronIcon />
                      </span>
                    </summary>
                    <p className="px-5 pb-4 text-sm leading-relaxed text-navy-soft">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Kontak — jalan keluar kalau FAQ tidak menjawab. */}
        <div className="card mt-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-shore-200/80">
            <h2 className="font-serif text-lg font-medium text-navy">Masih butuh bantuan?</h2>
            <p className="text-2xs text-navy-soft mt-0.5">Balasan biasanya dalam 1×24 jam kerja</p>
          </div>

          <div className="divide-y divide-shore-200/80">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Bantuan Nusa')}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-shore-50"
            >
              <div className="h-10 w-10 rounded-md bg-shore-100 flex items-center justify-center text-navy-soft shrink-0">
                <MailIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy">Email</p>
                <p className="text-2xs text-navy-soft mt-0.5 truncate">{SUPPORT_EMAIL}</p>
              </div>
              <span className="text-shore-300">
                <ChevronIcon />
              </span>
            </a>

            {waLink(SUPPORT_WA, 'Halo, saya butuh bantuan soal Nusa.') && (
              <a
                href={waLink(SUPPORT_WA, 'Halo, saya butuh bantuan soal Nusa.')!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-shore-50"
              >
                <div className="h-10 w-10 rounded-md bg-shore-100 flex items-center justify-center text-navy-soft shrink-0">
                  <ChatIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy">WhatsApp</p>
                  <p className="text-2xs text-navy-soft mt-0.5">{SUPPORT_WA}</p>
                </div>
                <span className="text-shore-300">
                  <ChevronIcon />
                </span>
              </a>
            )}
          </div>

          <p className="border-t border-shore-200/80 px-5 py-3.5 text-2xs leading-relaxed text-navy-soft">
            Untuk perubahan jadwal atau komplain soal satu destinasi, hubungi langsung
            pengelolanya lewat tombol WhatsApp di halaman destinasi — biasanya lebih cepat.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'pengaturan') {
    return (
      <div className="w-full max-w-lg mx-auto animate-fade-in">
        <BackButton onClick={() => setView('menu')} />

        <AccountSettings user={user} />

        <PengelolaRequest user={user} role={role} />

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-shore-200/80">
            <h2 className="font-serif text-lg font-medium text-navy">{t('settings.title')}</h2>
            <p className="text-2xs text-navy-soft mt-0.5">{t('settings.subtitle')}</p>
          </div>

          {/* Theme section */}
          <div className="px-5 py-4">
            <p className="mb-3 text-sm font-semibold text-navy">{t('settings.appearance')}</p>

            {/* Dark mode toggle row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-md bg-shore-100 flex items-center justify-center text-navy-soft shrink-0">
                  {isDark ? <MoonIcon /> : <SunIcon />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">{t('settings.darkMode')}</p>
                  <p className="text-2xs text-navy-soft mt-0.5">
                    {mounted ? t(isDark ? 'settings.darkOn' : 'settings.darkOff') : ' '}
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={isDark}
                aria-label={t('settings.darkToggleLabel')}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-short focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 ${
                  isDark ? 'bg-teal-500' : 'bg-shore-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-short ${
                    isDark ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Bahasa antarmuka */}
            <div className="mt-5 border-t border-shore-200/80 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-md bg-shore-100 flex items-center justify-center text-navy-soft shrink-0">
                    <GlobeIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy">{t('settings.language')}</p>
                    <p className="text-2xs text-navy-soft mt-0.5">{t('settings.languageDesc')}</p>
                  </div>
                </div>

                <div
                  role="radiogroup"
                  aria-label={t('settings.language')}
                  className="flex shrink-0 rounded-md border border-shore-200 p-0.5"
                >
                  {LANGS.map((l) => (
                    <button
                      key={l.value}
                      role="radio"
                      aria-checked={lang === l.value}
                      aria-label={l.label}
                      onClick={() => setLang(l.value)}
                      className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                        lang === l.value
                          ? 'bg-teal-500 text-white'
                          : 'text-navy-soft hover:text-navy'
                      }`}
                    >
                      {l.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Peran akun — hanya untuk mitra ke atas; pengguna biasa tidak punya
            apa pun untuk ditampilkan di sini. */}
        {roleCard && (
          <div className="card overflow-hidden mt-4">
            <div className="px-5 py-4 border-b border-shore-200/80">
              <h2 className="font-serif text-lg font-medium text-navy">{t('profile.accountRole')}</h2>
              <p className="text-2xs text-navy-soft mt-0.5">{t('profile.accountRoleDesc')}</p>
            </div>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <p className="text-sm text-navy-soft leading-relaxed">{roleCard.description}</p>
              <RoleBadge role={role} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto animate-fade-in">
      {/* Profile card */}
      <div className="card p-6 sm:p-8">
        {/* Avatar + info */}
        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="mb-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'Avatar'}
                className="h-20 w-20 rounded-full object-cover border-2 border-shore-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center border-2 border-shore-200">
                <span className="text-xl font-semibold text-teal-700">{initials}</span>
              </div>
            )}
          </div>

          {/* Name */}
          <h2 className="font-serif text-xl font-medium text-navy mb-1">
            {user.displayName || 'Pengguna'}
          </h2>

          <p className="text-sm text-navy-soft">{user.email}</p>

          {/* Peran + provider */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <RoleBadge role={role} />
            <span className="inline-flex items-center gap-1.5 rounded-xs border border-shore-200 bg-shore-50 px-3 py-1.5 text-2xs font-medium text-navy-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              {user.providerData[0]?.providerId === 'google.com' ? 'Google Account' : 'Email & Password'}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-shore-200 my-6" />

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <span className="text-lg font-semibold text-navy">{bookingCount}</span>
            <p className="text-2xs text-navy-soft mt-0.5">Booking</p>
          </div>
          <div className="border-l border-shore-200">
            <span className="text-lg font-semibold text-navy">{reviewCount}</span>
            <p className="text-2xs text-navy-soft mt-0.5">Ulasan</p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="card mt-4 divide-y divide-shore-200/80 overflow-hidden">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={menuActions[item.key]}
            className={`w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-shore-50 ${
              // Kamera sudah punya tombol sendiri di TopNav desktop.
              item.key === 'camera' ? 'flex md:hidden' : 'flex'
            }`}
          >
            <div className="h-10 w-10 rounded-md bg-shore-100 flex items-center justify-center text-navy-soft shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy">{t(item.labelKey)}</p>
              <p className="text-2xs text-navy-soft mt-0.5">{t(item.descKey)}</p>
            </div>
            <span className="text-shore-300">
              <ChevronIcon />
            </span>
          </button>
        ))}
      </div>

      {/* Dashboard — admin/pengelola only */}
      {(role === 'admin' || role === 'pengelola') && (
        <Link
          href="/dashboard"
          className="card mt-4 flex items-center gap-4 px-5 py-4 transition-colors hover:bg-shore-50 overflow-hidden"
        >
          <div className="h-10 w-10 rounded-md bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-navy">Dashboard</p>
            <p className="text-2xs text-navy-soft mt-0.5">Kelola destinasi dan pengguna</p>
          </div>
          <span className="text-shore-300">
            <ChevronIcon />
          </span>
        </Link>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full mt-4 flex items-center justify-center gap-2.5 rounded-md border border-danger-rule bg-danger-soft/60 px-4 py-3.5 text-sm font-medium text-danger transition-colors duration-micro hover:bg-danger-soft hover:border-danger-rule"
      >
        <LogOutIcon />
        Keluar
      </button>
    </div>
  );
}
