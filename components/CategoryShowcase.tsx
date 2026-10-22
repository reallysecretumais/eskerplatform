import Link from "next/link";
import type { ReactNode } from "react";
import { normalizeCategory } from "@/lib/listings";

// "Browse by category" from the Website board: four quiet tiles, an Esker Blue
// line icon over the name and a live count.
//
// The four the board draws (the app's four type tiles) always show. A tile only
// becomes a LINK once that category actually has stays — otherwise it stays in
// place, inert, and says "Coming soon" (BUILD_REFERENCE "City with no stays
// yet": keep the tile, don't hide it). Any OTHER category that goes live
// (content spaces, pools…) joins the row by itself. `counts` comes from
// lib/listings.ts categoryCounts over the cached listings, so publishing the
// first villa in the CRM flips its tile live on the next cache bust.

const icon = (paths: ReactNode) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-brand">
    {paths}
  </svg>
);

// Icon paths are the board's own.
const BOARD: { name: string; icon: ReactNode }[] = [
  { name: "Apartments", icon: icon(<><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" /></>) },
  { name: "Penthouses", icon: icon(<><path d="M3 21h18M6 21V9l6-5 6 5v12" /><path d="M10 21v-5h4v5" /></>) },
  { name: "Villas", icon: icon(<path d="M2 12 12 4l10 8M5 10v10h14V10" />) },
  { name: "Farmhouses", icon: icon(<><path d="M12 21v-6M7 15h10l-5-11Z" /><path d="M3 21h18" /></>) },
];

// Categories the board doesn't draw, for the day they have stock.
const EXTRA: Record<string, { name: string; icon: ReactNode }> = {
  "content space": { name: "Content Spaces", icon: icon(<><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8 7l1.5-3h5L16 7" /></>) },
  "swimming pool": { name: "Swimming Pools", icon: icon(<path d="M2 12c2 0 2-1.5 4-1.5S8 12 10 12s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 17c2 0 2-1.5 4-1.5S8 17 10 17s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M8 9V5a2 2 0 0 1 4 0M14 9V5a2 2 0 0 1 4 0" />) },
};

const tile = "flex h-[150px] min-w-0 flex-col justify-between rounded-[24px] bg-surface-2 p-[18px] sm:p-[22px]";

export function CategoryShowcase({ counts = {} }: { counts?: Record<string, number> }) {
  const shown = new Set(BOARD.map((c) => normalizeCategory(c.name)));
  const extras = Object.entries(counts)
    .filter(([key, n]) => n > 0 && !shown.has(key))
    .map(([key]) => EXTRA[key] ?? { name: key.replace(/\b\w/g, (c) => c.toUpperCase()), icon: BOARD[0].icon });

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {[...BOARD, ...extras].map(({ name, icon }) => {
        const count = counts[normalizeCategory(name)] ?? 0;
        const label = (
          <span className="flex flex-col gap-0.5">
            <span className="text-xl font-bold leading-tight stretch-88">{name}</span>
            {count > 0 ? (
              <span className="text-sm text-dim">
                <span className="tnum">{count}</span> {count === 1 ? "stay" : "stays"}
              </span>
            ) : (
              <span className="text-sm text-dim">Coming soon</span>
            )}
          </span>
        );

        // No stock yet — the tile stays, deliberately NOT a link.
        if (count === 0) {
          return (
            <div key={name} aria-disabled="true" className={`${tile} text-muted [&_svg]:opacity-50`}>
              {icon}
              {label}
            </div>
          );
        }
        return (
          <Link
            key={name}
            href={`/stays?category=${encodeURIComponent(name)}`}
            className={`${tile} text-ink transition-transform duration-200 hover:text-brand active:scale-[0.98] motion-reduce:transition-none`}
          >
            {icon}
            {label}
          </Link>
        );
      })}
    </div>
  );
}
