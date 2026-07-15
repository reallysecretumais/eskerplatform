import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getMyPartnerProperties } from "@/lib/data/partner";
import { redirect } from "next/navigation";

export const metadata = { title: "Your properties — Esker" };

export default async function PartnerProperties() {
  const account = await requireAccount();
  if (!account.roles.includes("partner")) redirect("/partner");

  const properties = await getMyPartnerProperties();
  // One (or zero) property → the dashboard lives at /partner; no list needed.
  if (properties.length <= 1) redirect("/partner");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Your properties</h1>

      {properties.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
          <LineChart size={22} className="mx-auto text-gold-deep" />
          <p className="mt-2 text-sm text-muted">No properties are linked to your account yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {properties.map((p) => (
            <Link key={p.id} href={`/partner/properties/${p.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-hi">
              <div className="h-16 shrink-0 overflow-hidden rounded-lg" style={{ width: 84, backgroundColor: "#e7e1d6", backgroundImage: p.photo ? `url(${p.photo})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{p.title}</div>
                <div className="text-xs text-muted">{p.area ?? ""}</div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-dim" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
