import { Receipt } from "lucide-react";
import type { PartnerPayout } from "@/lib/data/partner";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Payouts Esker has made to the partner for this property (newest first).
export function PayoutList({ payouts }: { payouts: PartnerPayout[] }) {
  if (payouts.length === 0) {
    return <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">No payouts recorded yet.</div>;
  }
  return (
    <div className="space-y-3">
      {payouts.map((w) => (
        <div key={w.id} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          <Receipt size={18} className="shrink-0 text-dim" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">{fmt(w.withdrawnOn)}</div>
            <div className="text-xs text-muted">
              Receipt {w.receiptNo}
              {w.forPeriod ? ` · for ${new Date(`${w.forPeriod}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}
              {w.note ? ` · ${w.note}` : ""}
            </div>
          </div>
          <div className="shrink-0 font-display text-sm font-semibold text-green tabular-nums">{pkr(w.amount)}</div>
        </div>
      ))}
    </div>
  );
}
