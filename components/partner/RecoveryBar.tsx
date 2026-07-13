import { PiggyBank } from "lucide-react";
import type { PartnerRecovery } from "@/lib/data/partner";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;

// Investment-recovery progress for a recovery-model investor (e.g. B-17). The key
// nuance, spelled out so it never confuses: "recovered" counts cash actually paid
// to the investor, not profit merely earned.
export function RecoveryBar({ r }: { r: PartnerRecovery }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-ink">
        <PiggyBank size={17} className="text-gold-deep" /> Investment recovery
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${r.pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="font-medium text-ink tabular-nums">{r.pct}% recovered</span>
        {r.phase === "B" ? (
          <span className="text-green">Fully recovered</span>
        ) : (
          <span className="text-muted tabular-nums">{pkr(r.remaining)} remaining</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Cell label="Invested" value={pkr(r.invested)} />
        <Cell label="Recovered" value={pkr(r.recovered)} />
        <Cell label="Remaining" value={pkr(r.remaining)} />
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
      <div className="font-display text-base font-semibold text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-dim">{label}</div>
    </div>
  );
}
