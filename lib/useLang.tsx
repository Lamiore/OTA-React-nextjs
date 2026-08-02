'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dateLocale, t as translate, type Lang } from '@/lib/i18n';

interface LangValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  /** Terjemahan dalam bahasa yang aktif. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Locale Intl yang cocok dengan bahasa aktif, untuk toLocaleDateString dkk. */
  locale: string;
  /** false sampai pilihan tersimpan terbaca — dipakai untuk menahan kedip. */
  mounted: boolean;
}

const LangContext = createContext<LangValue | null>(null);

/**
 * Bahasa antarmuka, dibagi ke seluruh pohon komponen. Beda dengan useTheme yang
 * cukup menempel kelas di <html>: ganti bahasa harus me-render ulang setiap
 * komponen yang menampilkan teks, jadi butuh context, bukan hook mandiri.
 *
 * ponytail: pilihan bahasa dibaca di klien setelah mount, jadi pengguna yang
 * memilih English melihat satu render Indonesia dulu. Kalau kedipnya mengganggu,
 * pindahkan penyimpanannya ke cookie dan baca di app/layout.tsx — biayanya
 * seluruh halaman jadi dynamic render.
 */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('id');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lang');
      if (stored === 'en' || stored === 'id') setLangState(stored);
    } catch {
      // localStorage tidak tersedia (mode privat) — pakai bahasa bawaan
    }
    setMounted(true);
  }, []);

  // Selaraskan atribut lang <html>: pembaca layar dan terjemahan otomatis
  // browser membacanya, dan nilainya keliru kalau tidak ikut berubah.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem('lang', next);
    } catch {
      // sama seperti di atas — pilihannya tetap berlaku untuk sesi ini
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, lang, vars),
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t, locale: dateLocale(lang), mounted }}>
      {children}
    </LangContext.Provider>
  );
}

/**
 * Bahasa aktif beserta penerjemahnya. Di luar LangProvider hook ini jatuh ke
 * bahasa Indonesia alih-alih melempar error, supaya komponen yang dipakai
 * sendirian (mis. di halaman error) tidak ikut mati.
 */
export function useLang(): LangValue {
  const ctx = useContext(LangContext);
  if (ctx) return ctx;
  return {
    lang: 'id',
    setLang: () => {},
    t: (key, vars) => translate(key, 'id', vars),
    locale: dateLocale('id'),
    mounted: false,
  };
}
