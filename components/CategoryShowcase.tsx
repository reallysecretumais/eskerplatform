import Link from "next/link";
import { Building2, Hotel, Home, Trees, Camera, Waves, ArrowRight } from "lucide-react";
import { normalizeCategory } from "@/lib/listings";

// Visual category showcase (replaces abstract text-pill filters). Consistent,
// intentional tiles now; each upgrades to a photo-backed tile as photography
// arrives. The meta line states the booking model honestly.
//
// A tile only becomes a LINK once that category actually has stays — otherwise
// it renders as a quiet, non-clickable "Coming soon". Four of these six used to
// link straight to an empty results page. `counts` is derived from the live
// listings (see lib/listings.ts categoryCounts), so publishing the first villa
// in the CRM flips that tile live on the next cache bust — no code change.

type Cat = {
  name: string;
  Icon: typeof Building2;
  meta: string;
  tone: string;
};

const CATEGORIES: Cat[] = [
  { name: "Apartments", Icon: Building2, meta: "Per night", tone: "linear-gradient(145deg,#f3efe6,#e9e2d3)" },
  { name: "Penthouses", Icon: Hotel, meta: "Per night", tone: "linear-gradient(145deg,#f1ece2,#e6dccb)" },
  { name: "Villas", Icon: Home, meta: "Per night", tone: "linear-gradient(145deg,#eef0e8,#e1e6d6)" },
  { name: "Farmhouses", Icon: Trees, meta: "Per night", tone: "linear-gradient(145deg,#edf1ea,#dde7d6)" },
  { name: "Content Spaces", Icon: Camera, meta: "By the hour", tone: "linear-gradient(145deg,#f0edf2,#e6dfea)" },
  { name: "Swimming Pools", Icon: Waves, meta: "By the slot", tone: "linear-gradient(145deg,#e8f1f2,#d8e7ea)" },
];

export function CategoryShowcase({ counts = {} }: { counts?: Record<string, number> }) {
  const shell = "group relative flex h-40 flex-col justify-end overflow-hidden rounded-2xl border border-line p-4";

  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
      {CATEGORIES.map(({ name, Icon, meta, tone }) => {
        const count = counts[normalizeCategory(name)] ?? 0;

        // Nothing to show yet — a quiet placeholder, deliberately NOT a link.
        if (count === 0) {
          return (
            <div
              key={name}
              aria-disabled="true"
              className={`${shell} opacity-55`}
              style={{ backgroundImage: tone }}
            >
              <Icon className="absolute right-4 top-4 text-dim" size={26} strokeWidth={1.5} />
              <div className="font-display text-lg font-semibold tracking-tight text-muted">{name}</div>
              <div className="mt-1">
                <span className="rounded-full border border-line bg-surface/70 px-2 py-0.5 text-[10.5px] text-dim">Coming soon</span>
              </div>
            </div>
          );
        }

        return (
          <Link
            key={name}
            href={`/stays?category=${encodeURIComponent(name)}`}
            className={`${shell} transition duration-300 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md hover:shadow-black/[0.05]`}
            style={{ backgroundImage: tone }}
          >
            <Icon className="absolute right-4 top-4 text-gold transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" size={26} strokeWidth={1.5} />
            <div className="flex items-center gap-1 font-display text-lg font-semibold tracking-tight text-ink">
              {name}
              <ArrowRight size={16} className="-translate-x-1 text-gold opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
            </div>
            <div className="text-xs text-muted">
              {count} {count === 1 ? "stay" : "stays"} · {meta}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
