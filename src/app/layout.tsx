import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/** Sustitutos abiertos de BinanceNova / BinancePlex */
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexDisplay = IBM_Plex_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Rifacil — Talonario digital para rifas",
    template: "%s · Rifacil",
  },
  description:
    "Crea rifas, gestiona boletos, recibe comprobantes de pago y sortea ganadores con transparencia.",
  icons: {
    icon: "/rifacil-logo.jpeg",
    apple: "/rifacil-logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${plexSans.variable} ${plexDisplay.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  );
}
