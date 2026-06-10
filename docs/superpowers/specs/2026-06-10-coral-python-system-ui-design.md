# Design: Perbaikan Sistem & UI Web Lokal — Proyek_Karang

**Tanggal:** 2026-06-10
**Scope:** `Proyek_Karang/app_web.py` (backend Flask) + `Proyek_Karang/templates/index.html` (UI web lokal)
**Di luar scope:** persist history ke SQLite/Firebase, GUI desktop (`app_karang.py`), website Next.js (hanya dijaga agar tidak rusak)

---

## 1. Konteks & Masalah

Program Python punya tiga bagian: `app_web.py` (backend Flask + serve halaman lokal), `templates/index.html` (UI web lokal), dan `app_karang.py` (GUI desktop). Website Next.js mengonsumsi API dari `app_web.py` (`/video_feed`, `/stats`, `/history`).

Masalah yang akan diperbaiki:

1. **Dua jalur kamera tumpang tindih.** `index.html` menangkap webcam via browser (`getUserMedia`) lalu POST ke `/predict_camera` tiap 1,5 dtk, sementara `app_web.py` juga menjalankan background thread yang membuka kamera 0 untuk `/video_feed`. Di satu laptop, keduanya rebutan kamera fisik yang sama.
2. **Hitungan "total karang" tidak valid.** Deteksi direkam ulang per-frame (throttle `RECORD_INTERVAL=2s`), sehingga satu karang diam dihitung berkali-kali — total membengkak.
3. **Logika kesehatan rapuh.** `predict_health()` memakai rata-rata kecerahan (brightness) BGR dengan ambang 120/180. Kecerahan sangat dipengaruhi pencahayaan/kedalaman/white-balance, bukan kondisi karang.
4. **Chart kesehatan di `index.html` bug** — disuapi `data.populasi` per-frame yang di-reset tiap frame, bukan data kumulatif.

Keputusan yang sudah disepakati dengan user:
- `index.html` dibuka **di laptop yang sama dengan kamera** → kamera ditangkap di server, halaman cukup menampilkan `/video_feed`.
- Tipe scene **belum pasti / bisa dua-duanya** → tampilkan **dua angka berlabel jelas**: "terlihat saat ini" dan "total unik kumulatif".

---

## 2. Arsitektur Kamera (disatukan)

- Kamera ditangkap **hanya di server** lewat `CameraStreamer` background thread (sudah ada). Satu sumber kebenaran.
- `index.html` menampilkan `/video_feed` (MJPEG) — sama seperti panel Next.js. Semua kode `getUserMedia`/`<canvas>`/`detectRealtime` dibuang.
- Endpoint `/predict_camera` **dihapus** (hanya dipakai `index.html` lama; panel Next.js tidak memakainya).
- Loop kontinu di background thread inilah tempat tracking dijalankan (`model.track()` butuh state antar-frame yang kontinu).

---

## 3. Hitungan Karang — Dua Metrik Berlabel

### 3.1 Terlihat saat ini (gauge)
Jumlah track ID yang tampak di frame terkini. Tracking dipakai untuk **menstabilkan** angka agar tidak kedip-kedip, bukan untuk dijumlah.

### 3.2 Total unik kumulatif (commit-on-confirmation)
- Loop live memakai `model.track(persist=True, tracker="bytetrack.yaml")`. Tiap box punya `box.id` (track ID).
- Registry per track: `{jenis, votes(Counter kesehatan), frames, last_seen, committed}`.
- Satu karang **di-commit sekali** ke counter kumulatif setelah terlihat ≥ `CONFIRM_FRAMES` (default 5) frame. Saat commit: `total += 1`, `by_jenis[jenis] += 1`, `by_health[majority] += 1`, tambah satu baris ke history, masukkan id ke `seen_ids`.
- `seen_ids` (set permanen) mencegah track yang sama di-commit ulang.
- Prune entri registry yang `now - last_seen > TRACK_TTL` (default 30 dtk) untuk membatasi memori; `seen_ids` tetap menjaga agar tidak terjadi double-count bila id muncul lagi.

### 3.3 Caveat akurasi (WAJIB disebut, dari review)
ByteTrack mengasosiasikan track berdasarkan IoU/motion, **tanpa re-ID berbasis tampilan**. Bila deteksi sempat putus beberapa frame, karang yang sama bisa mendapat **ID baru** → ikut terhitung lagi di total kumulatif. `seen_ids` hanya mencegah *id yang sama* dihitung ulang, **bukan** *karang yang sama yang berganti id*.

Konsekuensi:
- Angka kumulatif disebut sebagai **"jumlah track unik"** dengan caveat ini — bukan diklaim sebagai "jumlah karang" mutlak.
- Stabilitas track-id **tidak bisa diverifikasi di atas kertas** — harus diuji pada footage nyata. Plan implementasi wajib memuat langkah verifikasi: jalankan, amati apakah satu karang mempertahankan satu id, lalu tuning `CONFIRM_FRAMES`/parameter tracker bila perlu.

---

## 4. Logika Kesehatan (brightness → HSV)

- Konversi ROI ke HSV; ambil rata-rata **Saturation (S)** dan **Value (V)** (skala 0–255 OpenCV).
- Rule (threshold = konstanta yang bisa di-tune):
  - `S < S_BLEACH` **dan** `V > V_BRIGHT` → **Mengalami Pemutihan** (kehilangan warna, pucat/putih)
  - `S < S_HEALTHY` → **Kurang Sehat**
  - selain itu → **Sehat**
  - Default awal (akan di-tune di footage): `S_BLEACH=40`, `V_BRIGHT=160`, `S_HEALTHY=90`.
- **Center-crop ~50% bagian tengah box** sebelum hitung HSV, supaya air/background di sudut box tidak mengontaminasi rata-rata.
- **Smoothing antar-frame**: kesehatan per track = **majority vote** dari `votes` sepanjang track terlihat. Label pada overlay & nilai yang di-commit memakai majority vote ini → tidak kedip. Box tanpa id (jika tracking gagal) fallback ke nilai per-frame.
- Dibingkai sebagai **proxy rule-based** — HSV-saturasi proxy yang lebih baik daripada brightness, tapi tetap belum tervalidasi; jangan overclaim.

---

## 5. Thread-Safety

- Loop live berjalan di **satu** background thread → state tracker `model.track(persist=True)` hanya disentuh satu thread.
- Upload `/predict` berjalan di Flask worker thread. Ultralytics **tidak thread-safe** untuk inferensi konkuren, jadi `/predict` memakai **instance YOLO terpisah** (`upload_model = YOLO(MODEL_PATH)`, `.predict()`), tidak berbagi state dengan tracker live.
- Counter kumulatif, snapshot "current", dan history dilindungi lock.

---

## 6. Perubahan Perilaku Endpoint (eksplisit)

| Endpoint | Perubahan |
|---|---|
| `/video_feed` | Tetap (MJPEG dari background thread). Kini frame dianotasi dengan health majority-vote per track. |
| `/stats` | **Backward compatible**: tetap mengembalikan `total`/`by_health`/`by_jenis` (kumulatif) di top-level agar website Next.js tidak rusak; **+ tambahan** objek `current: {total, by_health, by_jenis}` untuk angka "terlihat saat ini". |
| `/history` | Bentuk JSON sama (`{total, count, history}`) → panel Next.js tetap jalan. **Semantik berubah**: satu baris per karang unik (jenis, kesehatan majority, waktu commit), bukan rekaman per-frame yang di-throttle. |
| `/predict` (upload) | Hasil ditampilkan inline, tapi **tidak lagi menulis** ke counter/history live (sebelumnya menulis). Perubahan disengaja agar angka live tetap murni. Memakai `upload_model` terpisah. |
| `/predict_camera` | **Dihapus.** |
| `/export_csv`, `/` | Tetap. |

---

## 7. UI `index.html` (redesign)

- Tetap tema **dark dashboard** (cocok untuk monitoring video), dirapikan.
- Struktur:
  1. **Header** — judul + indikator status koneksi server (hijau "Terhubung" / merah "Server terputus" bila fetch gagal).
  2. **Kartu video live** — `<img src="/video_feed">`, badge LIVE, legenda warna (Sehat/Kurang Sehat/Pemutihan). Dua angka besar berlabel: **"Terlihat saat ini"** (`current.total`) & **"Total unik kumulatif"** (`total`), masing-masing dengan keterangan singkat 1 baris.
  3. **Kartu statistik** — doughnut kesehatan (Chart.js) disuapi `by_health` **kumulatif** (bukan per-frame), + bar jenis karang dari `by_jenis`.
  4. **History feed** — dari `/history`, satu baris per karang unik (waktu, jenis, badge kesehatan).
  5. **Kartu upload gambar** — `/predict`, hasil inline, diberi label "uji gambar — tidak masuk statistik live".
  6. Tombol **Export CSV** (→ `/export_csv`, sudah ada).
- Polling `/stats` & `/history` tiap ~2 dtk. Tidak ada auto-start kamera browser.

---

## 8. Verifikasi (untuk plan)

1. Server start → background thread jalan, `/video_feed` tampil di `index.html`.
2. Sorot scene berisi karang → **"terlihat saat ini"** mencerminkan jumlah di layar dan stabil (tidak kedip tiap detik).
3. Amati **stabilitas track-id**: satu karang diam idealnya mempertahankan satu id; catat seberapa sering id berganti → tuning `CONFIRM_FRAMES`/parameter tracker. Ini ujian utama kredibilitas angka kumulatif.
4. Uji logika kesehatan HSV pada beberapa gambar (sehat berwarna vs pucat) → label sesuai harapan; tuning threshold bila perlu.
5. Upload gambar via kartu upload → hasil muncul, **tidak** mengubah angka live.
6. Buka panel Next.js (`/stats`, `/history`) → masih berfungsi (tidak rusak).
7. Export CSV → file terunduh.
