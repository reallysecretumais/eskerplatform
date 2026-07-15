import type { PartnerTrendPoint } from "@/lib/data/partner";

const shortMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" });

// Dependency-free 6-month bars. Each bar's full height is that month's net; the
// deep-gold portion is the partner's share of it (for a recovery investor that's
// the whole bar). Loss months collapse to the baseline. Pure CSS heights — no
// chart library, nothing to hydrate.
export function TrendChart({ points }: { points: PartnerTrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.net, 0)));
  const current = points[points.length - 1]?.month;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-dim">Last 6 months</div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-gold-deep" /> Your share</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-gold/30" /> Net</span>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2" style={{ height: 92 }}>
        {points.map((p) => {
          const netH = Math.max(3, Math.round((Math.max(p.net, 0) / max) * 100));
          const shareInner = netH > 0 ? Math.min(100, Math.round((Math.max(p.yourShare, 0) / Math.max(p.net, 1)) * 100)) : 0;
          const isCurrent = p.month === current;
          return (
            <div key={p.month} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end justify-center">
                <div className="relative w-full max-w-[26px] overflow-hidden rounded-md bg-gold/25" style={{ height: `${netH}%` }} title={shortMonth(p.month)}>
                  <div className="absolute bottom-0 left-0 w-full rounded-md bg-gold-deep" style={{ height: `${shareInner}%` }} />
                </div>
              </div>
              <span className={`text-[10.5px] ${isCurrent ? "font-semibold text-ink" : "text-dim"}`}>{shortMonth(p.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
