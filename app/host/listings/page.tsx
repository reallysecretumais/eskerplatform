import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getMyListings } from "@/lib/data/host";
import { ListingStatusBadge } from "@/components/host/ListingStatus";
import { PauseResume } from "@/components/host/PauseResume";
import { thumb } from "@/lib/img";

export const metadata = { title: "Your listings — Esker" };

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;

export default async function HostListingsPage() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  const listings = await getMyListings();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Your listings</h1>
        <Link href="/host/listings/new" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90">
          <Plus size={15} /> New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
          No listings yet — create your first one.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {listings.map((l) => (
            <div key={l.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <Link href={`/host/listings/${l.id}`} className="flex items-center gap-4 p-4 transition hover:bg-surface-2/50">
                <div className="h-20 shrink-0 overflow-hidden rounded-xl" style={{ width: 112, backgroundColor: "#e7e1d6", backgroundImage: l.photos[0] ? `url(${thumb(l.photos[0], 320, 65)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-ink">{l.title}</div>
                  <div className="text-xs text-muted">{[l.category, l.area].filter(Boolean).join(" · ")}</div>
                  <div className="mt-1 text-sm text-ink tabular-nums">{pkr(l.price)}<span className="text-xs text-dim"> / night</span></div>
                  <div className="mt-1.5"><ListingStatusBadge status={l.status} /></div>
                </div>
              </Link>
              {l.status === "draft" && (
                <Link href={`/host/listings/${l.id}`} className="block border-t border-line bg-blue/5 px-4 py-2.5 text-xs font-medium text-blue transition hover:bg-blue/10">
                  Finish setting up — add photos & submit →
                </Link>
              )}
              {l.status === "rejected" && l.reviewNote && (
                <div className="border-t border-line bg-red/5 px-4 py-2.5 text-xs text-red">Esker: {l.reviewNote}</div>
              )}
              {(l.status === "live" || l.status === "paused") && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                  <span className="text-xs text-dim">{l.status === "paused" ? "Hidden from the website" : "Visible on the website"}</span>
                  <PauseResume listingId={l.id} status={l.status} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
