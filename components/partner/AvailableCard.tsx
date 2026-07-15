import { Wallet } from "lucide-react";
import type { PartnerAvailable } from "@/lib/data/partner";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

// The single number a partner most wants: what they can actually withdraw right
// now. It counts settled (completed-month) earnings less payouts already made —
// the running month is excluded because its costs are still accruing.
export function AvailableCard({ available }: { available: PartnerAvailable }) {
  const has = available.amount > 0;
  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.09] to-transparent p-5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gold-deep">
        <Wallet size={14} /> Available to withdraw
      </div>
      <div className="mt-1.5 font-display text-3xl font-semibold tabular-nums text-ink">{pkr(available.amount)}</div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {has
          ? `Your settled earnings through ${monthLabel(available.throughMonth)}, less payouts already made. `
          : "Nothing to withdraw yet — earnings settle at each month's end. "}
        This month is still accruing, so it isn&rsquo;t included.
      </p>
    </div>
  );
}
