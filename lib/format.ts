/** Format angka ke Rupiah tanpa desimal, mis. 150000 → "Rp 150.000". */
export function formatIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

/**
 * Baca koordinat dari teks yang disalin Google Maps ("1.4508, 125.0917") —
 * klik kanan di peta lalu klik koordinatnya menyalin persis format ini.
 * null bila kosong, formatnya lain, atau di luar rentang lat/lng yang sah.
 */
export function parseCoords(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Tautan wa.me dari nomor Indonesia yang ditulis bebas ("0812…", "+62 812…",
 * "62812…"). null bila nomornya terlalu pendek untuk masuk akal, supaya
 * pemanggil bisa menyembunyikan tombolnya alih-alih membuka chat yang gagal.
 */
export function waLink(phone: string, text?: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  const intl = digits.startsWith('62')
    ? digits
    : digits.startsWith('0')
      ? `62${digits.slice(1)}`
      : `62${digits}`;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
