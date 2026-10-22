import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { getListings, getMarkets } from "@/lib/data/listings";
import { liveCities } from "@/lib/geo";

// Branded social-share card for the homepage (and any route without its own
// OG image). Property pages override this with their real photo.
export const alt = `${brand.name} — premium short stays in ${brand.launchCities.join(" & ")}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Esker Blue palette as literal hexes — this renders outside the CSS, so the
// tokens in app/globals.css can't reach it. Keep in step with those.
const INK = "#0B0B0B"; // black
const WARM = "#F4F3EF"; // warm white
const BRAND = "#2638A8"; // Esker Blue
const ICE = "#D0D8FF"; // the one accent
const ASH = "#9C9B96"; // secondary text on black

export default async function OpengraphImage() {
  // Cities line from the LIVE listings (launch-cities fallback) — the share
  // card learns a new market with its first published listing.
  const cities = await getListings()
    .then(async (listings) => liveCities(listings, await getMarkets()))
    .catch(() => [] as string[]);
  const citiesLine = (cities.length ? cities : [...brand.launchCities]).join("  ·  ");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: WARM,
          fontFamily: "sans-serif",
          backgroundColor: INK,
        }}
      >
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "14px 28px",
              borderRadius: "9999px",
              backgroundColor: BRAND,
              fontSize: "26px",
              letterSpacing: "5px",
              color: WARM,
            }}
          >
            <div style={{ width: "12px", height: "12px", borderRadius: "9999px", backgroundColor: ICE }} />
            AI CONCIERGE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "128px", fontWeight: 700, lineHeight: 1 }}>{brand.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: "40px", marginTop: "22px" }}>
            <span>Premium short stays,</span>
            <span style={{ color: ICE, marginLeft: "12px" }}>beautifully managed.</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "28px", color: ASH }}>
          <div style={{ display: "flex" }}>{citiesLine}</div>
          <div style={{ display: "flex" }}>eskerrentals.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
