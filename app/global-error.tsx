'use client';

/**
 * Lapis terakhir: error yang terjadi di layout root itu sendiri — termasuk di
 * LangProvider — tidak pernah sampai ke app/error.tsx, karena yang gagal justru
 * pembungkusnya.
 *
 * Karena ia MENGGANTIKAN layout root, file ini wajib membawa <html> dan <body>
 * sendiri. Tidak ada font, tidak ada provider, dan gayanya ditulis inline: pada
 * titik ini globals.css pun belum tentu terpasang, jadi kelas Tailwind belum
 * tentu berarti apa-apa.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          textAlign: 'center',
          background: '#f4f8f9',
          color: '#0f2f3d',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500 }}>Aplikasi gagal dimuat</h1>
        <p style={{ maxWidth: '24rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#3f5a66' }}>
          Terjadi kesalahan di luar dugaan. Muat ulang halaman; kalau tetap
          begini, hubungi admin dengan menyertakan kode di bawah.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            border: 0,
            borderRadius: '9999px',
            background: '#0d9488',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Muat ulang
        </button>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#7a8b93' }}>
            Kode: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
