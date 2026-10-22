import { Wallet } from "lucide-react";
import type { PartnerAvailable } from "@/lib/data/partner";
import { rs } from "@/lib/listings";

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

// The single number a partner most wants: what they can actually withdraw right
// now. It counts settled (completed-month) earnings less payouts already made —
// the running month is excluded because its costs are still accruing.
export function AvailableCard({ available }: { available: PartnerAvailable }) {
  const has = available.amount > 0;
  return (
    <div className="rounded-[22px] border border-brand/40 bg-surface p-5">
      <div className="label flex items-center gap-1.5 text-[11px] text-brand">
        <Wallet size={14} /> Available to withdraw
      </div>
      <div className="tnum mt-1.5 text-3xl font-bold text-ink">{rs(available.amount)}</div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {has
          ? `Your settled earnings through ${monthLabel(available.throughMonth)}, less payouts already made. `
          : "Nothing to withdraw yet — earnings settle at each month's end. "}
        This month is still accruing, so it isn&rsquo;t included.
      </p>
    </div>
  );
}
