import type { Metadata } from 'next';
import TopNav from '@/components/desktop/TopNav';
import Footer from '@/components/desktop/Footer';
import BottomNav from '@/components/mobile/BottomNav';
import { AGREEMENT } from '@/lib/verification';

export const metadata: Metadata = {
  title: 'Perjanjian Pengelola — Lautara',
  description:
    'Hak, kewajiban, dan ketentuan paket pemantauan bagi pengelola destinasi Lautara.',
};

/** Tanggal berlaku v1.0. Ditulis di sini karena hanya dipakai di halaman ini. */
const BERLAKU_SEJAK = '30 Juli 2026';

const PASAL: { judul: string; ayat: string[] }[] = [
  {
    judul: '1. Ruang Lingkup',
    ayat: [
      'Perjanjian ini mengatur hubungan antara Lautara ("Platform") dan pengguna yang disetujui menjadi pengelola destinasi ("Pengelola").',
      'Destinasi yang dikelola ditetapkan oleh admin Platform. Pilihan destinasi pada formulir pengajuan bersifat usulan, bukan penetapan.',
      'Perjanjian ini bukan perjanjian kerja. Pengelola bukan karyawan Platform, tidak menerima upah, dan tidak memperoleh hak ketenagakerjaan dari Platform.',
    ],
  },
  {
    judul: '2. Hak Pengelola',
    ayat: [
      'Mengubah data destinasi yang dikelolanya: deskripsi, foto, titik lokasi, daftar harga, dan kontak WhatsApp.',
      'Melihat dan mengonfirmasi pesanan yang masuk ke destinasinya.',
      'Mendaftarkan kamera pemantau dan melihat streamnya.',
      'Mengakses statistik kunjungan dan bacaan sensor destinasinya melalui Dashboard.',
    ],
  },
  {
    judul: '3. Kewajiban Pengelola',
    ayat: [
      'Menjaga keakuratan data destinasi, terutama harga, ketersediaan, dan jam operasional. Data yang keliru merugikan pengunjung dan menjadi tanggung jawab Pengelola.',
      'Merespons pesanan yang masuk dalam waktu yang wajar.',
      'Menjaga kerahasiaan akun. Semua tindakan yang dilakukan dari akun Pengelola dianggap dilakukan olehnya.',
      'Mematuhi peraturan perundang-undangan yang berlaku serta menjaga keselamatan pengunjung di destinasinya.',
    ],
  },
  {
    judul: '4. Paket Pemantauan IoT',
    ayat: [
      'Destinasi yang dikelola wajib dilengkapi paket sensor pemantauan. Ini satu-satunya perangkat yang diwajibkan bagi Pengelola.',
      'Paket sensor dibeli dari Platform dan dipasang oleh petugas Platform. Perangkat sejenis yang dibeli atau dipasang sendiri tidak dihubungkan ke sistem Lautara.',
      'Setelah pembayaran lunas, paket sensor sepenuhnya menjadi hak milik Pengelola.',
      'Pembelian dan pemasangan baru dikoordinasikan setelah pengajuan menjadi Pengelola disetujui admin. Tidak ada pembayaran apa pun yang diminta sebelum pengajuan diterima.',
      'Rincian isi paket dan harganya disampaikan terpisah sebelum pembelian, mengacu pada daftar yang berlaku saat itu. Pengelola berhak membatalkan pembelian sebelum pembayaran dilakukan; dalam hal itu status Pengelola tidak dapat diaktifkan karena ayat 1 tidak terpenuhi.',
      'Platform menjamin paket bebas cacat produksi selama 3 (tiga) bulan sejak tanggal pemasangan. Dalam masa itu komponen yang rusak karena cacat produksi diganti tanpa biaya.',
      'Garansi tidak berlaku atas kerusakan akibat bencana alam, kelalaian, vandalisme, pencurian, sambaran petir, atau modifikasi yang dilakukan sendiri oleh Pengelola.',
      'Pengelola menyediakan sumber listrik dan koneksi internet yang layak di titik pemasangan, serta memberi akses bagi petugas Platform untuk pemasangan dan perbaikan.',
      'Alat adalah milik Pengelola. Dengan memasangnya, Pengelola memberi izin kepada Platform untuk menampilkan bacaan sensornya di halaman publik destinasi selama ia menjabat sebagai Pengelola.',
      'Bila Pengelola berhenti, alat tetap menjadi miliknya. Platform menghentikan penayangan datanya dan memutus keterkaitan alat dengan destinasi di dalam sistem.',
    ],
  },
  {
    judul: '5. Kamera Pemantau (Tidak Wajib)',
    ayat: [
      'Kamera pemantau di destinasi bersifat dianjurkan, bukan kewajiban. Status Pengelola tidak bergantung pada ada atau tidaknya kamera.',
      'Bila Pengelola memasang kamera untuk ditayangkan di Lautara, kamera tersebut dibeli dari Platform dan dipasang oleh petugas Platform.',
      'Setiap kamera yang didaftarkan melewati persetujuan admin sebelum tayang. Kamera yang tidak dibeli dan dipasang oleh Platform tidak akan disetujui.',
      'Ketentuan kepemilikan, garansi, prasyarat listrik dan internet, serta pengakhiran pada Pasal 4 berlaku sama bagi kamera.',
      'Tanpa kamera, halaman destinasi tetap tayang seperti biasa; hanya blok tayangan langsung yang tidak muncul.',
    ],
  },
  {
    judul: '6. Pesanan dan Pembayaran',
    ayat: [
      'Pembayaran atas tiket, penginapan, sewa alat, dan layanan lain di destinasi dilakukan pengunjung langsung kepada Pengelola, di luar Platform.',
      'Platform hanya mencatat pesanan dan menerbitkan tiket elektronik. Platform tidak menerima, menyimpan, maupun menyalurkan dana pengunjung.',
      'Platform bukan pihak dalam transaksi antara pengunjung dan Pengelola. Sengketa mengenai layanan, harga, pengembalian dana, atau pembatalan diselesaikan antara pengunjung dan Pengelola.',
    ],
  },
  {
    judul: '7. Bagi Hasil',
    ayat: [
      'Saat ini Platform tidak memungut potongan, komisi, atau biaya apa pun atas pendapatan destinasi.',
      'Bila kemudian Platform memberlakukan potongan, Pengelola diberitahu paling lambat 30 (tiga puluh) hari sebelum ketentuan itu berlaku.',
      'Dalam tenggang waktu tersebut Pengelola berhak mengakhiri perjanjian ini tanpa penalti.',
    ],
  },
  {
    judul: '8. Tanggung Jawab',
    ayat: [
      'Pengelola bertanggung jawab penuh atas layanan, fasilitas, dan keselamatan pengunjung di destinasi yang dikelolanya.',
      'Platform menyediakan layanan pencatatan dan penayangan informasi sebagaimana adanya. Platform tidak bertanggung jawab atas kerugian yang timbul dari layanan di destinasi, kekeliruan data yang diisi Pengelola, maupun gangguan jaringan atau perangkat di luar kendalinya.',
    ],
  },
  {
    judul: '9. Data Pribadi Pengunjung',
    ayat: [
      'Data pengunjung yang terlihat di Dashboard hanya boleh digunakan untuk keperluan pesanan yang bersangkutan.',
      'Pengelola dilarang menyalin, menyebarkan, atau memakai data tersebut untuk tujuan lain, termasuk pemasaran, tanpa persetujuan pengunjung.',
    ],
  },
  {
    judul: '10. Penangguhan, Pengakhiran, dan Perubahan',
    ayat: [
      'Platform dapat menangguhkan atau mencabut status Pengelola bila terjadi pelanggaran atas perjanjian ini, disertai pemberitahuan.',
      'Pengelola dapat mengundurkan diri kapan saja dengan memberitahu admin.',
      'Perubahan perjanjian ditandai dengan kenaikan nomor versi dan diberitahukan kepada Pengelola aktif. Persetujuan yang tercatat mengacu pada nomor versi yang berlaku saat pengajuan dikirim.',
    ],
  },
];

export default function SyaratPengelola() {
  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-24 md:pb-0">
      <TopNav compact />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-serif text-3xl font-medium text-navy">
          Perjanjian Pengelola
        </h1>
        <p className="mt-2 text-2xs text-navy-soft">
          Versi {AGREEMENT.pengelola.version} · Berlaku sejak {BERLAKU_SEJAK}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-navy-soft">
          Baca sebelum mengajukan diri jadi pengelola. Tiga hal yang paling perlu
          kamu tahu: paket sensor untuk destinasimu wajib dan kamu beli dari
          Lautara, kamera pemantau dianjurkan tapi tidak wajib, dan pembayaran
          dari pengunjung kamu terima langsung — bukan lewat Lautara.
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
