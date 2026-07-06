// Read-only fractional star display (e.g. 4.75 shows four full + a three-quarter
// star). Same star path as the interactive input so they match visually. Uses a
// clipped gold layer over an empty base.
export function StarsDisplay({ value, size = 14 }: { value: number; size?: number }) {
  const pct = (Math.min(5, Math.max(0, value)) / 5) * 100;
  return (
    <span className="relative inline-flex" aria-label={`${value} out of 5`}>
      <Row size={size} className="text-line-hi" />
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <Row size={size} className="text-gold" filled />
      </span>
    </span>
  );
}

function Row({ size, className, filled }: { size: number; className: string; filled?: boolean }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className="shrink-0" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
          <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.4l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" />
        </svg>
      ))}
    </span>
  );
}
