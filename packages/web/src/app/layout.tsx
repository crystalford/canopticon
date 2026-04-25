import "./globals.css";
import type { Metadata } from "next";
import { EB_Garamond, JetBrains_Mono } from "next/font/google";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CANOPTICON",
  description: "Forensic intelligence platform for Canadian political and economic structure.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ebGaramond.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
