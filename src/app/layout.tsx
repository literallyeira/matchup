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
      <body className="antialiased min-h-screen pb-20">
        <Providers>
          <div className="w-full">
            {children}
          </div>

          {/* Global Footer */}
          <footer className="fixed bottom-0 left-0 w-full py-4 px-6 border-t border-white/5 bg-[#0c0c0c]/95 backdrop-blur-sm z-50">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
              {/* Logo */}
              <a href="https://forum-tr.gta.world" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                <img
                  src="https://forum-tr.gta.world/uploads/monthly_2025_02/logo.png.3fe10156c1213bdb8f59cd9bc9e15781.png"
                  alt="GTA World TR"
                  className="h-6 opacity-70"
                />
              </a>

              {/* Links */}
              <div className="flex items-center gap-8">
                <a
                  href="https://discord.gg/gtaworldtr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-500 hover:text-[#5865F2] transition-colors"
                >
                  <i className="fa-brands fa-discord text-lg"></i>
                  <span>Discord</span>
                </a>
                <a
                  href="https://facebrowser-tr.gta.world"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-500 hover:text-pink-500 transition-colors"
                >
                  <i className="fa-solid fa-globe text-lg"></i>
                  <span>Facebrowser</span>
                </a>
              </div>

              {/* Copyright & Powered By */}
              <div className="flex flex-col md:flex-row items-center gap-1 md:gap-4 text-gray-600">
                <p>© 2026 MatchUp</p>
                <div className="hidden md:block w-1 h-1 bg-gray-800 rounded-full"></div>
                <p>
                  <span>powered by </span>
                  <span className="text-white font-medium" style={{ textShadow: '0 0 5px rgba(255,255,255,0.3), 0 0 10px rgba(255,255,255,0.1)' }}>eira</span>
                </p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
