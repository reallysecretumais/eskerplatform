import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

// Branded social-share card for the homepage (and any route without its own
// OG image). Property pages override this with their real photo.
export const alt = `${brand.name} — premium short stays in ${brand.launchCities.join(" & ")}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          color: "#fff",
          fontFamily: "sans-serif",
          backgroundColor: "#0c0a07",
          backgroundImage: "linear-gradient(135deg, #1a1712 0%, #0c0a07 60%, #060504 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "14px", height: "14px", borderRadius: "9999px", backgroundColor: "#c9a84c" }} />
          <div style={{ fontSize: "28px", letterSpacing: "8px", color: "#c9a84c" }}>AI CONCIERGE</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "128px", fontWeight: 700, lineHeight: 1 }}>{brand.name}</div>
          <div style={{ fontSize: "40px", color: "rgba(255,255,255,0.85)", marginTop: "22px" }}>
            Premium short stays, beautifully managed.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "28px", color: "rgba(255,255,255,0.7)" }}>
          <div style={{ display: "flex" }}>{brand.launchCities.join("  ·  ")}</div>
          <div style={{ display: "flex" }}>eskerrentals.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
