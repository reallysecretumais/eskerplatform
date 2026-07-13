import { TrendingUp, Wallet, Percent } from "lucide-react";
import type { PartnerPerformance } from "@/lib/data/partner";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;

// The partner's side of the month, cash basis: revenue collected, itemised
// operating costs, net profit, and their share. Esker's share and the management
// fee amount are never shown. For a management-fee deal, net is the honest
// headline (revenue − costs won't equal net because the fee is folded in) and a
// footnote says so, without printing the fee.
export function PerformanceCard({ p, occupancy, bookingsCount }: { p: PartnerPerformance; occupancy: number; bookingsCount: number }) {
  const shareLabel = p.inRecovery ? "To your recovery" : "Your share";

  return (
    <section>
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<TrendingUp size={15} />} label="Revenue collected" value={pkr(p.revenue)} />
        <Stat icon={<Wallet size={15} />} label="Net profit" value={pkr(p.net)} accent />
        <Stat icon={<Percent size={15} />} label={shareLabel} value={pkr(p.yourShare)} accent />
      </div>
      <div className="mt-2 text-xs text-dim">
        {occupancy}% occupancy · {bookingsCount} {bookingsCount === 1 ? "booking" : "bookings"} this month
      </div>

      {/* Operating costs, itemised */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-dim">Operating costs</div>
        {p.expenseLines.length === 0 ? (
          <div className="text-sm text-muted">No costs recorded for this month.</div>
        ) : (
          <div className="text-sm">
            {p.expenseLines.map((l) => (
              <div key={l.category} className="flex items-center justify-between py-1">
                <span className="text-muted">{l.label}</span>
                <span className="tabular-nums text-ink">{pkr(l.amount)}</span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-line pt-2 font-medium">
              <span>Total costs</span>
              <span className="tabular-nums">{pkr(p.expenses)}</span>
            </div>
          </div>
        )}
      </div>

      {p.hasMgmtFee && (
        <p className="mt-2 text-xs text-dim">Net profit is shown after operating costs and Esker&apos;s management fee.</p>
      )}
      {p.inRecovery && (
        <p className="mt-2 text-xs text-gold-deep">
          This month&apos;s full net profit is applied to your investment recovery — see the recovery panel below.
        </p>
      )}
    </section>
  );
}

function Stat({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className={`flex items-center gap-1.5 ${accent ? "text-gold-deep" : "text-dim"}`}>
        {icon}
      </div>
      <div className="mt-1.5 font-display text-xl font-semibold text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-dim">{label}</div>
    </div>
  );
}
