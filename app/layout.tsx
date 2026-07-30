import type { Metadata, Viewport } from "next";
import { Figtree, Cormorant } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/chat/ChatWidget";

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
  title: "Lautara — Dive Into Adventure",
  description:
    "Platform OTA untuk destinasi selam terbaik di Indonesia Utara",
  // iOS mengabaikan display:standalone di manifest — ini padanannya.
  appleWebApp: { capable: true, title: "Lautara", statusBarStyle: "default" },
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
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
