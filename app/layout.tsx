import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { brand } from "@/lib/brand";

// Clean sans for UI (Inter) + a modern, minimal display face (Sora) for the
// brand wordmark and headings.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const display = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${brand.name} — premium short stays`,
  description: brand.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
