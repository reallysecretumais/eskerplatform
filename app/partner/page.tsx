import Link from "next/link";
import { ArrowRight, LineChart, ShieldCheck } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getMyPartnerProperties, getPartnerPerformance, currentPktMonth } from "@/lib/data/partner";
import { brand } from "@/lib/brand";

export const metadata = { title: "Partner — Esker" };

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export default async function PartnerHome() {
  const account = await requireAccount();
  if (!account.roles.includes("partner")) return <PartnerFallback />;

  const month = currentPktMonth();
  const properties = await getMyPartnerProperties();
  const snapshots = await Promise.all(properties.map((p) => getPartnerPerformance(p.id, month)));
  const firstName = account.name?.split(" ")[0] || "there";

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Partner</h1>
        <p className="mt-1 text-sm text-muted">Welcome back, {firstName}. Here&apos;s how your {properties.length === 1 ? "property is" : "properties are"} doing — {monthLabel(month)}.</p>
      </div>

      {properties.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
          <LineChart size={22} className="mx-auto text-gold-deep" />
          <p className="mt-2 text-sm text-muted">No properties are linked to your account yet. Esker will set this up for you.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {properties.map((p, i) => {
            const perf = snapshots[i];
            return (
              <Link
                key={p.id}
                href={`/partner/properties/${p.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-hi"
              >
                <div
                  className="h-16 shrink-0 overflow-hidden rounded-lg"
                  style={{ width: 84, backgroundColor: "#e7e1d6", backgroundImage: p.photo ? `url(${p.photo})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{p.title}</div>
                  <div className="text-xs text-muted">{p.area ?? ""}</div>
                  {perf && (
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                      <span className="text-muted">Net <span className="tabular-nums text-ink">{pkr(perf.net)}</span></span>
                      <span className="text-muted">{perf.inRecovery ? "To recovery" : "Your share"} <span className="tabular-nums text-gold-deep">{pkr(perf.yourShare)}</span></span>
                    </div>
                  )}
                </div>
                <ArrowRight size={16} className="shrink-0 text-dim" />
              </Link>
            );
          })}
        </div>
      )}
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
