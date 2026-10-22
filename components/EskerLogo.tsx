// Esker Rentals wordmark — the website's type lockup: "ESKER" with "RENTALS"
// set wide beneath it. Real text (always crisp, legible, selectable), in Sora
// (`font-wordmark`, loaded for this alone in app/layout.tsx), monochrome via
// `currentColor` so it is warm white on the hero and footer and black on
// light pages.
//
// The founder chose this over the canvas's framed SVG lockup for the website
// (2026-10-22). The guest app keeps the framed lockup and E-mark.

const SIZES = {
  nav: { word: "1.3rem", sub: "0.66rem", gap: "3px" },
  footer: { word: "1.6rem", sub: "0.8rem", gap: "4px" },
} as const;

export function EskerLogo({ size = "nav", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex flex-col font-wordmark leading-none ${className}`} aria-label="Esker Rentals" role="img">
      <span className="font-semibold" style={{ fontSize: s.word, letterSpacing: "0.08em" }} aria-hidden>
        ESKER
      </span>
      <span className="font-medium" style={{ fontSize: s.sub, letterSpacing: "0.3em", marginTop: s.gap, opacity: 0.72 }} aria-hidden>
        RENTALS
      </span>
    </span>
  );
}
