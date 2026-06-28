import type { Metadata, Viewport } from "next";
import { Orbitron, Rajdhani } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARMADA — Naval Sci-Fi Battleship",
  description:
    "ARMADA: a cinematic single-player Battleship game. Holographic grids, neon HUD, three AI difficulties. Sink the enemy fleet.",
  applicationName: "ARMADA",
  openGraph: {
    title: "ARMADA — Naval Sci-Fi Battleship",
    description:
      "Holographic grids, neon HUD, juicy FX. Outwit three tiers of AI and sink the enemy fleet.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#02040c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${orbitron.variable} ${rajdhani.variable}`}>
      <body>
        <div className="app-bg" aria-hidden />
        {children}
      </body>
    </html>
  );
}
