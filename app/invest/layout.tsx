import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import "./invest.css";

// Instrument Serif for headlines; Manrope for body and EVERY number
// (Instrument Serif's "1" reads like a lowercase "l").
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--f-serif", display: "swap" });
const sans = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-sans", display: "swap" });

// Private: never indexed, never in the sitemap or nav. The link preview (WhatsApp)
// still reads well, because investors receive it as a message.
export const metadata: Metadata = {
  title: { absolute: "Invest with Esker" },
  description: "You fund the setup. Esker finds, furnishes and runs the apartment. Live in 30 days, and you get 70% of the net profit every month.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
  openGraph: {
    title: "Invest with Esker",
    description: "Earn from Islamabad's short-stay market, without buying property. See your own projected returns.",
  },
};

export const viewport: Viewport = { themeColor: "#16211B" };

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`inv ${serif.variable} ${sans.variable}`}>
      {/* Reveal-on-scroll starts hidden; without JavaScript nothing would ever
          reveal it, so this puts every section straight back on screen. */}
      <noscript>
        <style>{".inv .rv,.inv .sentence .w{opacity:1!important;transform:none!important}.inv .step-arch path{stroke-dashoffset:0!important}"}</style>
      </noscript>
      {children}
    </div>
  );
}
