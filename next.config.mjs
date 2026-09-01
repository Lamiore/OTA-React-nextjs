/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Hero dan gambar destinasi berasal dari host luar. Didaftarkan di sini supaya
    // next/image boleh mengoptimasinya (resize + WebP/AVIF) alih-alih meneruskan
    // berkas asli — hero Wikimedia aslinya 7,2 MB, dan itu yang bikin LCP beranda
    // 7,9 s. Ditulis eksplisit per host, bukan wildcard '**': wildcard menjadikan
    // situs ini proksi gambar terbuka untuk siapa pun.
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
    ],
  },
};

export default nextConfig;
