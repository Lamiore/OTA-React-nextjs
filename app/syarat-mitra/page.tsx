import type { Metadata } from 'next';
import TopNav from '@/components/desktop/TopNav';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';
import { AGREEMENT } from '@/lib/verification';

export const metadata: Metadata = {
  title: 'Perjanjian Mitra — Lautara',
  description:
    'Hak, kewajiban, dan ketentuan kamera pemantau bagi mitra kamera Lautara.',
};

/** Tanggal berlaku v1.0. Ditulis di sini karena hanya dipakai di halaman ini. */
const BERLAKU_SEJAK = '30 Juli 2026';

const PASAL: { judul: string; ayat: string[] }[] = [
  {
    judul: '1. Ruang Lingkup',
    ayat: [
      'Perjanjian ini mengatur hubungan antara Lautara ("Platform") dan pengguna yang disetujui menjadi mitra kamera ("Mitra").',
      'Mitra mendaftarkan dan mengoperasikan kamera pemantau yang tayangannya dapat ditampilkan di halaman destinasi Lautara.',
      'Mitra tidak mengelola data destinasi, daftar harga, maupun pesanan. Kewenangan itu ada pada pengelola destinasi dan admin.',
      'Perjanjian ini bukan perjanjian kerja. Mitra bukan karyawan Platform, tidak menerima upah, dan tidak memperoleh hak ketenagakerjaan dari Platform.',
    ],
  },
  {
    judul: '2. Hak Mitra',
    ayat: [
      'Mendaftarkan satu atau lebih kamera pemantau melalui halaman Kamera.',
      'Melihat tayangan langsung kameranya sendiri beserta riwayat dan statistik deteksi yang dihasilkan sistem.',
      'Mengetahui status setiap kamera yang diajukan: menunggu tinjauan, disetujui, atau ditolak.',
    ],
  },
  {
    judul: '3. Kewajiban Mitra',
    ayat: [
      'Mengisi data pendaftaran kamera dengan benar, termasuk nama dan lokasi pemasangan.',
      'Menjaga kamera tetap menyala dan terhubung sepanjang jam operasional yang disepakati.',
      'Menjaga kerahasiaan akun dan ID siaran kamera. Semua tindakan yang dilakukan dari akun Mitra dianggap dilakukan olehnya.',
      'Mematuhi peraturan perundang-undangan yang berlaku, termasuk ketentuan mengenai perekaman di ruang publik.',
    ],
  },
  {
    judul: '4. Perangkat Kamera',
    ayat: [
      'Kamera yang tayangannya ditampilkan di Lautara dibeli dari Platform dan dipasang oleh petugas Platform.',
      'Setiap kamera yang didaftarkan melewati persetujuan admin sebelum tayangannya muncul. Kamera yang tidak dibeli dan dipasang oleh Platform tidak akan disetujui.',
      'Setelah pembayaran lunas, kamera sepenuhnya menjadi hak milik Mitra.',
      'Pembelian dan pemasangan baru dikoordinasikan setelah pengajuan menjadi Mitra disetujui admin. Tidak ada pembayaran apa pun yang diminta sebelum pengajuan diterima.',
      'Rincian perangkat dan harganya disampaikan terpisah sebelum pembelian, mengacu pada daftar yang berlaku saat itu. Mitra berhak membatalkan pembelian sebelum pembayaran dilakukan.',
      'Platform menjamin kamera bebas cacat produksi selama 3 (tiga) bulan sejak tanggal pemasangan. Dalam masa itu komponen yang rusak karena cacat produksi diganti tanpa biaya.',
      'Garansi tidak berlaku atas kerusakan akibat bencana alam, kelalaian, vandalisme, pencurian, sambaran petir, atau modifikasi yang dilakukan sendiri oleh Mitra.',
      'Mitra menyediakan sumber listrik dan koneksi internet yang layak di titik pemasangan, serta memberi akses bagi petugas Platform untuk pemasangan dan perbaikan.',
      'Kamera adalah milik Mitra. Dengan mendaftarkannya, Mitra memberi izin kepada Platform untuk menayangkan gambarnya di halaman publik destinasi selama ia berstatus Mitra.',
      'Bila Mitra berhenti, kamera tetap menjadi miliknya. Platform menghentikan penayangan dan memutus ID siarannya dari sistem.',
    ],
  },
  {
    judul: '5. Isi Tayangan dan Privasi',
    ayat: [
      'Kamera diarahkan ke area publik destinasi. Mitra tidak boleh mengarahkannya ke area privat seperti kamar, kamar mandi, atau ruang ganti.',
      'Mitra memasang pemberitahuan yang terlihat di lokasi bahwa area tersebut dipantau kamera.',
      'Platform dapat menghentikan penayangan sewaktu-waktu bila isi tayangan dinilai melanggar privasi, kesusilaan, atau peraturan yang berlaku.',
    ],
  },
  {
    judul: '6. Biaya',
    ayat: [
      'Saat ini Platform tidak memungut biaya langganan atau biaya penayangan apa pun dari Mitra. Biaya yang ada hanya pembelian perangkat pada Pasal 4.',
      'Bila kemudian Platform memberlakukan biaya, Mitra diberitahu paling lambat 30 (tiga puluh) hari sebelum ketentuan itu berlaku.',
      'Dalam tenggang waktu tersebut Mitra berhak mengakhiri perjanjian ini tanpa penalti.',
    ],
  },
  {
    judul: '7. Tanggung Jawab',
    ayat: [
      'Mitra bertanggung jawab atas pemasangan, keamanan, dan isi tayangan kameranya.',
      'Platform menyediakan layanan penayangan sebagaimana adanya. Platform tidak bertanggung jawab atas gangguan tayangan yang timbul dari listrik, jaringan, atau perangkat di luar kendalinya.',
      'Hasil deteksi otomatis yang ditampilkan sistem bersifat perkiraan dan tidak dijamin akurat.',
    ],
  },
  {
    judul: '8. Penangguhan, Pengakhiran, dan Perubahan',
    ayat: [
      'Platform dapat menangguhkan atau mencabut status Mitra bila terjadi pelanggaran atas perjanjian ini, disertai pemberitahuan.',
      'Mitra dapat mengundurkan diri kapan saja dengan memberitahu admin.',
      'Perubahan perjanjian ditandai dengan kenaikan nomor versi dan diberitahukan kepada Mitra aktif. Persetujuan yang tercatat mengacu pada nomor versi yang berlaku saat pengajuan dikirim.',
    ],
  },
];

export default function SyaratMitra() {
  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-24 md:pb-0">
      <TopNav compact />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-serif text-3xl font-medium text-navy">
          Perjanjian Mitra
        </h1>
        <p className="mt-2 text-2xs text-navy-soft">
          Versi {AGREEMENT.mitra.version} · Berlaku sejak {BERLAKU_SEJAK}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-navy-soft">
          Baca sebelum mengajukan diri jadi mitra kamera. Dua hal yang paling
          perlu kamu tahu: kamera yang tayang di Lautara kamu beli dari Lautara
          dan dipasang petugas Lautara, dan setiap kamera ditinjau admin dulu
          sebelum tayangannya muncul.
        </p>

        <div className="mt-10 space-y-8">
          {PASAL.map((p) => (
            <section key={p.judul}>
              <h2 className="font-serif text-lg font-medium text-navy">
                {p.judul}
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                {p.ayat.map((a, i) => (
                  <li key={i} className="text-sm leading-relaxed text-navy-soft">
                    {a}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
      <Footer />
      <BottomNav />
    </main>
  );
}
