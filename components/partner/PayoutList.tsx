import { Receipt, BadgePlus } from "lucide-react";
import type { PartnerPayout } from "@/lib/data/partner";
import { pktDate } from "@/lib/partnerFormat";
import { rs } from "@/lib/listings";

const fmt = (d: string) => pktDate(d, { day: "numeric", month: "short", year: "numeric" });

// Payouts Esker has made to the partner for this property (newest first).
// A negative amount is a CREDIT — money added to the partner's balance (e.g.
// property expenses they covered themselves) — shown as +Rs with a Credit tag.
export function PayoutList({ payouts }: { payouts: PartnerPayout[] }) {
  if (payouts.length === 0) {
    return <div className="rounded-[22px] border border-line bg-surface p-6 text-center text-sm text-muted">No payouts recorded yet.</div>;
  }
  return (
    <div className="space-y-3">
      {payouts.map((w) => {
        const isCredit = w.amount < 0;
        return (
          <div
            key={w.id}
            className={`flex items-center gap-4 rounded-[22px] border bg-surface p-4 ${isCredit ? "border-brand/40" : "border-line"}`}
          >
            {isCredit ? <BadgePlus size={18} className="shrink-0 text-brand" /> : <Receipt size={18} className="shrink-0 text-dim" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="tnum">{fmt(w.withdrawnOn)}</span>
                {isCredit && (
                  <span className="label rounded-full bg-ice-tint px-2 py-0.5 text-[10px] text-brand-ink">
                    Credit
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                Receipt <span className="tnum">{w.receiptNo}</span>
                {w.forPeriod ? <> · for <span className="tnum">{new Date(`${w.forPeriod}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span></> : ""}
                {w.note ? ` · ${w.note}` : ""}
              </div>
            </div>
            <div className={`tnum shrink-0 text-sm font-bold ${isCredit ? "text-brand" : "text-green"}`}>
              {isCredit ? `+${rs(-w.amount)}` : rs(w.amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
