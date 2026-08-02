/**
 * Kamus dua bahasa untuk antarmuka wisatawan. Sengaja tanpa import apa pun
 * supaya i18n.check.ts bisa dijalankan `node` polos tanpa bundler — sama
 * alasannya dengan format.ts dan verification.ts.
 *
 * Cakupan: halaman yang disentuh wisatawan (jelajah, detail destinasi, booking,
 * tiket, riwayat, profil). Dashboard pengelola/admin sengaja tetap bahasa
 * Indonesia — penggunanya mitra lokal, dan menerjemahkannya menambah ratusan
 * kunci yang tidak pernah dibaca wisatawan asing.
 */

export type Lang = "id" | "en";

export const LANGS: { value: Lang; label: string; short: string }[] = [
  { value: "id", label: "Bahasa Indonesia", short: "ID" },
  { value: "en", label: "English", short: "EN" },
];

/** Locale untuk Intl (tanggal & angka) mengikuti bahasa yang aktif. */
export function dateLocale(lang: Lang): string {
  return lang === "en" ? "en-GB" : "id-ID";
}

/**
 * Kunci → terjemahan. Bahasa Indonesia ditulis berdampingan dengan Inggris
 * supaya terjemahan yang tertinggal langsung kelihatan saat menyunting.
 */
const DICT: Record<string, Record<Lang, string>> = {
  // ── Umum ──
  "common.back": { id: "Kembali", en: "Back" },
  "common.cancel": { id: "Batal", en: "Cancel" },
  "common.save": { id: "Simpan", en: "Save" },
  "common.saving": { id: "Menyimpan...", en: "Saving..." },
  "common.close": { id: "Tutup", en: "Close" },
  "common.loading": { id: "Memuat...", en: "Loading..." },
  "common.search": { id: "Cari", en: "Search" },
  "common.all": { id: "Semua", en: "All" },
  "common.retry": { id: "Coba lagi", en: "Try again" },
  "common.people": { id: "orang", en: "guests" },

  // ── Navigasi ──
  "nav.home": { id: "Beranda", en: "Home" },
  "nav.explore": { id: "Jelajah", en: "Explore" },
  "nav.monitoring": { id: "Monitoring", en: "Monitoring" },
  "nav.booking": { id: "Booking", en: "Booking" },
  "nav.profile": { id: "Profil", en: "Profile" },
  "nav.login": { id: "Masuk", en: "Sign in" },
  "footer.tagline": {
    id: "Destinasi selam dan pesisir pilihan.",
    en: "Curated dive and coastal destinations.",
  },

  // ── Profil & menu ──
  "profile.title": { id: "Profil", en: "Profile" },
  "profile.bookingHistory": { id: "Riwayat Booking", en: "Booking History" },
  "profile.saved": { id: "Tersimpan", en: "Saved" },
  "profile.settings": { id: "Pengaturan", en: "Settings" },
  "profile.help": { id: "Bantuan & Dukungan", en: "Help & Support" },
  "profile.camera": { id: "Kamera", en: "Cameras" },
  "profile.logout": { id: "Keluar", en: "Sign out" },
  "profile.statBookings": { id: "Booking", en: "Bookings" },
  "profile.statReviews": { id: "Ulasan", en: "Reviews" },
  "profile.accountRole": { id: "Peran Akun", en: "Account Role" },
  "profile.accountRoleDesc": { id: "Status akunmu di Nusa", en: "Your account status on Nusa" },
  "profile.cameraDesc": { id: "Daftarkan & pantau kamera milikmu", en: "Register & monitor your cameras" },
  "profile.historyDesc": { id: "Lihat dan kelola reservasi", en: "View and manage your reservations" },
  "profile.savedDesc": { id: "Destinasi favorit yang kamu simpan", en: "Destinations you saved" },
  "profile.settingsDesc": { id: "Tema tampilan & preferensi", en: "Theme & preferences" },
  "profile.helpDesc": { id: "FAQ dan hubungi kami", en: "FAQ and contact us" },
  "profile.helpTitle": { id: "Bantuan & Dukungan", en: "Help & Support" },

  // ── Pengaturan ──
  "settings.title": { id: "Pengaturan", en: "Settings" },
  "settings.subtitle": { id: "Sesuaikan tampilan aplikasi", en: "Adjust how the app looks" },
  "settings.appearance": { id: "Tampilan", en: "Appearance" },
  "settings.darkMode": { id: "Mode Gelap", en: "Dark Mode" },
  "settings.darkOn": { id: "Tema gelap aktif", en: "Dark theme active" },
  "settings.darkOff": { id: "Tema terang aktif", en: "Light theme active" },
  "settings.darkToggleLabel": { id: "Aktifkan mode gelap", en: "Enable dark mode" },
  "settings.language": { id: "Bahasa", en: "Language" },
  "settings.languageDesc": {
    id: "Bahasa antarmuka. Pilihannya tersimpan di perangkat ini.",
    en: "Interface language. Your choice is saved on this device.",
  },

  // ── Booking ──
  "booking.title": { id: "Booking", en: "Book a Visit" },
  "booking.date": { id: "Tanggal Kunjungan", en: "Visit Date" },
  "booking.guests": { id: "Jumlah Orang", en: "Number of Guests" },
  "booking.name": { id: "Nama Pemesan", en: "Full Name" },
  "booking.phone": { id: "No. HP", en: "Phone Number" },
  "booking.notes": { id: "Catatan", en: "Notes" },
  "booking.notesPlaceholder": { id: "Permintaan khusus, alergi, dll...", en: "Special requests, allergies, etc..." },
  "booking.total": { id: "Total", en: "Total" },
  "booking.submit": { id: "Pesan Sekarang", en: "Book Now" },
  "booking.submitting": { id: "Memproses...", en: "Processing..." },
  "booking.noPrices": {
    id: "Destinasi ini belum punya daftar harga, booking belum bisa dilakukan.",
    en: "This destination has no price list yet, so booking is unavailable.",
  },
  "booking.successTitle": { id: "Booking Berhasil!", en: "Booking Confirmed!" },
  "booking.successBody": {
    id: "Tiket untuk {dest} pada tanggal {date} sudah siap. Buka untuk melihat QR check-in.",
    en: "Your ticket for {dest} on {date} is ready. Open it to see your check-in QR code.",
  },
  "booking.lede": {
    id: "Isi detail untuk memesan perjalanan.",
    en: "Fill in the details to book your trip.",
  },
  "booking.destination": { id: "Destinasi", en: "Destination" },
  "booking.noDestination": { id: "Tidak ada destinasi dipilih.", en: "No destination selected." },
  "booking.pickFromHome": { id: "Pilih dari beranda", en: "Pick one from home" },
  "booking.selectItems": { id: "Pilih Item *", en: "Select Items *" },
  "booking.dateLabel": { id: "Tanggal *", en: "Date *" },
  "booking.guestsLabel": { id: "Jumlah Orang *", en: "Number of Guests *" },
  "booking.nameLabel": { id: "Nama Lengkap *", en: "Full Name *" },
  "booking.namePlaceholder": { id: "Nama pemesan", en: "Name on the booking" },
  "booking.phoneLabel": { id: "No. Telepon *", en: "Phone Number *" },
  "booking.notesLabel": { id: "Catatan (opsional)", en: "Notes (optional)" },
  "booking.summary": { id: "Ringkasan", en: "Summary" },
  "booking.noItems": { id: "Belum ada item dipilih.", en: "No items selected yet." },
  "booking.estTotal": { id: "Estimasi total", en: "Estimated total" },
  "booking.confirm": { id: "Konfirmasi Booking", en: "Confirm Booking" },
  "booking.failed": { id: "Gagal membuat booking. Coba lagi.", en: "Could not create the booking. Please try again." },
  "booking.viewTicket": { id: "Lihat Tiket", en: "View Ticket" },
  "booking.bookAgain": { id: "Booking Lagi", en: "Book Again" },
  "booking.decrease": { id: "Kurangi {item}", en: "Decrease {item}" },
  "booking.increase": { id: "Tambah {item}", en: "Add {item}" },
  // Dipecah karena ada tombol di tengah kalimat — satu kunci utuh tidak bisa
  // menampung elemen React di tengahnya.
  "booking.needLoginPre": { id: "Kamu perlu ", en: "You need to " },
  "booking.needLoginLink": { id: "masuk", en: "sign in" },
  "booking.needLoginPost": { id: " terlebih dahulu untuk booking.", en: " before booking." },
  "booking.needVerifyLink": { id: "Verifikasi email", en: "Verify your email" },
  "booking.needVerifyPost": { id: " kamu dulu sebelum booking.", en: " before booking." },

  // ── Riwayat booking ──
  "history.title": { id: "Riwayat Booking", en: "Booking History" },
  "history.active": { id: "Berlangsung", en: "Active" },
  "history.empty": { id: "Belum ada booking.", en: "No bookings yet." },
  "history.cancelBooking": { id: "Batalkan Booking", en: "Cancel Booking" },
  "history.viewTicket": { id: "Lihat Tiket", en: "View Ticket" },
  "history.activeTitle": { id: "Booking Berlangsung", en: "Active Bookings" },
  "history.activeLede": {
    id: "Tiket yang sudah dikonfirmasi dan belum dipakai",
    en: "Confirmed tickets you have not used yet",
  },
  "history.allLede": {
    id: "Daftar booking yang pernah kamu buat",
    en: "Every booking you have made",
  },
  "history.signInPrompt": {
    id: "Masuk untuk melihat riwayat booking kamu.",
    en: "Sign in to see your booking history.",
  },
  "history.emptyActive": { id: "Belum ada booking yang berlangsung.", en: "No active bookings." },
  "history.makeBooking": { id: "Buat Booking", en: "Make a Booking" },
  "history.cancelTitle": { id: "Batalkan Booking?", en: "Cancel this booking?" },
  "history.cancelBody": {
    id: "Booking untuk {dest} pada {date} akan dibatalkan dan tidak bisa dikembalikan.",
    en: "Your booking for {dest} on {date} will be cancelled and cannot be restored.",
  },
  "history.cancelling": { id: "Membatalkan...", en: "Cancelling..." },
  "history.cancelConfirm": { id: "Ya, Batalkan", en: "Yes, Cancel" },
  "history.cancelShort": { id: "Batalkan", en: "Cancel" },
  "history.statusUsed": { id: "Sudah Digunakan", en: "Used" },
  "history.statusDone": { id: "Selesai", en: "Completed" },

  // ── Tiket ──
  "ticket.closeLabel": { id: "Tutup tiket", en: "Close ticket" },
  "ticket.brand": { id: "OTA · Tiket Wisata", en: "OTA · Visit Ticket" },
  "ticket.holder": { id: "Pemesan", en: "Booked by" },
  "ticket.guests": { id: "Jumlah", en: "Guests" },
  "ticket.phone": { id: "Telepon", en: "Phone" },
  "ticket.code": { id: "Kode Tiket", en: "Ticket Code" },
  "ticket.showQr": {
    id: "Tunjukkan QR ini kepada petugas saat check-in.",
    en: "Show this QR code to the staff at check-in.",
  },

  // ── Status booking ──
  "status.pending": { id: "Menunggu", en: "Pending" },
  "status.confirmed": { id: "Dikonfirmasi", en: "Confirmed" },
  "status.cancelled": { id: "Dibatalkan", en: "Cancelled" },
  "status.used": { id: "Selesai", en: "Completed" },

  // ── Pembayaran ──
  "payment.title": { id: "Pembayaran", en: "Payment" },
  "payment.method": { id: "Metode Pembayaran", en: "Payment Method" },
  "payment.transfer": { id: "Transfer Bank", en: "Bank Transfer" },
  "payment.ewallet": { id: "E-wallet", en: "E-wallet" },
  "payment.cash": { id: "Tunai di lokasi", en: "Cash on site" },
  "payment.cashDesc": { id: "Bayar langsung ke petugas", en: "Pay the staff on arrival" },
  "payment.pay": { id: "Bayar", en: "Pay" },
  "payment.paying": { id: "Memproses...", en: "Processing..." },
  "payment.paid": { id: "Pembayaran Berhasil", en: "Payment Successful" },
  "payment.failed": { id: "Gagal memproses pembayaran. Coba lagi.", en: "Payment failed. Please try again." },
  "payment.thanks": {
    id: "Terima kasih. Pembayaran untuk {dest} sudah tercatat.",
    en: "Thank you. Your payment for {dest} has been recorded.",
  },
  "payment.done": { id: "Selesai", en: "Done" },
  "payment.transferDesc": { id: "BCA / Mandiri / BNI", en: "BCA / Mandiri / BNI" },
  "payment.ewalletDesc": { id: "GoPay / OVO / DANA", en: "GoPay / OVO / DANA" },
  "payment.confirm": { id: "Konfirmasi Pembayaran", en: "Confirm Payment" },

  // ── Destinasi ──
  "dest.priceList": { id: "Daftar harga", en: "Price list" },
  "dest.noPriceList": { id: "Belum ada daftar harga untuk destinasi ini.", en: "No price list for this destination yet." },
  "dest.reviews": { id: "Ulasan", en: "Reviews" },
  "dest.noReviews": { id: "Belum ada ulasan.", en: "No reviews yet." },
  "dest.writeReview": { id: "Tulis ulasan", en: "Write a review" },
  "dest.bookNow": { id: "Booking", en: "Book" },
  "dest.contactWhatsApp": { id: "Hubungi via WhatsApp", en: "Contact via WhatsApp" },
  "dest.openMaps": { id: "Buka di Maps", en: "Open in Maps" },
  "dest.liveMonitor": { id: "Pantauan Langsung", en: "Live Monitoring" },
  "dest.saved": { id: "Tersimpan", en: "Saved" },
  "dest.empty": { id: "Belum ada destinasi.", en: "No destinations yet." },
  "dest.from": { id: "mulai", en: "from" },
  "dest.notFound": { id: "Destinasi tidak ditemukan.", en: "Destination not found." },
  "dest.about": { id: "Tentang", en: "About" },
  "dest.gallery": { id: "Galeri", en: "Gallery" },
  "dest.reviewPlaceholder": {
    id: "Ceritakan pengalamanmu di sini… (opsional)",
    en: "Tell us about your experience… (optional)",
  },
  "dest.beFirstReview": { id: "Belum ada ulasan. Jadilah yang pertama!", en: "No reviews yet. Be the first!" },

  // ── Akun ──
  "auth.fullName": { id: "Nama Lengkap", en: "Full Name" },
  "auth.fullNamePlaceholder": { id: "Masukkan nama lengkap", en: "Enter your full name" },
  "auth.email": { id: "Email", en: "Email" },
  "auth.password": { id: "Password", en: "Password" },
  "auth.verifyTitle": { id: "Verifikasi email kamu", en: "Verify your email" },
  "account.title": { id: "Pengaturan Akun", en: "Account Settings" },
  "account.subtitle": { id: "Kelola data akun & keamanan", en: "Manage your account details & security" },
  "account.profile": { id: "Profil", en: "Profile" },
  "account.name": { id: "Nama", en: "Name" },
  "account.phone": { id: "Nomor Telepon", en: "Phone Number" },
  "account.phonePlaceholder": { id: "cth: 0812-3456-7890", en: "e.g. 0812-3456-7890" },
  "account.phoneHint": {
    id: "Dipakai admin untuk menghubungi kamu (mis. via WhatsApp).",
    en: "Used by admins to reach you (e.g. via WhatsApp).",
  },
  "account.linked": { id: "Akun Tertaut", en: "Linked Accounts" },
  "account.linkGoogle": { id: "Hubungkan Google", en: "Link Google" },
  "account.linkGoogleHint": {
    id: "Biar lain kali bisa masuk tanpa password.",
    en: "So you can sign in next time without a password.",
  },
  "account.googleLinked": { id: "Google terhubung", en: "Google linked" },
  "account.changePassword": { id: "Ubah Password", en: "Change Password" },
  "account.currentPassword": { id: "Password sekarang", en: "Current password" },
  "account.newPassword": { id: "Password baru (min. 6 karakter)", en: "New password (min. 6 characters)" },
  "account.confirmPassword": { id: "Konfirmasi password baru", en: "Confirm new password" },

  // ── Notifikasi ──
  "notif.label": { id: "Notifikasi", en: "Notifications" },
  "notif.empty": { id: "Tidak ada notifikasi.", en: "No notifications." },
  "notif.checkinOk": { id: "Check-in berhasil", en: "Check-in successful" },

  // ── Beranda & pencarian ──
  "home.welcome": { id: "Selamat datang", en: "Welcome" },
  "home.searchHero": {
    id: "Cari destinasi, pantai, spot selam…",
    en: "Search destinations, beaches, dive spots…",
  },
  "home.searchMobile": { id: "Cari destinasi, aktivitas...", en: "Search destinations, activities..." },
  "home.searchShort": { id: "Cari destinasi…", en: "Search destinations…" },
  "home.searchLabel": { id: "Cari destinasi", en: "Search destinations" },
  "home.location": { id: "Lokasi", en: "Location" },
  "home.allLocations": { id: "Semua lokasi", en: "All locations" },
  "home.sectionTitle": { id: "Semua Destinasi", en: "All Destinations" },
  "home.popular": { id: "Destinasi Populer", en: "Popular Destinations" },
  "home.seeAllShort": { id: "Lihat Semua", en: "See All" },
  "home.loadingDest": { id: "Memuat destinasi…", en: "Loading destinations…" },
  "home.notFound": { id: "Tidak ada destinasi ditemukan", en: "No destinations found" },
  "home.greeting": { id: "Halo, {name}.", en: "Hi, {name}." },
  "home.greetingPlain": { id: "Halo, {name}", en: "Hi, {name}" },
  "home.seeAll": { id: "Lihat semua destinasi", en: "See all destinations" },
  "home.gridLede": {
    id: "{count} destinasi di {regions} wilayah — cari, atau telusuri per wilayah di bawah.",
    en: "{count} destinations across {regions} regions — search, or browse by region below.",
  },
  "home.heroTitle": { id: "Laut dalam menanti.", en: "The deep waters await." },
  "home.heroLede": {
    id: "Spot selam, pantai tersembunyi, dan pengalaman laut — lengkap dengan pantauan kondisi perairan secara langsung.",
    en: "Dive sites, hidden beaches, and ocean experiences — with live water condition monitoring.",
  },

  // Label filter. Nilainya sendiri tetap string Indonesia di kode ('Semua',
  // 'Terdekat') karena dipakai membandingkan state & query param — yang
  // diterjemahkan hanya yang tampil.
  "filter.all": { id: "Semua", en: "All" },
  "filter.nearest": { id: "Terdekat", en: "Nearest" },
  "filter.other": { id: "Lainnya", en: "Other" },

  // ── Kartu destinasi ──
  "card.save": { id: "Simpan destinasi", en: "Save destination" },
  "card.unsave": { id: "Hapus dari tersimpan", en: "Remove from saved" },
  "card.priceFrom": { id: "Mulai dari", en: "From" },
};

/**
 * Teks untuk `key` dalam `lang`. Kunci yang belum ada dikembalikan apa adanya
 * supaya layar tetap terbaca (dan kunci yang hilang langsung kelihatan) alih-alih
 * kosong atau melempar error di tengah render.
 */
export function t(
  key: string,
  lang: Lang,
  vars?: Record<string, string | number>
): string {
  const entry = DICT[key];
  let text = entry ? entry[lang] ?? entry.id : key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/** Dipakai i18n.check.ts untuk memastikan tidak ada terjemahan yang tertinggal. */
export const DICT_KEYS = Object.keys(DICT);
export const dictEntry = (key: string) => DICT[key];
