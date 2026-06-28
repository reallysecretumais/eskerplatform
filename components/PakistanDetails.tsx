import { MoonStar, Zap, Car, Users, ShieldCheck } from "lucide-react";

// §8 — "Built for Pakistan." Prayer space + load-shedding backup are confirmed
// for EVERY property, so they always show. Parking / family / secure surface
// when the host has noted them in public_facts, and the free-text facts render
// as a "Good to know" list. (Fill public_facts in the CRM to enrich.)
export function PakistanDetails({ facts }: { facts?: string | null }) {
  const f = (facts ?? "").toLowerCase();

  const items = [
    { Icon: MoonStar, title: "Prayer space", sub: "A dedicated prayer space is available.", show: true },
    { Icon: Zap, title: "Backup power", sub: "Keeps running through load-shedding.", show: true },
    { Icon: Car, title: "Parking", sub: "On-site parking.", show: f.includes("parking") },
    { Icon: Users, title: "Family-friendly", sub: "Comfortable for families.", show: f.includes("family") },
    { Icon: ShieldCheck, title: "Secure", sub: "Gated / guarded building.", show: f.includes("secur") || f.includes("gated") || f.includes("guard") },
  ].filter((i) => i.show);

  const bullets = (facts ?? "")
    .split(/\n|(?<=[.!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Built for Pakistan</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(({ Icon, title, sub }) => (
          <div key={title} className="rounded-xl border border-line bg-surface p-3.5">
            <Icon size={18} className="text-gold" strokeWidth={1.5} />
            <div className="mt-2 text-sm font-medium text-ink">{title}</div>
            <div className="text-xs text-muted">{sub}</div>
          </div>
        ))}
      </div>

      {bullets.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-medium text-ink">Good to know</h3>
          <ul className="space-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
