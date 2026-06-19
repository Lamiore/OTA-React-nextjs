/** Format angka ke Rupiah tanpa desimal, mis. 150000 → "Rp 150.000". */
export function formatIDR(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}
