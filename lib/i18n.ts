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
  "common.error": { id: "Terjadi kesalahan. Coba lagi.", en: "Something went wrong. Please try again." },
  "common.saveFailed": { id: "Gagal menyimpan. Coba lagi.", en: "Couldn't save. Please try again." },
  "common.noData": { id: "Belum ada data", en: "No data yet" },
  "common.unknown": { id: "Tidak Diketahui", en: "Unknown" },
  "common.delete": { id: "Hapus", en: "Delete" },
  "common.saved": { id: "Tersimpan", en: "Saved" },
  "common.send": { id: "Kirim", en: "Send" },
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
  "footer.account": { id: "Akun", en: "Account" },
  "footer.help": { id: "Bantuan", en: "Help" },
  "footer.contact": { id: "Kontak", en: "Contact" },
  "footer.becomeManager": { id: "Jadi Pengelola", en: "Become a Manager" },

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
    id: "Biar lain kali bisa masuk sekali klik, tanpa menunggu kode.",
    en: "So you can sign in with one click next time, without waiting for a code.",
  },
  "account.googleLinked": { id: "Google terhubung", en: "Google linked" },
  "account.saveProfile": { id: "Simpan Profil", en: "Save Profile" },
  "account.profileSaved": { id: "Profil tersimpan.", en: "Profile saved." },
  "account.nameRequired": { id: "Nama wajib diisi.", en: "Name is required." },
  "account.cancelled": { id: "Dibatalkan.", en: "Cancelled." },
  "account.tooManyAttempts": {
    id: "Terlalu banyak percobaan. Coba lagi nanti.",
    en: "Too many attempts. Please try again later.",
  },
  "account.sessionExpired": {
    id: "Sesi kedaluwarsa. Keluar lalu masuk lagi, kemudian coba ulang.",
    en: "Your session expired. Sign out, sign back in, then try again.",
  },
  "account.googleInUse": {
    id: "Akun Google itu sudah terpakai di akun lain.",
    en: "That Google account is already linked to someone else.",
  },
  "account.googleLinkedOk": {
    id: "Google terhubung. Lain kali bisa masuk pakai Google.",
    en: "Google linked. Next time you can sign in with Google.",
  },

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

  // ── Asisten chat ──
  "chat.title": { id: "Asisten Nusa", en: "Nusa Assistant" },
  "chat.open": { id: "Buka asisten Nusa", en: "Open Nusa assistant" },
  "chat.close": { id: "Tutup asisten", en: "Close assistant" },
  "chat.replyTime": {
    id: "Biasanya balas dalam hitungan detik",
    en: "Usually replies within seconds",
  },
  "chat.greeting": {
    id: "Halo! Aku asisten Nusa. Tanya apa saja soal destinasi selam, harga, atau cara booking.",
    en: "Hi! I'm the Nusa assistant. Ask me anything about dive destinations, prices, or how to book.",
  },
  "chat.suggest1": { id: "Rekomendasi spot buat pemula", en: "Recommend a spot for beginners" },
  "chat.suggest2": { id: "Berapa harga tiketnya?", en: "How much are the tickets?" },
  "chat.suggest3": { id: "Cara booking gimana?", en: "How do I book?" },
  "chat.typing": { id: "Mengetik…", en: "Typing…" },
  "chat.placeholder": { id: "Tulis pertanyaan…", en: "Ask a question…" },
  "chat.messageLabel": { id: "Pesan", en: "Message" },
  "chat.errQuota": {
    id: "Lagi ramai banget. Coba lagi sebentar lagi ya.",
    en: "It's very busy right now. Please try again shortly.",
  },
  "chat.errTooMany": {
    id: "Kebanyakan pesan sekaligus. Tunggu sebentar ya.",
    en: "Too many messages at once. Hang on a moment.",
  },
  "chat.errNotConfigured": { id: "Asisten belum aktif. Hubungi admin.", en: "The assistant isn't active yet. Contact an admin." },
  "chat.errNetwork": {
    id: "Koneksi bermasalah. Cek internet kamu.",
    en: "Connection problem. Check your internet.",
  },
  "chat.errGeneric": {
    id: "Gagal menghubungi asisten. Coba lagi.",
    en: "Couldn't reach the assistant. Please try again.",
  },

  // ── Pantau langsung (kamera + sensor) ──
  "monitor.subtitleBoth": {
    id: "Kamera live & sensor lingkungan real-time",
    en: "Live camera & real-time environmental sensors",
  },
  "monitor.subtitleCamera": { id: "Kamera live destinasi", en: "Live destination camera" },
  "monitor.prevCamera": { id: "Kamera sebelumnya", en: "Previous camera" },
  "monitor.nextCamera": { id: "Kamera berikutnya", en: "Next camera" },
  "monitor.goToCamera": { id: "Tampilkan kamera {n}", en: "Show camera {n}" },
  "monitor.subtitleSensor": { id: "Sensor lingkungan real-time", en: "Real-time environmental sensors" },
  "monitor.airTemp": { id: "Suhu Udara", en: "Air Temperature" },
  "monitor.humidity": { id: "Kelembapan Udara", en: "Humidity" },
  "monitor.waterTemp": { id: "Suhu Air", en: "Water Temperature" },
  "monitor.weather": { id: "Kondisi Cuaca", en: "Weather" },
  "monitor.windSpeed": { id: "Kecepatan Angin", en: "Wind Speed" },
  "monitor.flowRate": { id: "Debit Air", en: "Water Flow" },
  "monitor.updated": { id: "Diperbarui {when}", en: "Updated {when}" },
  "monitor.justNow": { id: "baru saja", en: "just now" },
  "monitor.secsAgo": { id: "{n} detik lalu", en: "{n}s ago" },
  "monitor.minsAgo": { id: "{n} menit lalu", en: "{n}m ago" },
  "monitor.hoursAgo": { id: "{n} jam lalu", en: "{n}h ago" },
  "monitor.daysAgo": { id: "{n} hari lalu", en: "{n}d ago" },

  // ── Ulasan & tersimpan ──
  "review.write": { id: "Tulis ulasan", en: "Write a review" },
  "review.edit": { id: "Ubah ulasanmu", en: "Edit your review" },
  "review.update": { id: "Perbarui", en: "Update" },
  "review.submit": { id: "Kirim Ulasan", en: "Submit Review" },
  "review.signInPrompt": { id: "untuk menulis ulasan.", en: "to write a review." },
  "saved.empty": { id: "Belum ada destinasi tersimpan.", en: "No saved destinations yet." },
  "saved.emptyHint": {
    id: "Ketuk ikon hati di kartu destinasi untuk menyimpan.",
    en: "Tap the heart on a destination card to save it.",
  },

  // ── Form pengajuan pengelola ──
  "verifyForm.title": { id: "Ajukan Jadi Pengelola", en: "Apply to Be a Manager" },
  "verifyForm.desc": {
    id: "Lengkapi data di bawah. Setelah disetujui admin, role akunmu naik menjadi pengelola dan destinasi yang kamu usulkan dibuat otomatis.",
    en: "Fill in the details below. Once an admin approves, your account becomes a manager and the destination you propose is created automatically.",
  },
  "verifyForm.namePlaceholder": { id: "Nama penanggung jawab", en: "Person in charge" },
  "verifyForm.phone": { id: "No. HP", en: "Phone" },
  "verifyForm.org": { id: "Instansi/Organisasi", en: "Institution/Organisation" },
  "verifyForm.orgPlaceholder": {
    id: "Operator dive, resort, komunitas, ...",
    en: "Dive operator, resort, community, ...",
  },
  "verifyForm.proposedDest": { id: "Destinasi yang Dikelola", en: "Destination You Manage" },
  "verifyForm.proposedDestHint": {
    id: "Nusa terbuka untuk destinasi di seluruh Indonesia. Tulis sendiri destinasimu — datanya dibuat otomatis begitu pengajuan disetujui, lalu foto, titik peta, dan daftar harga kamu lengkapi sendiri lewat Dashboard.",
    en: "Nusa is open to destinations across Indonesia. Write in your own destination — its record is created automatically once your application is approved, then you fill in photos, map pin, and pricing yourself from the Dashboard.",
  },
  "verifyForm.destName": { id: "Nama Destinasi", en: "Destination Name" },
  "verifyForm.destNamePlaceholder": {
    id: "Pantai Bahoi, Air Terjun Tumimperas, ...",
    en: "Bahoi Beach, Tumimperas Waterfall, ...",
  },
  "verifyForm.destLocation": { id: "Lokasi", en: "Location" },
  "verifyForm.destLocationPlaceholder": {
    id: "Desa, kecamatan, kabupaten/kota, provinsi",
    en: "Village, district, regency/city, province",
  },
  "verifyForm.destDesc": { id: "Ceritakan Singkat", en: "Short Description" },
  "verifyForm.destDescPlaceholder": {
    id: "Apa yang bisa dilakukan di sana, fasilitas yang sudah ada, dan perkiraan jumlah pengunjung",
    en: "What visitors can do there, existing facilities, and roughly how many visitors",
  },
  "verifyForm.landRights": { id: "Dasar Hak Mengelola Lokasi", en: "Basis for Managing the Site" },
  "verifyForm.pickLandRights": { id: "-- Pilih dasar hak --", en: "-- Choose a basis --" },
  "verifyForm.landRightsHint": {
    id: "Tidak ada berkas yang perlu diunggah di sini. Admin menghubungimu lewat WhatsApp untuk memastikannya sebelum pengajuan disetujui.",
    en: "No documents to upload here. An admin contacts you on WhatsApp to confirm before approving.",
  },
  "verifyForm.declareRights": {
    id: "Saya menyatakan berhak mengelola lokasi ini atas dasar yang saya pilih di atas, data yang saya isi benar, dan saya sanggup mengurus perizinan serta keselamatan pengunjung di sana. Saya paham pengajuan bisa ditolak atau dicabut bila pernyataan ini keliru.",
    en: "I declare that I am entitled to manage this site on the basis selected above, that the details I entered are true, and that I can handle permits and visitor safety there. I understand the request may be rejected or revoked if this declaration is wrong.",
  },
  "verifyForm.readAgreed": { id: "Saya sudah membaca dan menyetujui", en: "I have read and accept the" },
  "verifyForm.agreeTailPengelola": {
    id: ", termasuk kewajiban membeli paket sensor dari Nusa dan pembayaran pengunjung yang diterima langsung oleh pengelola.",
    en: ", including the obligation to buy the sensor package from Nusa and to receive visitor payments directly as the manager.",
  },
  "verifyForm.submitting": { id: "Mengirim...", en: "Submitting..." },
  "verifyForm.submitPengelola": { id: "Ajukan Jadi Pengelola", en: "Apply to Be a Manager" },
  "verifyForm.submitFailed": {
    id: "Gagal mengirim pengajuan. Coba lagi.",
    en: "Couldn't submit the request. Please try again.",
  },

  // Pesan validasi form — dikembalikan sebagai kunci oleh validateRoleRequest().
  "verifyForm.allFieldsRequired": { id: "Semua kolom wajib diisi.", en: "All fields are required." },
  "verifyForm.newDestNameRequired": {
    id: "Tulis nama destinasi yang kamu usulkan.",
    en: "Enter the name of the destination you're proposing.",
  },
  "verifyForm.newDestLocationRequired": {
    id: "Tulis lokasi destinasi: desa, kecamatan, dan kabupaten/kota.",
    en: "Enter the location: village, district, and regency/city.",
  },
  "verifyForm.newDestDescRequired": {
    id: "Ceritakan singkat destinasi yang kamu usulkan.",
    en: "Briefly describe the destination you're proposing.",
  },
  "verifyForm.landRightsRequired": {
    id: "Pilih dasar hakmu mengelola lokasi itu.",
    en: "Choose the basis for your right to manage that site.",
  },
  "verifyForm.declareRightsRequired": {
    id: "Kamu harus menyatakan berhak mengelola lokasi yang diusulkan.",
    en: "You must declare you're entitled to manage the proposed site.",
  },
  "verifyForm.mustAgreePengelola": {
    id: "Kamu harus menyetujui Perjanjian Pengelola dulu.",
    en: "You must accept the Manager Agreement first.",
  },

  // ── Monitoring / kamera ──
  "camera.title": { id: "Kamera", en: "Cameras" },
  "camera.lede": { id: "Daftarkan dan pantau kamera milikmu", en: "Register and monitor your own cameras" },
  "camera.ledeViewer": {
    id: "Kamera yang boleh kamu tonton muncul di halaman destinasinya.",
    en: "Cameras you're allowed to watch appear on their destination page.",
  },
  "camera.viewerNote": {
    id: "Kamera dipasang dan dikelola pengelola destinasi. Setelah kamu membeli paket dan pengelola menambahkan emailmu, siaran langsungnya muncul di halaman destinasi tersebut.",
    en: "Cameras are installed and managed by the destination's manager. Once you buy a package and the manager adds your email, the live feed appears on that destination's page.",
  },
  "camera.empty": {
    id: "Belum ada kamera. Tambahkan kamera pertamamu.",
    en: "No cameras yet. Add your first one.",
  },
  "camera.addTitle": { id: "Tambah Kamera", en: "Add Camera" },
  "camera.addHint": {
    id: "Daftarkan kamera dari sini. Admin akan memvalidasi di server, lalu QR untuk siaran dari HP muncul otomatis di daftar di atas.",
    en: "Register a camera here. An admin validates it on the server, then the QR for phone broadcasting appears automatically in the list above.",
  },
  "camera.nameLabel": { id: "Nama Kamera", en: "Camera Name" },
  "camera.namePlaceholder": { id: "Misal: Kamera Dermaga Utama", en: "e.g. Main Jetty Camera" },
  "camera.nameRequired": { id: "Nama kamera wajib diisi.", en: "Camera name is required." },
  "camera.regionLabel": { id: "Wilayah", en: "Region" },
  "camera.regionPlaceholder": { id: "Pilih wilayah…", en: "Choose a region…" },
  "camera.regionRequired": { id: "Pilih wilayah kamera.", en: "Choose a region for the camera." },
  "camera.regionHint": {
    id: "Wilayah menentukan pengelola mana yang bisa memantau kamera ini. Detail titik pasang taruh di nama kamera.",
    en: "The region decides which manager can monitor this camera. Put the exact spot in the camera name.",
  },
  "camera.saveFailed": { id: "Gagal menyimpan kamera. Coba lagi.", en: "Couldn't save the camera. Please try again." },
  "camera.deleteTitle": { id: "Hapus Kamera?", en: "Delete Camera?" },
  "camera.deleteBody": {
    id: "Kamera {name} akan dihapus dan tidak bisa dikembalikan.",
    en: "Camera {name} will be deleted and can't be restored.",
  },
  "camera.deleteConfirm": { id: "Ya, Hapus", en: "Yes, Delete" },
  "camera.deleting": { id: "Menghapus...", en: "Deleting..." },
  "camera.statusPending": { id: "Menunggu admin", en: "Awaiting admin" },
  "camera.statusRejected": { id: "Ditolak", en: "Rejected" },
  "camera.statusApproved": { id: "Disetujui", en: "Approved" },
  "camera.pendingHint": {
    id: "Kamera menunggu persetujuan admin di server. Setelah disetujui, QR untuk mulai siaran dari HP akan muncul di sini.",
    en: "This camera is waiting for admin approval on the server. Once approved, the QR to start broadcasting from a phone appears here.",
  },
  "camera.rejectedHint": {
    id: "Pengajuan kamera ditolak admin. Hapus kamera ini lalu daftarkan ulang bila perlu.",
    en: "An admin rejected this camera. Delete it and register again if needed.",
  },
  "camera.broadcastTitle": { id: "Mulai siaran dari HP", en: "Start broadcasting from a phone" },
  "camera.broadcastHint": {
    id: "Scan QR ini pakai kamera HP, atau buka link siaran di HP lalu izinkan akses kamera. Biarkan halaman siaran tetap terbuka.",
    en: "Scan this QR with a phone camera, or open the broadcast link on the phone and allow camera access. Leave the broadcast page open.",
  },
  "camera.openBroadcast": { id: "Buka halaman siaran ↗", en: "Open broadcast page ↗" },
  "camera.viewLive": { id: "Lihat Live", en: "View Live" },
  "camera.serverAddress": { id: "Alamat Server Kamera", en: "Camera Server Address" },
  "camera.serverAddressHint": {
    id: "Salin dari halaman utama website kamera. Bila WiFi/IP berubah, cukup ganti di sini — semua kamera langsung mengikuti.",
    en: "Copy it from the camera site's home page. If the WiFi/IP changes, update it here once — every camera follows.",
  },
  "camera.urlScheme": {
    id: "Alamat harus diawali http:// atau https://.",
    en: "The address must start with http:// or https://.",
  },
  "camera.urlSaveFailed": { id: "Gagal menyimpan alamat. Coba lagi.", en: "Couldn't save the address. Please try again." },
  "camera.noServerUrl": { id: "Alamat server kamera belum diatur.", en: "The camera server address isn't set yet." },
  "camera.noServerUrlHint": {
    id: 'Isi kolom "Alamat Server Kamera" dengan alamat dari website kamera, lalu buka lagi live view ini.',
    en: 'Fill in "Camera Server Address" with the address from the camera site, then reopen this live view.',
  },
  "camera.noServerUrlHintAdmin": {
    id: 'Isi "Alamat Server Kamera" di dashboard admin, lalu buka kembali halaman ini.',
    en: 'Set "Camera Server Address" in the admin dashboard, then reload this page.',
  },
  "camera.noConnection": { id: "Tidak bisa terhubung ke kamera.", en: "Can't reach the camera." },
  "camera.noConnectionHint": {
    id: "Pastikan server kamera berjalan dan ID kamera benar.",
    en: "Make sure the camera server is running and the camera ID is correct.",
  },
  "camera.noConnectionHintFull": {
    id: "Pastikan server kamera jalan, ID benar, dan semua perangkat satu jaringan. Bila aplikasi dibuka lewat HTTPS, stream http:// jaringan lokal akan diblokir browser.",
    en: "Make sure the camera server is running, the ID is right, and every device is on the same network. If the app is opened over HTTPS, browsers block local http:// streams.",
  },
  "camera.historyTitle": { id: "Riwayat Deteksi", en: "Detection History" },
  "camera.historyEmpty": { id: "Belum ada deteksi tercatat", en: "No detections recorded yet" },
  "camera.historyEmptyOffline": {
    id: "Belum ada deteksi. Riwayat terisi selama kamera ditonton.",
    en: "No detections yet. History fills up while the camera is being watched.",
  },
  "camera.statsTitle": { id: "Statistik Deteksi", en: "Detection Statistics" },
  "camera.statsEmptyOffline": {
    id: "Belum ada data deteksi. Statistik terkumpul selama kamera ditonton.",
    en: "No detection data yet. Statistics build up while the camera is being watched.",
  },
  "camera.totalDetected": { id: "Total karang terdeteksi", en: "Total coral detected" },
  "camera.totalRecorded": { id: "total deteksi tercatat", en: "detections recorded" },
  "camera.healthStatus": { id: "Status Kesehatan", en: "Health Status" },
  "camera.coralTypes": { id: "Jenis Karang", en: "Coral Types" },
  "camera.healthCaveat": {
    id: "Catatan: status kesehatan masih estimasi kasar berdasarkan kecerahan gambar — belum tervalidasi sebagai data kesehatan karang yang akurat.",
    en: "Note: health status is still a rough estimate based on image brightness — not yet validated as accurate coral health data.",
  },

  // Status kesehatan karang. Nilai mentahnya datang dari server deteksi dalam
  // bahasa Indonesia; ini hanya label tampilannya.
  "health.healthy": { id: "Sehat", en: "Healthy" },
  "health.poor": { id: "Kurang Sehat", en: "Unhealthy" },
  "health.bleaching": { id: "Pemutihan", en: "Bleaching" },
  "health.unknown": { id: "Tidak Diketahui", en: "Unknown" },

  // ── Jadi pengelola ──
  "manager.title": { id: "Jadi Pengelola", en: "Become a Manager" },
  "manager.subtitle": {
    id: "Kelola destinasi, booking & kamera wilayahmu",
    en: "Manage destinations, bookings & cameras in your area",
  },
  "manager.formDesc": {
    id: "Pengelola mengurus destinasi yang ditetapkan admin — data destinasi, booking, dan kamera di wilayahnya. Isi data di bawah; pengajuan ditinjau admin dulu.",
    en: "A manager looks after the destinations an admin assigns — destination data, bookings, and cameras in their area. Fill in the details below; an admin reviews the request first.",
  },
  "manager.pendingNote": {
    id: "Pengajuanmu sedang ditinjau admin. Kalau disetujui, role akunmu naik jadi pengelola dan menu Dashboard muncul di profil.",
    en: "An admin is reviewing your request. Once approved, your account becomes a manager and the Dashboard menu appears in your profile.",
  },
  "manager.rejectedNote": {
    id: "Pengajuanmu jadi pengelola ditolak admin. Periksa kembali datamu lalu ajukan ulang.",
    en: "An admin rejected your manager request. Check your details and submit again.",
  },

  "verify.awaitingApproval": { id: "Menunggu Persetujuan", en: "Awaiting Approval" },
  "verify.rejected": { id: "Pengajuan Ditolak", en: "Request Rejected" },
  "verify.resubmit": { id: "Ajukan Ulang", en: "Submit Again" },
  "verify.nameLabel": { id: "Nama:", en: "Name:" },
  "verify.phoneLabel": { id: "No. HP:", en: "Phone:" },
  "verify.orgLabel": { id: "Instansi:", en: "Organisation:" },
  "verify.destLabel": { id: "Destinasi:", en: "Destination:" },
  "verify.contactAdmin": { id: "Hubungi admin Nusa", en: "Contact a Nusa admin" },
  "verify.contactAdminHint": {
    id: "Selebihnya dibicarakan lewat WhatsApp: pembuktian dasar hakmu, lalu paket sensor — isinya, harganya, dan ke mana dikirim. Hubungi admin di nomor ini supaya pengajuanmu lebih cepat ditinjau.",
    en: "The rest happens over WhatsApp: confirming your basis for managing the site, then the sensor package — what's in it, what it costs, and where it ships. Reach an admin on this number to get your request reviewed sooner.",
  },
  "verify.contactAdminCta": { id: "Chat admin", en: "Chat with an admin" },
  "verify.contactAdminMessage": {
    id: "Halo admin Nusa, saya baru mengirim pengajuan jadi pengelola.",
    en: "Hi Nusa admin, I've just submitted a request to become a manager.",
  },

  // ── Kontak dukungan ──
  "profile.anonUser": { id: "Pengguna", en: "User" },
  "profile.providerGoogle": { id: "Akun Google", en: "Google Account" },
  "profile.providerEmailCode": { id: "Kode Email", en: "Email Code" },
  "profile.dashboardDesc": { id: "Kelola destinasi dan pengguna", en: "Manage destinations and users" },
  "support.title": { id: "Masih butuh bantuan?", en: "Still need help?" },
  "support.replyTime": {
    id: "Balasan biasanya dalam 1×24 jam kerja",
    en: "We usually reply within one working day",
  },
  "support.mailSubject": { id: "Bantuan Nusa", en: "Nusa support" },
  "support.waMessage": {
    id: "Halo, saya butuh bantuan soal Nusa.",
    en: "Hi, I need help with Nusa.",
  },
  "support.destNote": {
    id: "Untuk perubahan jadwal atau komplain soal satu destinasi, hubungi langsung pengelolanya lewat tombol WhatsApp di halaman destinasi — biasanya lebih cepat.",
    en: "For schedule changes or complaints about a specific destination, contact its manager directly via the WhatsApp button on the destination page — usually faster.",
  },

  // ── Bantuan & FAQ ──
  "profile.faqTitle": { id: "Pertanyaan yang sering ditanyakan", en: "Frequently asked questions" },
  "faq.group.account": { id: "Akun", en: "Account" },
  "faq.group.booking": { id: "Booking & pembayaran", en: "Booking & payment" },
  "faq.group.dest": { id: "Destinasi & pemantauan", en: "Destinations & monitoring" },
  "faq.group.manager": { id: "Pengelola & kamera", en: "Managers & cameras" },
  "faq.group.other": { id: "Lainnya", en: "Other" },

  "faq.noPassword.q": { id: "Kenapa tidak ada password?", en: "Why is there no password?" },
  "faq.noPassword.a": {
    id: "Nusa tidak memakai password sama sekali. Isi alamat email, kami kirim kode 6 digit ke sana, lalu ketik kodenya untuk masuk. Kode itu sekaligus membuktikan email kamu asli — tidak ada password yang bisa bocor atau lupa. Kalau emailnya belum punya akun, akunnya dibuat otomatis setelah kode benar.",
    en: "Nusa uses no passwords at all. Enter your email, we send a 6-digit code there, and you type it in to sign in. That code also proves the address is really yours — there's no password to leak or forget. If the email has no account yet, one is created once the code checks out.",
  },
  "faq.codeMissing.q": { id: "Kode tidak masuk, bagaimana?", en: "The code never arrived — what now?" },
  "faq.codeMissing.a": {
    id: "Cek folder Spam atau Promosi dulu. Kalau tetap tidak ada, tekan Kirim ulang di halaman kode — bisa sekali per menit. Kode berlaku 10 menit dan hanya sekali pakai; salah 5 kali, kodenya hangus dan kamu perlu minta yang baru.",
    en: "Check your Spam or Promotions folder first. If it's still missing, hit Resend on the code screen — once per minute. A code lasts 10 minutes and works only once; after 5 wrong tries it's discarded and you'll need a new one.",
  },
  "faq.changeName.q": { id: "Cara ganti nama atau nomor telepon?", en: "How do I change my name or phone number?" },
  "faq.changeName.a": {
    id: "Buka Profil › Pengaturan. Nama dan nomor telepon bisa diubah di kartu paling atas. Alamat email tidak bisa diganti sendiri karena dia yang jadi kunci masuk akun — hubungi kami kalau perlu pindah alamat.",
    en: "Go to Profile › Settings. Name and phone live in the top card. Your email can't be changed yourself because it's the key to your account — contact us if you need to move to a new address.",
  },

  "faq.howBook.q": { id: "Bagaimana cara memesan tiket?", en: "How do I book a ticket?" },
  "faq.howBook.a": {
    id: "Buka halaman destinasi, tekan Booking, lalu pilih jenis tiket dan jumlahnya. Isi tanggal kunjungan, nama, dan nomor telepon, lalu kirim. Tiket langsung terbit dengan status Terkonfirmasi.",
    en: "Open a destination page, tap Booking, then pick the ticket types and quantities. Fill in your visit date, name, and phone, then submit. The ticket is issued immediately with Confirmed status.",
  },
  "faq.payMethods.q": { id: "Metode pembayaran apa saja yang tersedia?", en: "Which payment methods are available?" },
  "faq.payMethods.a": {
    id: "Transfer bank (BCA, Mandiri, BNI), e-wallet (GoPay, OVO, DANA), atau tunai di lokasi. Pilih metodenya lewat tombol Bayar di Riwayat Booking. Tiket tetap berlaku walau statusnya belum lunas — pembayaran tunai diselesaikan di loket.",
    en: "Bank transfer (BCA, Mandiri, BNI), e-wallet (GoPay, OVO, DANA), or cash on site. Choose via the Pay button in Booking History. The ticket stays valid even while unpaid — cash is settled at the counter.",
  },
  "faq.whereTicket.q": { id: "Di mana tiket dan QR-nya?", en: "Where do I find my ticket and QR code?" },
  "faq.whereTicket.a": {
    id: "Profil › Riwayat Booking, lalu buka booking yang dimaksud. Tunjukkan QR di layar kepada petugas saat check-in. Satu tiket hanya bisa dipindai sekali; setelah itu statusnya berubah jadi Terpakai.",
    en: "Profile › Booking History, then open the booking. Show the on-screen QR to the officer at check-in. Each ticket scans only once; after that its status becomes Used.",
  },
  "faq.cancel.q": { id: "Bisa membatalkan booking?", en: "Can I cancel a booking?" },
  "faq.cancel.a": {
    id: "Bisa, lewat Riwayat Booking › Batalkan. Pembatalan bersifat permanen — tiket yang sudah dibatalkan tidak bisa diaktifkan lagi, jadi pastikan dulu sebelum konfirmasi. Untuk pengembalian dana, hubungi pengelola destinasi.",
    en: "Yes, via Booking History › Cancel. Cancelling is permanent — a cancelled ticket can't be reactivated, so be sure before confirming. For refunds, contact the destination manager.",
  },
  "faq.changeDate.q": {
    id: "Bagaimana kalau mau ubah tanggal atau jumlah orang?",
    en: "What if I need to change the date or number of guests?",
  },
  "faq.changeDate.a": {
    id: "Pengubahan belum bisa dilakukan sendiri dari aplikasi. Hubungi pengelola destinasi lewat tombol WhatsApp di halaman destinasi, atau batalkan booking lalu pesan ulang dengan data yang benar.",
    en: "Edits aren't self-service yet. Contact the destination manager via the WhatsApp button on the destination page, or cancel and rebook with the right details.",
  },

  "faq.sensorData.q": {
    id: "Angka suhu dan cuaca di halaman destinasi itu dari mana?",
    en: "Where do the temperature and weather figures come from?",
  },
  "faq.sensorData.a": {
    id: "Dari sensor IoT yang terpasang di destinasi tersebut: suhu udara, kelembapan, suhu air, kondisi cuaca, dan kecepatan angin. Nilainya diperbarui real-time. Destinasi tanpa sensor tidak menampilkan panel ini.",
    en: "From IoT sensors installed at that destination: air temperature, humidity, water temperature, weather, and wind speed. Values update in real time. Destinations without sensors don't show this panel.",
  },
  "faq.sensorDash.q": {
    id: 'Kenapa data sensor menampilkan tanda "--"?',
    en: 'Why does the sensor data show "--"?',
  },
  "faq.sensorDash.a": {
    id: "Artinya perangkat sedang tidak mengirim data — biasanya karena listrik atau koneksi di lokasi terputus. Angka akan muncul lagi sendiri begitu perangkat kembali online.",
    en: "It means the device isn't sending data — usually the power or connection on site has dropped. The numbers come back on their own once the device is online again.",
  },
  "faq.saveFav.q": { id: "Cara menyimpan destinasi favorit?", en: "How do I save a favourite destination?" },
  "faq.saveFav.a": {
    id: "Tekan ikon hati di kartu destinasi. Semua yang tersimpan bisa dibuka lagi lewat Profil › Tersimpan. Fitur ini butuh akun yang sudah masuk.",
    en: "Tap the heart icon on a destination card. Everything saved is available under Profile › Saved. You need to be signed in.",
  },

  "faq.becomeManager.q": {
    id: "Bagaimana cara jadi pengelola destinasi?",
    en: "How do I become a destination manager?",
  },
  "faq.becomeManager.a": {
    id: "Buka Profil › Pengaturan › Jadi Pengelola, lalu isi nama lengkap, nomor HP, instansi, dan destinasi yang dikelola. Pengajuan ditinjau admin; statusnya (menunggu, disetujui, ditolak) muncul di kartu yang sama.",
    en: "Go to Profile › Settings › Become a Manager, then fill in your full name, phone, organisation, and the destination you manage. An admin reviews the request; its status (pending, approved, rejected) appears on the same card.",
  },
  "faq.cameraPending.q": {
    id: 'Kenapa kamera saya berstatus "Menunggu admin"?',
    en: 'Why is my camera stuck on "Awaiting admin"?',
  },
  "faq.cameraPending.a": {
    id: "Setiap kamera baru harus disetujui admin sebelum bisa disiarkan. Selama masih menunggu, QR dan alamat server belum aktif. Kalau pengajuan ditolak, hapus kamera itu lalu daftarkan ulang dengan data yang benar.",
    en: "Every new camera needs admin approval before it can stream. While pending, its QR and server address stay inactive. If the request is rejected, delete that camera and register it again with correct details.",
  },

  "faq.assistant.q": {
    id: "Ada asisten yang bisa ditanya soal destinasi?",
    en: "Is there an assistant I can ask about destinations?",
  },
  "faq.assistant.a": {
    id: "Ada. Tombol chat di pojok kanan bawah menjawab pertanyaan soal destinasi, harga, dan cara booking berdasarkan katalog terbaru. Untuk urusan yang butuh manusia, hubungi kami lewat kontak di bawah.",
    en: "Yes. The chat button in the bottom-right answers questions about destinations, prices, and booking using the latest catalogue. For anything needing a human, use the contacts below.",
  },
  "faq.darkMode.q": { id: "Cara mengaktifkan mode gelap?", en: "How do I turn on dark mode?" },
  "faq.darkMode.a": {
    id: "Profil › Pengaturan › Mode Gelap. Pilihannya tersimpan di perangkat ini dan tetap berlaku saat aplikasi dibuka lagi.",
    en: "Profile › Settings › Dark Mode. The choice is stored on this device and sticks the next time you open the app.",
  },

  // ── Peran akun ──
  "role.adminDesc": {
    id: "Akses penuh dashboard: destinasi, pengguna, dan kamera.",
    en: "Full dashboard access: destinations, users, and cameras.",
  },
  "role.pengelolaDesc": {
    id: "Kelola destinasi yang ditetapkan admin beserta booking & kameranya.",
    en: "Manage the destinations assigned by an admin, plus their bookings & cameras.",
  },

  // ── Masuk tanpa password (kode 6 digit) ──
  "auth.signInTitle": { id: "Masuk ke Nusa", en: "Sign in to Nusa" },
  "auth.signInLede": {
    id: "Tanpa password — kami kirim kode 6 digit ke email kamu.",
    en: "No password — we'll email you a 6-digit code.",
  },
  "auth.continueGoogle": { id: "Lanjut dengan Google", en: "Continue with Google" },
  "auth.or": { id: "atau", en: "or" },
  "auth.emailPlaceholder": { id: "nama@email.com", en: "name@email.com" },
  "auth.sendCode": { id: "Kirim kode", en: "Send code" },
  "auth.newAccountHint": {
    id: "Belum punya akun? Isi email yang sama — akunmu dibuat otomatis setelah kode diverifikasi.",
    en: "No account yet? Use the same email — yours is created automatically once the code checks out.",
  },
  "auth.checkEmailTitle": { id: "Cek email kamu", en: "Check your email" },
  "auth.codeSentTo": {
    id: "Kami kirim kode {digits} digit ke {email}. Ketik kodenya di bawah untuk masuk.",
    en: "We sent a {digits}-digit code to {email}. Enter it below to sign in.",
  },
  "auth.codeLabel": { id: "Kode masuk", en: "Sign-in code" },
  "auth.checkingCode": { id: "Memeriksa kode…", en: "Checking code…" },
  "auth.resend": { id: "Belum dapat email? Kirim ulang", en: "Didn't get the email? Resend" },
  "auth.resendIn": { id: "Kirim ulang ({seconds})", en: "Resend ({seconds})" },
  "auth.wrongEmail": { id: "Salah email?", en: "Wrong email?" },
  "auth.changeEmail": { id: "Ganti alamat", en: "Change address" },
  "auth.codeStillValid": {
    id: "Kode sebelumnya masih berlaku. Cek email kamu.",
    en: "Your previous code is still valid. Check your email.",
  },
  "auth.invalidEmail": { id: "Format email tidak valid.", en: "That email address isn't valid." },
  "auth.sendFailed": { id: "Gagal mengirim kode. Coba lagi.", en: "Couldn't send the code. Please try again." },
  "auth.sendFailedNetwork": {
    id: "Gagal mengirim kode. Periksa koneksi kamu.",
    en: "Couldn't send the code. Check your connection.",
  },
  "auth.codeResent": {
    id: "Kode baru terkirim. Cek inbox (atau folder spam).",
    en: "A new code is on its way. Check your inbox (or spam folder).",
  },
  "auth.codeWrong": { id: "Kode salah. Periksa lagi email kamu.", en: "Wrong code. Check your email again." },
  "auth.codeExpired": { id: "Kode sudah kedaluwarsa. Minta kode baru.", en: "That code has expired. Request a new one." },
  "auth.codeLocked": {
    id: "Terlalu banyak percobaan. Minta kode baru.",
    en: "Too many attempts. Request a new code.",
  },
  "auth.verifyFailed": { id: "Gagal memverifikasi. Coba lagi.", en: "Couldn't verify. Please try again." },
  "auth.cancelled": { id: "Login dibatalkan.", en: "Sign-in cancelled." },

  // ── Layar verifikasi email (sisa akun era password) ──
  "auth.verifyLede": {
    id: "Kami mengirim link verifikasi ke {email}. Klik link itu untuk mengaktifkan akun — langkah ini memastikan akunmu asli, bukan palsu.",
    en: "We sent a verification link to {email}. Click it to activate your account — this step confirms the account is really yours.",
  },
  "auth.verifyWaiting": { id: "Menunggu verifikasi…", en: "Waiting for verification…" },
  "auth.verifyDone": { id: "Saya sudah verifikasi", en: "I've verified" },
  "auth.verifyNotYet": {
    id: "Belum terverifikasi. Klik dulu link di email kamu, lalu coba lagi.",
    en: "Not verified yet. Click the link in your email first, then try again.",
  },
  "auth.verifyCheckFailed": { id: "Gagal memeriksa. Coba lagi.", en: "Couldn't check. Please try again." },
  "auth.verifySent": {
    id: "Email verifikasi terkirim. Cek inbox (atau folder spam).",
    en: "Verification email sent. Check your inbox (or spam folder).",
  },
  "auth.verifyResendFailed": { id: "Gagal mengirim ulang. Coba lagi.", en: "Couldn't resend. Please try again." },
  "auth.sending": { id: "Mengirim…", en: "Sending…" },
  "auth.logoutRegister": { id: "Keluar & daftar ulang", en: "Sign out & start over" },
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
