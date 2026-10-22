import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Manrope } from "next/font/google";
import "./globals.css";
import { brand } from "@/lib/brand";
import { SITE_URL, SITE_NAME, defaultTitle, defaultDesc, keywords } from "@/lib/seo";
import { getListings, getMarkets } from "@/lib/data/listings";
import { liveCities } from "@/lib/geo";
import { MetaPixel } from "@/components/MetaPixel";
import { ChatDock } from "@/components/chat/ChatDock";
import { Suspense } from "react";

// Two families, two jobs (BUILD_REFERENCE "Typography"). Instrument Sans says
// things — headlines and reading — and is loaded with its WIDTH axis, because
// the headlines sit at 82–88% (`headline`, `stretch-*` in globals.css).
// Manrope gives facts: every price, date, count and small-caps label.
const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  axes: ["wdth"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Every property photo comes from Supabase storage — warm the connection before
// the first hero/gallery image request.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
})();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0b", // Esker black — matches the hero, the footer and PWA chrome
};

// Site-wide metadata derives from the cities that actually have LIVE listings
// (cached reads — near-free), so launching a market updates every title with
// zero deploys. Falls back to the static brand copy if the reads ever fail.
export async function generateMetadata(): Promise<Metadata> {
  const cities = await getListings()
    .then(async (listings) => liveCities(listings, await getMarkets()))
    .catch(() => [] as string[]);
  const title = defaultTitle(cities.length ? cities : undefined);
  const description = defaultDesc(cities.length ? cities : undefined);
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s · ${brand.name}`,
    },
    description,
    keywords: keywords(cities.length ? cities : undefined),
    applicationName: SITE_NAME,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_PK",
      url: SITE_URL,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrument.variable} ${manrope.variable} h-full`}>
      <head>{SUPABASE_ORIGIN && <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />}</head>
      <body className="min-h-full">
        <MetaPixel />
        {children}
        {/* Floating guest chat — streams in after the page so it never blocks paint. */}
        <Suspense fallback={null}>
          <ChatDock />
        </Suspense>
      </body>
    </html>
  );
}
