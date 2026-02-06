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
      <body className="antialiased min-h-screen flex flex-col">
        <Providers>
          <div className="flex-1">
            {children}
          </div>

          {/* Global Footer */}
          <footer className="py-8 px-4 border-t border-white/10 mt-auto">
            <div className="max-w-lg mx-auto flex flex-col items-center gap-6">
              {/* GTAW Logo */}
              <a href="https://forum-tr.gta.world" target="_blank" rel="noopener noreferrer">
                <img
                  src="https://forum-tr.gta.world/uploads/monthly_2025_02/logo.png.3fe10156c1213bdb8f59cd9bc9e15781.png"
                  alt="GTA World TR"
                  className="h-10 opacity-70 hover:opacity-100 transition-opacity"
                />
              </a>

              {/* Social Links */}
              <div className="flex items-center gap-6">
                <a
                  href="https://discord.gg/gtaw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-[#5865F2] transition-colors"
                >
                  <i className="fa-brands fa-discord text-2xl"></i>
                  <span className="text-sm">Discord</span>
                </a>
                <a
                  href="https://facebrowser-tr.gta.world"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-pink-500 transition-colors"
                >
                  <i className="fa-solid fa-globe text-2xl"></i>
                  <span className="text-sm">Facebrowser</span>
                </a>
              </div>

              <p className="text-gray-500 text-xs text-center">
                © 2026 MatchUp - GTA World TR
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
