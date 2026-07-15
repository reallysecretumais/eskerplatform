import Link from "next/link";
import { ArrowRight, LineChart, ShieldCheck, Wallet } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import {
  getMyPartnerProperties,
  getPartnerDashboard,
  getPartnerSummary,
  currentPktMonth,
  recentMonths,
} from "@/lib/data/partner";
import { PropertyDashboard } from "@/components/partner/PropertyDashboard";
import { brand } from "@/lib/brand";

export const metadata = { title: "Partner — Esker" };

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export default async function PartnerHome({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const account = await requireAccount();
  if (!account.roles.includes("partner")) return <PartnerFallback />;

  const properties = await getMyPartnerProperties();
  if (properties.length === 0) return <NoProperties />;

  // One property → land straight on its dashboard (no list to click through).
  if (properties.length === 1) {
    const months = recentMonths(12);
    const requested = (await searchParams).month;
    const month = requested && months.includes(requested) ? requested : currentPktMonth();
    const data = await getPartnerDashboard(properties[0].id, month);
    if (!data) return <NoProperties />;
    return <PropertyDashboard data={data} months={months} monthBase="/partner" />;
  }

  // Multiple → a portfolio roll-up with drill-down.
  const month = currentPktMonth();
  const summaries = (await Promise.all(properties.map((p) => getPartnerSummary(p.id)))).filter((s) => s !== null);
  const totalNet = summaries.reduce((s, x) => s + (x!.performance?.net ?? 0), 0);
  const totalShare = summaries.reduce((s, x) => s + (x!.performance?.yourShare ?? 0), 0);
  const totalAvailable = summaries.reduce((s, x) => s + x!.available.amount, 0);
  const firstName = account.name?.split(" ")[0] || "there";

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Your portfolio</h1>
      <p className="mt-1 text-sm text-muted">Welcome back, {firstName}. Across your properties — {monthLabel(month)}.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Hero label={`Net · ${monthLabel(month).split(" ")[0]}`} value={pkr(totalNet)} />
        <Hero label="Your share this month" value={pkr(totalShare)} accent />
        <Hero label="Available to withdraw" value={pkr(totalAvailable)} accent icon={<Wallet size={14} />} />
      </div>

      <div className="mt-6 space-y-4">
        {summaries.map((s) => (
          <Link
            key={s!.property.id}
            href={`/partner/properties/${s!.property.id}`}
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-hi"
          >
            <div
              className="h-16 shrink-0 overflow-hidden rounded-lg"
              style={{ width: 84, backgroundColor: "#e7e1d6", backgroundImage: s!.property.photo ? `url(${s!.property.photo})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{s!.property.title}</div>
              <div className="text-xs text-muted">{s!.property.area ?? ""}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                <span className="text-muted">Net <span className="tabular-nums text-ink">{pkr(s!.performance?.net ?? 0)}</span></span>
                <span className="text-muted">{s!.performance?.inRecovery ? "To recovery" : "Your share"} <span className="tabular-nums text-gold-deep">{pkr(s!.performance?.yourShare ?? 0)}</span></span>
                {s!.available.amount > 0 && <span className="text-muted">Available <span className="tabular-nums text-gold-deep">{pkr(s!.available.amount)}</span></span>}
              </div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-dim" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Hero({ label, value, accent = false, icon }: { label: string; value: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-gold/30 bg-gradient-to-br from-gold/[0.07] to-transparent" : "border-line bg-surface"}`}>
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${accent ? "text-gold-deep" : "text-dim"}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-display text-xl font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function NoProperties() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Partner</h1>
      <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
        <LineChart size={22} className="mx-auto text-gold-deep" />
        <p className="mt-2 text-sm text-muted">No properties are linked to your account yet. Esker will set this up for you.</p>
      </div>
    </div>
  );
}

function PartnerFallback() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Partner access</h1>
      <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-6">
        <div className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-ink">
          <ShieldCheck size={17} className="text-gold-deep" /> Arranged by Esker
        </div>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          The partner portal shows a live, read-only view of your property&apos;s performance, your share, and your payouts.
          Access is set up by the {brand.short} team for investors and owners. If you should have access, please get in touch and we&apos;ll link your account.
        </p>
        <a
          href={`https://wa.me/${brand.whatsapp}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90"
        >
          Contact Esker <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
}
