# Proyek Karang - Deteksi & Kesehatan Karang AI (YOLOv8)

Proyek ini mendeteksi jenis karang dan menganalisis kesehatannya secara real-time menggunakan model **YOLOv8** dan analisis nilai kecerahan citra (ROI). Web backend terintegrasi penuh untuk melayani aplikasi frontend React (Vercel).

---

## 📂 Struktur Direktori Terorganisir
Struktur folder proyek ini telah dirapikan agar lebih terstruktur dan mudah dikelola:

```text
Proyek_Karang/
├── tools/                  # Script pendukung pengembangan & training model
│   ├── augmentasi.py       # Augmentasi dataset gambar bawah laut
│   ├── train.py            # Script pelatihan model YOLOv8
│   └── uji_model.py        # Pengujian model dengan gambar tunggal
├── templates/              # Antarmuka web lokal Flask
│   └── index.html          # File HTML monitoring lokal (auto-start camera)
├── dataset/                # Dataset asli karang
├── aug_dataset/            # Dataset hasil augmentasi
├── runs/                   # Hasil training & ekspor bobot YOLO
├── venv_mac/               # Virtual environment Python (khusus macOS)
├── app_web.py              # Server Web Backend Flask — kamera coral global (halaman Monitoring)
├── kamera_deteksi.py       # Server kamera mitra multi-kamera + deteksi (halaman Kamera per-user)
├── app_karang.py           # Aplikasi Desktop GUI Standalone
├── best.pt                 # Bobot YOLOv8 hasil training terbaik
├── yolov8n.pt              # Bobot model dasar (Nano) YOLOv8
├── data.yaml               # Konfigurasi kelas dataset YOLO
└── README.md               # Dokumentasi proyek (File Ini)
```

---

## ⚡ Optimalisasi Kode yang Diterapkan

Kami telah melakukan serangkaian pembaruan performa dan stabilitas pada aplikasi:

1. **Thread-Safe Camera Streamer (`app_web.py`):**
   * **Masalah Awal:** Membaca kamera langsung di thread Flask worker menyebabkan bentrokan konkurensi OpenCV (*race condition*) jika diakses beberapa klien/halaman sekaligus, berisiko tinggi membuat server crash.
   * **Solusi:** Kami membuat kelas `CameraStreamer` yang meluncurkan **1 background thread** untuk menangkap gambar secara konstan di latar belakang, memproses prediksi YOLO sekali saja, lalu menyimpannya dalam memori. Seluruh klien yang mengakses `/video_feed` akan langsung dikirimi data memori pra-proses ini.
   * **Hasil:** CPU usage turun drastis dan server menjadi 100% thread-safe dari crash OpenCV.

2. **Perbaikan Bug Ganda Flask Debugger:**
   * Kami mematikan parameter `debug=True` pada eksekusi produksi Flask (`debug=False`). Flask reload-debugger biasanya menjalankan server dua kali yang menyebabkan bentrokan perebutan port kamera bawaan.

3. **Fallback Model Path Otomatis:**
   * Baik `app_web.py` maupun `app_karang.py` sekarang memiliki mekanisme pendeteksian otomatis lokasi bobot terbaik (`best.pt`). Jika tidak ditemukan di root directory, sistem otomatis mendeteksi di folder `runs/detect/...` sebelum beralih ke `yolov8n.pt` sebagai fallback terakhir agar aplikasi **tidak pernah crash saat dinyalakan**.

---

## 🚀 Cara Menjalankan Program

Aktivasi Virtual Environment macOS sebelum menjalankan perintah apa pun:
```bash
cd Proyek_Karang
source venv_mac/bin/activate
```

### 1. Menjalankan Server Web Utama (Untuk React/Next.js/Vercel/Ngrok)
Jalankan Flask server yang melayani API statistik dan video feed:
```bash
python app_web.py
```
* Buka browser di alamat: `http://localhost:5001` (kamera otomatis langsung menyala saat dimuat).

### 1b. Menjalankan Server Kamera Mitra + Deteksi (multi-kamera per-user)
Server ini menggabungkan relay kamera mitra (dulu `camera-server/server.py`)
dengan deteksi karang: tiap kamera yang didaftarkan mitra distream dengan
anotasi YOLO + `coral_logic`, dan punya statistik & riwayat deteksi sendiri.
```bash
python kamera_deteksi.py                             # default port 5001
python kamera_deteksi.py --port 5002                 # bila app_web.py sudah pakai 5001
python kamera_deteksi.py --password rahasiaku        # password kelola sendiri
```
* Buka `http://<alamat-server>:<port>` untuk mendaftarkan kamera (dapat ID pendek),
  lalu salin **Alamat Server** ke kolom "Alamat Server Kamera" di website OTA
  (Profil → Kamera) dan **ID** ke form "Tambah Kamera".
* **Halaman kelola dipassword** (Basic Auth): tanpa `--password`, password acak
  dicetak di terminal saat server start (username bebas). Hanya pemegang password
  yang bisa melihat daftar ID & menambah/menghapus kamera; stream tetap terbuka
  karena ID-nya acak dan `<img>` MJPEG tidak bisa mengirim header auth.
* Deteksi hanya berjalan **saat kamera ditonton** (live view dibuka): model YOLO
  dimuat per kamera saat penonton pertama datang dan dilepas ~30 dtk setelah
  penonton terakhir pergi. Statistik & riwayat terkumpul selama sesi menonton.
* Endpoint per kamera: `/stream/<id>` (teranotasi), `/snapshot/<id>`,
  `/stats/<id>`, `/history/<id>`.

### 2. Menjalankan Aplikasi GUI Desktop Standalone
Jalankan aplikasi desktop lokal cepat tanpa browser:
```bash
python app_karang.py
```
* Tekan tombol **`q`** pada jendela video untuk menutup aplikasi.

### 3. Menggunakan Development Tools (Di dalam folder `tools/`)
Gunakan alat-alat di bawah ini untuk siklus pengembangan/pelatihan model:

* **Augmentasi Data:**
  ```bash
  python tools/augmentasi.py
  ```
* **Melatih Model Baru:**
  ```bash
  python tools/train.py
  ```
* **Menguji Gambar Tunggal:**
  ```bash
  python tools/uji_model.py
  ```

Setelah selesai menggunakan program, Anda bisa keluar dari virtual environment dengan mengetikkan `deactivate`.
