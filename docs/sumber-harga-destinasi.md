# Sumber Harga Item Destinasi

Rujukan asal-usul tiap nominal di `destinations/*/priceItems`. Diperbarui
30 Agustus 2026.

Kolom **Sumber** berisi salah satu dari dua hal:

- **URL** — angkanya dikutip langsung dari terbitan itu.
- **`benchmark`** — tidak ada tarif resmi yang diterbitkan untuk item ini, jadi
  nominalnya disetarakan dengan item sejenis di destinasi lain yang sumbernya
  ada. Ditandai eksplisit supaya tidak terbaca sebagai angka terverifikasi.

Kurs yang dipakai untuk item berdenominasi USD: ±Rp16.200/USD.

## Terverifikasi dari sumber

| Destinasi | Item | Harga | Sumber |
|---|---|---|---|
| Pulau Siladen | Tiket Taman Nasional | Rp10.000 /pax | [Kompas, 31 Okt 2024 — tarif TN Bunaken naik dari Rp5.000 jadi Rp10.000; WNA Rp150.000](https://travel.kompas.com/read/2024/10/31/171018027/harga-tiket-masuk-taman-nasional-bunaken-naik-jadi-rp-10000-per-orang) |
| Manado Tua | Tiket Taman Nasional | Rp10.000 /pax | idem |
| Pulau Siladen | Sewa Alat Snorkel | Rp100.000 /set | [iNews Manado — sewa set snorkel Bunaken Rp100.000–150.000 per hari](https://manado.inews.id/read/250966) |
| Desa Wisata Bahoi | Paket Diving | Rp500.000 /pax | [tiket.com — diving Desa Bahoi Rp500.000/orang per tabung, termasuk pemandu & perahu](https://blog.tiket.com/desa-wisata-bahoi-di-likupang/) |
| Desa Wisata Bahoi | Sewa Alat Snorkel | Rp25.000 /set | idem |
| Pantai Pulisan | Tiket Masuk | Rp5.000 /pax | [Kompas Regional, 20 Apr 2024](https://regional.kompas.com/read/2024/04/20/161301078/pantai-pulisan-di-sulawesi-utara-daya-tarik-harga-tiket-dan-rute) |
| Pantai Paal | Tiket Masuk | Rp10.000 /pax | [Ketik Media — Rp10.000–15.000](https://ketikmedia.com/wisata/wisata-di-sulawesi/tiket-masuk-pantai-paal) |
| Pantai Paal | Homestay Desa Marinsow | Rp250.000 /malam | [Kompas Properti — homestay Likupang Rp200.000–250.000, termasuk sarapan 2 orang](https://properti.kompas.com/read/2021/03/09/210000521/menginap-di-homestay-manado-likupang-cuma-rp-200000-per-malam) |
| Pantai Pulisan | Homestay Desa Pulisan | Rp250.000 /malam | idem |
| Pulau Kakara | Penyeberangan Katinting | Rp150.000 /perahu | [Skyscanner Indonesia — Rp150.000 per perahu, muat 6–8 orang PP (±Rp25.000/orang)](https://www.skyscanner.co.id/berita/jelajah-pulau-di-maluku-utara) |
| Pantai Sulamadaha | Sewa Perahu Kano ke Teluk | Rp25.000 /pax | [Portal Mojokerto — kano ke Teluk Saomadaha Rp25.000/orang; masuk pantai gratis](https://portalmojokerto.pikiran-rakyat.com/gaya-hidup/pr-2479285960/pantai-sulamadaha-ternate-2025-wisata-air-jernih-maluku-utara-dengan-tiket-masuk-fasilitas-terkini) |
| Pantai Sulamadaha | Sewa Ban Pelampung | Rp10.000 /pax | idem |
| Pantai Kupa Kupa | Sewa Ban Pelampung | Rp10.000 /pax | idem (tarif sewa ban di pantai Maluku Utara) |
| Pulau Gangga | Resort Pulau Gangga | Rp5.200.000 /malam | [TripAdvisor — Gangga Island Resort & Spa ±USD 321/malam](https://www.tripadvisor.com/Hotel_Review-g17752538-d661103-Reviews-Gangga_Island_Resort_Spa-Gangga_Satu_North_Sulawesi_Sulawesi.html) |
| Manado Tua | Perahu Island Hopping | Rp100.000 /pax | [perahubunaken.com — sewa kapal PP Rp1,5–2 juta untuk kapasitas 10–25 orang](https://perahubunaken.com/harga-rental-kapal-ke-bunaken-terbaru/) |

## Benchmark (belum ada tarif terbitan)

| Destinasi | Item | Harga | Dasar penyetaraan |
|---|---|---|---|
| Pantai Kupa Kupa | Tiket Masuk | Rp5.000 /pax | Pantai di sekitar Tobelo memungut Rp2.000–20.000; diambil nilai tengah bawah |
| Pantai Kupa Kupa | Sewa Gazebo | Rp50.000 /unit | Tarif gazebo pantai umum; unit diperbaiki dari `/pax` — gazebo disewa per bangunan |
| Pulau Gangga | Tiket Masuk | Rp20.000 /pax | Retribusi desa; tidak ada tarif resmi yang diterbitkan |
| Pulau Gangga | Trip Snorkeling | Rp150.000 /trip | Setara trip snorkeling berpemandu di Likupang |
| Pantai Pulisan | Pemandu Snorkeling | Rp100.000 /trip | idem |
| Pantai Paal | Sewa Alat Snorkel | Rp75.000 /set | Kisaran sewa set snorkel Sulawesi Utara Rp50.000–100.000 |
| Selat Lembeh | Trip Muck Diving | Rp750.000 /dive | Kisaran tarif dive center Selat Lembeh (±USD 45/dive) |
| Selat Lembeh | Penyeberangan Perahu | Rp25.000 /pax | Setara tarif *public board* Bitung–Lembeh |
| Selat Lembeh | Penginapan Pulau Lembeh | Rp300.000 /malam | Setara homestay & guest house sekitar selat |
| Pulau Siladen | Cottage Pulau Siladen | Rp400.000 /malam | Setara cottage lokal non-resort di Bunaken |
| Desa Wisata Bahoi | Tiket Wisata Mangrove | Rp5.000 /pax | Setara tiket masuk desa wisata Likupang |
| Desa Wisata Bahoi | Homestay Desa Bahoi | Rp250.000 /malam | Setara homestay Likupang bersumber di atas |

## Perbaikan satuan yang menyentuh perhitungan tagihan

`isHourly()` di `lib/destination.ts` membaca string `unit` untuk memutuskan
apakah harga dikali durasi sewa. Tiga satuan berikut diperbaiki karena salah
membuat tagihan berlipat atau salah hitung:

| Destinasi | Item | Sebelum | Sesudah | Akibat kalau dibiarkan |
|---|---|---|---|---|
| Desa Wisata Bahoi | Sewa Alat Snorkel | `1/jam` | `/set` | Terbaca per jam — tagihan dikali lama sewa |
| Pulau Siladen | Sewa Alat Snorkel | `/jam` | `/set` | idem; Rp100.000/jam juga jauh di atas pasar |
| Pulau Kakara | Penyeberangan Katinting | `/pax` | `/perahu` | Rp150.000 adalah tarif satu perahu (6–8 orang), bukan per orang |
| Pantai Kupa Kupa | Sewa Gazebo | `/pax` | `/unit` | Gazebo disewa per bangunan |

## Catatan lain

- `priceStart: 50000` pada Desa Wisata Bahoi dihapus. Field itu warisan harga
  tunggal lama dan hanya dibaca `getPriceItems()` sebagai cadangan saat
  `priceItems` kosong — nilainya sudah tidak pernah tampil, dan angkanya
  bertentangan dengan item termurah destinasi itu (Rp5.000).
- Pantai Sulamadaha: parkir kendaraan sengaja **tidak** dijadikan item harga.
  Selain tidak lazim dipesan lewat OTA, `priceFrom()` mengambil nilai minimum
  seluruh item, jadi tarif parkir akan menjadi angka "Mulai dari" destinasi itu.
  Keterangannya dititipkan di deskripsi item penyeberangan, sama seperti
  Pantai Paal dan Pantai Pulisan.
