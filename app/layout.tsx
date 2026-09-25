import type { Metadata } from "next";
import { Geist_Mono, Outfit, Work_Sans } from "next/font/google";
import { AppHeader } from "./_components/app-header";
import { Providers } from "./providers";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_ORIGIN ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
  ),
  title: "Carhaus — Viajes privados a tu medida",
  description:
    "Reservá tu viaje privado con Carhaus: elegí snacks, tu playlist y la temperatura del aire. Sin comisiones de intermediarios.",
  openGraph: {
    title: "Carhaus — Viajes privados a tu medida",
    description:
      "Reservá tu viaje privado con Carhaus: elegí snacks, tu playlist y la temperatura del aire.",
    images: ["/logo-header.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${workSans.variable} ${outfit.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <header className="mx-auto w-full max-w-2xl px-6 pt-6">
            <AppHeader />
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
