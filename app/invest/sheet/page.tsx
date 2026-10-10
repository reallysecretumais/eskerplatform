import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasAccess } from "../access";
import { readSelection, type SearchParams } from "../selection";
import { quote, rs, pct, months, stakeLabel } from "@/lib/invest/calc";
import { PACKAGES, TERMS, FOUNDERS, DISCLAIMER } from "@/lib/invest/config";
import { PrintBar } from "@/components/invest/PrintBar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Esker investment sheet", robots: { index: false, follow: false } };

const HANDLES = [
  "Finding the property", "Negotiating the lease", "Furnishing and design", "Professional shoot", "Marketing and ads",
  "Every booking", "Guest ID verification", "Cleaning after every stay", "The 2am calls", "Maintenance and repairs",
];

/**
 * The personalised handover sheet — A4, two pages, from the SAME engine as the
 * page, for the selection in the URL. "Save as PDF" is the browser's own print.
 */
export default async function Sheet({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  if (!(await hasAccess())) redirect("/invest");
  const sel = readSelection(sp);
  const q = quote(sel)!;
  const name = (Array.isArray(sp.name) ? sp.name[0] : sp.name)?.trim().slice(0, 60) || "";
  const std = q.packages[sel.pkg];
  const pkgLabel = PACKAGES.find((p) => p.id === sel.pkg)!.label;
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date());
  const back = `/invest?area=${sel.areaId}&unit=${sel.unit}&stake=${sel.stake === 1 ? "100" : "50"}&pkg=${sel.pkg}`;

  return (
    <div className="sheet-view">
      <PrintBar back={back} />

      {/* ── Page 1 ── */}
      <article className="sheet">
        <div className="s-top">
          <div className="mark">
            ESKER
            <small>RENTALS</small>
          </div>
          <div className="s-meta num">
            {name ? <>Prepared for <b style={{ color: "var(--ink)" }}>{name}</b><br /></> : null}
            {date}
          </div>
        </div>
        <span className="s-arch" aria-hidden />

        <p className="eyebrow" style={{ marginTop: 26 }}>Your projection</p>
        <h1 className="serif" style={{ marginTop: 10, maxWidth: "11em" }}>
          {sel.stake === 1 ? "A full" : "A half"} share of a {q.unit} in <em>{q.area.name}.</em>
        </h1>
        <p className="small" style={{ marginTop: 8, maxWidth: "36em" }}>
          You fund the setup. Esker finds, furnishes and runs the apartment. It&apos;s live in {TERMS.launchDays} days, and you get{" "}
          {Math.round(TERMS.investorShare * 100)}% of the net profit every month.
        </p>

        <div className="kv num">
          <div><span>Your investment</span><b>Rs {rs(q.yourCapital)}</b></div>
          <div><span>Monthly share · {pkgLabel}</span><b>Rs {rs(std.yourMonthly)}</b></div>
          <div><span>Annual return</span><b>{pct(std.annualReturn)}%</b></div>
        </div>

        <h2 className="serif">Your investment covers</h2>
        <table className="num">
          <tbody>
            <tr><td>Advance rent · {TERMS.advanceRentMonths} month</td><td style={{ textAlign: "right" }}>Rs {rs(q.advanceRent)}</td></tr>
            <tr><td>Security · {TERMS.securityMonths} months (refundable at lease end)</td><td style={{ textAlign: "right" }}>Rs {rs(q.securityDeposit)}</td></tr>
            <tr><td>{q.furnishingLabel}</td><td style={{ textAlign: "right" }}>Rs {rs(q.furnishing)}</td></tr>
            <tr><td>Total setup</td><td style={{ textAlign: "right" }}>Rs {rs(q.upfrontTotal)}</td></tr>
            <tr className="hl"><td>Your investment · {stakeLabel(q.stake)}</td><td style={{ textAlign: "right" }}>Rs {rs(q.yourCapital)}</td></tr>
          </tbody>
        </table>

        <h2 className="serif">Three occupancy packages</h2>
        <table className="num">
          <thead>
            <tr><th>Package</th><th>Nights</th><th>Monthly</th><th>Yearly</th><th>Annual return</th><th>Payback</th></tr>
          </thead>
          <tbody>
            {PACKAGES.map((p) => {
              const r = q.packages[p.id];
              return (
                <tr key={p.id} className={p.id === sel.pkg ? "hl" : ""}>
                  <td>{p.label}</td>
                  <td>{p.nights}</td>
                  <td>Rs {rs(r.yourMonthly)}</td>
                  <td>Rs {rs(r.yourYearly)}</td>
                  <td>{pct(r.annualReturn)}%</td>
                  <td>~{months(r.paybackMonths)} months</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="lines num" style={{ marginTop: 16 }}>
          <p>Your capital back in <b>~{months(std.paybackMonths)} months</b>. Every month after is profit, for as long as the property runs.</p>
          <p>This apartment covers all its costs at just <b>{q.breakevenNights} nights</b> a month.</p>
          <p>Monthly running cost Rs {rs(q.monthlyCost)} (rent Rs {rs(q.rent)}, electricity, caretaker, laundry, maintenance, internet). Nightly rate Rs {rs(q.nightly)}.</p>
        </div>

        <div className="s-foot">Projected figures. {DISCLAIMER}</div>
      </article>

      {/* ── Page 2 ── */}
      <article className="sheet">
        <div className="s-top">
          <div className="mark">
            ESKER
            <small>RENTALS</small>
          </div>
          <div className="s-meta">{name ? `For ${name}` : ""}</div>
        </div>

        <h2 className="serif" style={{ fontSize: 28, marginTop: 20 }}>What Esker handles</h2>
        <div className="grid2">{HANDLES.map((h) => <div key={h}>{h}</div>)}</div>
        <p className="serif" style={{ fontSize: 22, marginTop: 14 }}>Your part: invest, and <em>read your monthly report.</em></p>

        <h2 className="serif">What you own, and the terms</h2>
        <div className="grid2" style={{ gridTemplateColumns: "1fr 1.6fr" }}>
          <div>What you own</div><div>Real furniture and fittings in a real apartment. On exit you receive your share of it.</div>
          <div>Lease</div><div>{TERMS.leaseYears}, held by Esker on strict owner terms.</div>
          <div>Exit</div><div>{TERMS.exitNoticeDays} days&apos; notice. You receive your share of the furniture.</div>
          <div>Reporting</div><div>Monthly, every expense itemised.</div>
          <div>Buildings</div><div>Handpicked only. We operate only in buildings we&apos;ve vetted.</div>
          <div>Overheads</div><div>Ads, staff and software are carried by Esker, never charged to the property.</div>
        </div>

        <h2 className="serif">From yes to your first payout</h2>
        <div className="tl">
          <div><b>Confirm</b>We lock the lease in a handpicked building.</div>
          <div><b>Furnish</b>Design, furniture, fittings and the professional shoot.</div>
          <div><b>Launch</b>Live within {TERMS.launchDays} days, across our booking channels.</div>
          <div><b>Earn</b>Your share and your report, every month.</div>
        </div>

        <h2 className="serif">Talk to us</h2>
        <div className="grid2 num">
          {FOUNDERS.map((f) => (
            <div key={f.name}><b>{f.name}</b> · Co-founder · {f.display}</div>
          ))}
        </div>

        <div className="s-foot">{DISCLAIMER}</div>
      </article>
    </div>
  );
}
