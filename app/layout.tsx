import type { Metadata } from "next";
import { Geist_Mono, Outfit, Work_Sans } from "next/font/google";
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
  title: "Carhaus — Viajes privados a tu medida",
  description:
    "Reservá tu viaje privado con Carhaus: elegí snacks, tu playlist y la temperatura del aire. Sin comisiones de intermediarios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${workSans.variable} ${outfit.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
