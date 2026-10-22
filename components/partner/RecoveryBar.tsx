import { PiggyBank } from "lucide-react";
import type { PartnerRecovery } from "@/lib/data/partner";
import { rs } from "@/lib/listings";

// Investment-recovery progress for a recovery-model investor (e.g. B-17). The key
// nuance, spelled out so it never confuses: "recovered" counts cash actually paid
// to the investor, not profit merely earned.
export function RecoveryBar({ r }: { r: PartnerRecovery }) {
  return (
    <div className="rounded-[22px] border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-base font-bold text-ink">
        <PiggyBank size={17} className="text-brand" /> Investment recovery
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${r.pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="tnum font-semibold text-ink">{r.pct}% recovered</span>
        {r.phase === "B" ? (
          <span className="text-green">Fully recovered</span>
        ) : (
          <span className="tnum text-muted">{rs(r.remaining)} remaining</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Cell label="Invested" value={rs(r.invested)} />
        <Cell label="Recovered" value={rs(r.recovered)} />
        <Cell label="Remaining" value={rs(r.remaining)} />
      </div>

      <p className="mt-3 text-xs text-dim">
        Recovered counts the cash actually paid to you so far — not profit merely earned. Until recovery completes, the
        full monthly net profit is earmarked toward it.
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="tnum text-base font-bold text-ink">{value}</div>
      <div className="label mt-1 text-[10.5px] text-dim">{label}</div>
    </div>
  );
}
