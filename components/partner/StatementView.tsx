import { EskerLogo } from "@/components/EskerLogo";
import { support } from "@/lib/payments";
import type { PartnerStatement } from "@/lib/data/partner";
import { pktDate } from "@/lib/partnerFormat";

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// A branded, print/PDF-friendly monthly statement for a partner property. Same
// partner-safe figures as the portal: revenue, itemised costs, net, their share,
// recovery, occupancy, bookings count, and payouts made this month. No Esker
// share / mgmt-fee amount, no guest identity.
export function StatementView({ s }: { s: PartnerStatement }) {
  const p = s.performance;
  return (
    <article className="rounded-2xl border border-line bg-surface p-6 text-ink sm:p-8 print:mt-0 print:border-0 print:bg-white print:p-0 print:text-black">
      <header className="flex items-start justify-between border-b border-line pb-5 print:border-black/15">
        <EskerLogo />
        <div className="text-right">
          <div className="font-display text-base font-semibold">Owner statement</div>
          <div className="text-xs text-muted print:text-black/60">{monthLabel(s.month)}</div>
          <div className="text-xs text-muted print:text-black/60">Issued {today()}</div>
        </div>
      </header>

      <div className="py-5">
        <div className="text-xs uppercase tracking-wider text-dim print:text-black/50">Property</div>
        <div className="mt-1 font-display text-lg font-semibold">{s.property.title}</div>
        {s.property.area && <div className="text-sm text-muted print:text-black/60">{s.property.area}</div>}
      </div>

      {!p ? (
        <div className="rounded-xl border border-line px-4 py-6 text-center text-sm text-muted print:border-black/15">
          No deal on file for this month.
        </div>
      ) : (
        <>
          {/* Money */}
          <div className="rounded-xl border border-line print:border-black/15">
            <div className="px-4 py-3 text-sm">
              <Line label="Revenue collected" value={pkr(p.revenue)} />
              {p.expenseLines.map((l) => (
                <Line key={l.category} label={l.label} value={`− ${pkr(l.amount)}`} muted />
              ))}
              {p.expenseLines.length > 0 && <Line label="Total operating costs" value={`− ${pkr(p.expenses)}`} />}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2 print:border-black/15">
                <span className="font-medium">Net profit{p.hasMgmtFee ? " (after management fee)" : ""}</span>
                <span className="font-display text-base font-semibold tabular-nums">{pkr(p.net)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-medium text-gold-deep print:text-black">{p.inRecovery ? "Applied to your recovery" : "Your share"}</span>
                <span className="font-display text-base font-semibold tabular-nums text-gold-deep print:text-black">{pkr(p.yourShare)}</span>
              </div>
            </div>
          </div>

          {/* Occupancy / recovery */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Box label="Occupancy" value={`${s.occupancy}%`} />
            <Box label="Bookings" value={String(s.bookingsCount)} />
            {p.recovery ? (
              <Box label="Recovered" value={`${p.recovery.pct}%`} />
            ) : (
              <Box label="Nights" value={String(s.bookings.reduce((n, b) => n + b.nightsInMonth, 0))} />
            )}
          </div>

          {/* Payouts this month */}
          {s.payouts.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wider text-dim print:text-black/50">Payouts this month</div>
              <div className="rounded-xl border border-line px-4 py-2 text-sm print:border-black/15">
                {s.payouts.map((w) => (
                  <div key={w.id} className="flex items-center justify-between py-1">
                    <span className="text-muted print:text-black/60">
                      {pktDate(w.withdrawnOn)} · {w.receiptNo}
                    </span>
                    <span className="tabular-nums">{pkr(w.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <footer className="mt-6 border-t border-line pt-4 text-xs text-muted print:border-black/15 print:text-black/60">
        Esker Rentals · Premium Stays. Figures are cash-basis for {monthLabel(s.month)}. Questions about this statement?
        Email {support.email} or WhatsApp +{support.whatsapp}.
      </footer>
    </article>
  );
}

function Line({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={muted ? "text-muted print:text-black/60" : "text-muted print:text-black/60"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-3 text-center print:border-black/15">
      <div className="font-display text-base font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-dim print:text-black/50">{label}</div>
    </div>
  );
}
