import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { brand } from "@/lib/brand";
import { SITE_URL, SITE_NAME, defaultTitle, defaultDesc, keywords } from "@/lib/seo";
import { getListings, getMarkets } from "@/lib/data/listings";
import { liveCities } from "@/lib/geo";
import { MetaPixel } from "@/components/MetaPixel";
import { ChatDock } from "@/components/chat/ChatDock";
import { Suspense } from "react";

// Clean sans for UI (Inter) + a modern, minimal display face (Sora) for the
// brand wordmark and headings. (Sora 400 is unused — only 500/600/700 ship.)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const display = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["500", "600", "700"],
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
  themeColor: "#0c0a07", // Esker near-black — matches the hero + PWA chrome
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
    <html lang="en" className={`${inter.variable} ${display.variable} h-full`}>
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
