'use client';

import { useEffect, useState } from 'react';
import { subscribeDestinations, distinctLocations } from './firestore';

/**
 * Daftar wilayah unik dari koleksi destinasi — sumber tunggal chip filter dan
 * dropdown lokasi.
 *
 * Dulu tiga komponen (HeroBanner, DesktopDestinationGrid, FilterChips) masing-
 * masing menuliskan ['Bunaken', 'Likupang', 'Lembeh'] sendiri, jadi wilayah baru
 * harus ditambahkan di tiga tempat dan sempat tidak sinkron antara desktop dan
 * mobile.
 *
 * Sengaja berlangganan seluruh koleksi, bukan memakai state destinasi milik
 * komponen: grid & list memuat ulang dengan where('location','==',filter) saat
 * chip aktif, jadi daftar wilayah yang diturunkan dari sana akan menyusut jadi
 * satu begitu chip pertama diklik.
 */
export function useLocations(): string[] {
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(
    () => subscribeDestinations((d) => setLocations(distinctLocations(d))),
    []
  );

  return locations;
}
