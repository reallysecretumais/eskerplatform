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
      <h2 className="headline mb-4 text-2xl">Built for Pakistan</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(({ Icon, title, sub }) => (
          <div key={title} className="rounded-[18px] bg-surface p-4 shadow-[0_1px_0_var(--color-line)]">
            <Icon size={20} className="text-brand" strokeWidth={1.8} />
            <div className="mt-2.5 text-[15px] font-semibold text-ink">{title}</div>
            <div className="text-xs text-muted">{sub}</div>
          </div>
        ))}
      </div>

      {bullets.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-[15px] font-bold text-ink">Good to know</h3>
          <ul className="space-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
