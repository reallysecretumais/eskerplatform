import { EskerLogo } from "@/components/EskerLogo";
import { support } from "@/lib/payments";
import { isMonthInProgress, type PartnerStatement } from "@/lib/data/partner";
import { pktDate } from "@/lib/partnerFormat";
import { rs } from "@/lib/listings";

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// A branded, print/PDF-friendly monthly statement for a partner property. Same
// partner-safe figures as the portal: revenue, itemised costs, net, their share,
// recovery, occupancy, bookings count, and payouts made this month. No Esker
// share / mgmt-fee amount, no guest identity.
export function StatementView({ s }: { s: PartnerStatement }) {
  const p = s.performance;
  return (
    <article className="rounded-[22px] border border-line bg-surface p-6 text-ink sm:p-8 print:mt-0 print:border-0 print:bg-white print:p-0 print:text-black">
      <header className="flex items-start justify-between border-b border-line pb-5 print:border-black/15">
        <EskerLogo />
        <div className="text-right">
          <div className="text-base font-bold">Owner statement</div>
          <div className="tnum text-xs text-muted print:text-black/60">{monthLabel(s.month)}</div>
          <div className="text-xs text-muted print:text-black/60">Issued <span className="tnum">{today()}</span></div>
        </div>
      </header>

      <div className="py-5">
        <div className="label text-[11px] text-dim print:text-black/50">Property</div>
        <div className="mt-1 text-lg font-bold">{s.property.title}</div>
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
              <Line label="Revenue collected" value={rs(p.revenue)} />
              {p.expenseLines.map((l) => (
                <Line key={l.category} label={l.label} value={`− ${rs(l.amount)}`} muted />
              ))}
              {p.expenseLines.length > 0 && <Line label="Total operating costs" value={`− ${rs(p.expenses)}`} />}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2 print:border-black/15">
                <span className="font-medium">Net profit{p.hasMgmtFee ? " (after management fee)" : ""}</span>
                <span className="tnum text-base font-bold">{rs(p.net)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-medium text-brand print:text-black">{p.inRecovery ? "Applied to your recovery" : "Your share"}</span>
                <span className="tnum text-base font-bold text-brand print:text-black">{rs(p.yourShare)}</span>
              </div>
            </div>
          </div>

          {/* Occupancy / recovery */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Box label={isMonthInProgress(s.month) ? "Occupancy so far" : "Occupancy"} value={`${s.occupancy}%`} />
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
              <div className="label mb-2 text-[11px] text-dim print:text-black/50">Payouts this month</div>
              <div className="rounded-xl border border-line px-4 py-2 text-sm print:border-black/15">
                {s.payouts.map((w) => (
                  <div key={w.id} className="flex items-center justify-between py-1">
                    <span className="text-muted print:text-black/60">
                      <span className="tnum">{pktDate(w.withdrawnOn)} · {w.receiptNo}</span>
                      {w.amount < 0 ? " · credit — added to your balance" : ""}
                    </span>
                    <span className={`tnum ${w.amount < 0 ? "text-brand print:text-black" : ""}`}>
                      {w.amount < 0 ? `+${rs(-w.amount)}` : rs(w.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <footer className="mt-6 border-t border-line pt-4 text-xs text-muted print:border-black/15 print:text-black/60">
        Esker Rentals · Premium Stays. Figures are cash-basis for <span className="tnum">{monthLabel(s.month)}</span>. Questions about this statement?
        Email {support.email} or WhatsApp <span className="tnum">+{support.whatsapp}</span>.
      </footer>
    </article>
  );
}

function Line({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={muted ? "text-muted print:text-black/60" : "text-muted print:text-black/60"}>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-3 text-center print:border-black/15">
      <div className="tnum text-base font-bold">{value}</div>
      <div className="label mt-1 text-[10.5px] text-dim print:text-black/50">{label}</div>
    </div>
  );
}
