import { Receipt, BadgePlus } from "lucide-react";
import type { PartnerPayout } from "@/lib/data/partner";
import { pktDate } from "@/lib/partnerFormat";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const fmt = (d: string) => pktDate(d, { day: "numeric", month: "short", year: "numeric" });

// Payouts Esker has made to the partner for this property (newest first).
// A negative amount is a CREDIT — money added to the partner's balance (e.g.
// property expenses they covered themselves) — shown as +₨ with a Credit tag.
export function PayoutList({ payouts }: { payouts: PartnerPayout[] }) {
  if (payouts.length === 0) {
    return <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">No payouts recorded yet.</div>;
  }
  return (
    <div className="space-y-3">
      {payouts.map((w) => {
        const isCredit = w.amount < 0;
        return (
          <div
            key={w.id}
            className={`flex items-center gap-4 rounded-2xl border p-4 ${isCredit ? "border-gold/30 bg-gradient-to-br from-gold/[0.06] to-transparent" : "border-line bg-surface"}`}
          >
            {isCredit ? <BadgePlus size={18} className="shrink-0 text-gold-deep" /> : <Receipt size={18} className="shrink-0 text-dim" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                {fmt(w.withdrawnOn)}
                {isCredit && (
                  <span className="rounded-full border border-gold/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-deep">
                    Credit
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                Receipt {w.receiptNo}
                {w.forPeriod ? ` · for ${new Date(`${w.forPeriod}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}
                {w.note ? ` · ${w.note}` : ""}
              </div>
            </div>
            <div className={`shrink-0 font-display text-sm font-semibold tabular-nums ${isCredit ? "text-gold-deep" : "text-green"}`}>
              {isCredit ? `+${pkr(-w.amount)}` : pkr(w.amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
