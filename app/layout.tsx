import type { Metadata, Viewport } from "next";
import { Figtree, Cormorant } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/chat/ChatWidget";
import { LangProvider } from "@/lib/useLang";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nusa — Dive Into Adventure",
  description:
    "Platform OTA untuk destinasi selam dan pesisir — cari, pesan, dan pantau kondisi perairan secara langsung.",
  // iOS mengabaikan display:standalone di manifest — ini padanannya.
  appleWebApp: { capable: true, title: "Nusa", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1B8A8F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to avoid a flash. Default is
            light — the OS preference is deliberately ignored; dark only when
            the visitor picked it in Pengaturan. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
        {/* Samakan atribut lang <html> dengan pilihan tersimpan sebelum paint.
            Teksnya sendiri baru berganti setelah LangProvider mount — ini hanya
            menjaga agar pembaca layar tidak salah menyebut bahasa halaman. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('lang');if(l==='en'||l==='id'){document.documentElement.lang=l;}}catch(e){}})();`,
          }}
        />
        {/* Service worker hanya di produksi — di dev shell yang ter-cache
            menutupi hasil edit dan bikin HMR terlihat rusak. */}
        {process.env.NODE_ENV === "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`,
            }}
          />
        )}
      </head>
      <body
        className={`${figtree.variable} ${cormorant.variable} font-sans antialiased`}
      >
        <LangProvider>
          {children}
          <ChatWidget />
        </LangProvider>
      </body>
    </html>
  );
}
