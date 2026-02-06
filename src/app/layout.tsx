import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MatchUp",
  description: "MatchUp ile hayatının aşkını bul! Hemen başvur, eşleş ve tanış.",
  keywords: "çöpçatanlık, eşleşme, tanışma, aşk, matchup",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "MatchUp",
    description: "MatchUp ile hayatının aşkını bul!",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </head>
      <body className="antialiased min-h-screen pb-40">
        <Providers>
          <div className="w-full">
            {children}
          </div>

          {/* Global Footer */}
          <footer className="fixed bottom-0 left-0 w-full py-6 px-4 border-t border-white/10 bg-[#0c0c0c] z-50">
            <div className="max-w-lg mx-auto flex flex-col items-center gap-4">
              {/* GTAW Logo */}
              <a href="https://forum-tr.gta.world" target="_blank" rel="noopener noreferrer">
                <img
                  src="https://forum-tr.gta.world/uploads/monthly_2025_02/logo.png.3fe10156c1213bdb8f59cd9bc9e15781.png"
                  alt="GTA World TR"
                  className="h-8 opacity-70 hover:opacity-100 transition-opacity"
                />
              </a>

              {/* Social Links */}
              <div className="flex items-center gap-6">
                <a
                  href="https://discord.gg/gtaworldtr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-[#5865F2] transition-colors"
                >
                  <i className="fa-brands fa-discord text-xl"></i>
                  <span className="text-xs">Discord</span>
                </a>
                <a
                  href="https://facebrowser-tr.gta.world"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-pink-500 transition-colors"
                >
                  <i className="fa-solid fa-globe text-xl"></i>
                  <span className="text-xs">Facebrowser</span>
                </a>
              </div>

              {/* Copyright and Powered by */}
              <div className="flex flex-col items-center gap-1">
                <p className="text-gray-500 text-xs">
                  © 2026 MatchUp - GTA World TR
                </p>
                <p className="text-xs">
                  <span className="text-gray-500">powered by </span>
                  <span className="text-white font-semibold" style={{ textShadow: '0 0 5px rgba(255,255,255,0.5), 0 0 10px rgba(255,255,255,0.3)' }}>eira</span>
                </p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
