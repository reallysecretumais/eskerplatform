// Esker Rentals wordmark — a clean, modern type lockup: "ESKER" with "RENTALS"
// set beneath it. Real text (always crisp + legible), monochrome via
// `currentColor` so it inherits white on dark sections and ink on light ones.
export function EskerLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col leading-none ${className}`} aria-label="Esker Rentals">
      <span className="font-display font-semibold" style={{ fontSize: "1.3rem", letterSpacing: "0.08em" }}>
        ESKER
      </span>
      <span className="font-display font-medium" style={{ fontSize: "0.66rem", letterSpacing: "0.3em", marginTop: "3px", opacity: 0.72 }}>
        RENTALS
      </span>
    </span>
  );
}
