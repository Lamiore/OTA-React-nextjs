# Server Kamera Mitra (demo lokal)

Server Python kecil yang menyiarkan ulang kamera sebagai stream MJPEG dengan
ID pendek. Mitra mendaftarkan kamera di sini, lalu menempelkan ID-nya di
website OTA. Semua perangkat (laptop, HP kamera, HP penonton) harus **satu WiFi**.

## Menjalankan

```bash
cd camera-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py            # default port 5001 (5000 dipakai AirPlay macOS)
```

Terminal menampilkan alamat server, misal `http://192.168.1.5:5001`.
Buka alamat itu di browser.

## Alur demo

1. **Sekali saja** — salin "Alamat Server" dari halaman utama, tempel di kolom
   **Alamat Server Kamera** di website OTA (Profil → Kamera, atau panel Kamera
   admin), lalu Simpan. Bila WiFi/IP laptop berubah, cukup ganti alamat ini
   lagi di website — semua kamera langsung mengikuti.
2. Tambah kamera di halaman ini. Sumber yang didukung:
   - `0` — webcam bawaan laptop;
   - `http://192.168.1.20:8080/video` — HP Android dengan aplikasi IP Webcam;
   - `test` — pola uji bergerak, tanpa kamera fisik.
3. Salin **ID** kamera (6 huruf) → tempel di form "Tambah Kamera" website OTA.
4. Buka "Lihat Live" di website OTA — stream tampil.

## Catatan

- Website OTA harus dibuka lewat `npm run dev` (HTTP) saat demo; site Vercel
  ber-HTTPS memblokir stream HTTP lokal (mixed content).
- Daftar kamera disimpan di `cameras.json` (di-gitignore), jadi ID tidak
  berubah walau server di-restart.
- Stream bisa dicek langsung: `http://<alamat-server>/stream/<id>`, atau satu
  frame saja di `/snapshot/<id>`.
