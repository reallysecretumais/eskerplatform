import Link from "next/link";
import { Building2, Hotel, Home, Trees, Camera, Waves } from "lucide-react";

// Visual category showcase (replaces abstract text-pill filters). Consistent,
// intentional tiles now; each upgrades to a photo-backed tile as photography
// arrives. The meta line states the booking model honestly. Each tile links to
// the search page filtered to that category.

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

export function CategoryShowcase() {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
      {CATEGORIES.map(({ name, Icon, meta, tone }) => (
        <Link
          key={name}
          href={`/stays?category=${encodeURIComponent(name)}`}
          className="group relative flex h-40 flex-col justify-end overflow-hidden rounded-2xl border border-line p-4 transition hover:border-gold/40 hover:shadow-sm"
          style={{ backgroundImage: tone }}
        >
          <Icon className="absolute right-4 top-4 text-gold transition group-hover:scale-110" size={26} strokeWidth={1.5} />
          <div className="font-display text-lg font-semibold tracking-tight text-ink">{name}</div>
          <div className="text-xs text-muted">{meta}</div>
        </Link>
      ))}
    </div>
  );
}
