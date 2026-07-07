import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Eye } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getMyListing } from "@/lib/data/host";
import { ListingForm } from "@/components/host/ListingForm";
import { PhotoManager } from "@/components/host/PhotoManager";
import { ListingStatusBadge } from "@/components/host/ListingStatus";
import { PauseResume } from "@/components/host/PauseResume";

export const metadata = { title: "Edit listing — Esker" };

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  const { id } = await params;
  const { created } = await searchParams;
  const listing = await getMyListing(id);
  if (!listing) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/host/listings" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ChevronLeft size={16} /> Your listings
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{listing.title}</h1>
          <div className="mt-1.5 flex items-center gap-3">
            <ListingStatusBadge status={listing.status} />
            {listing.status === "live" && (
              <Link href={`/stays/${listing.id}`} className="inline-flex items-center gap-1 text-xs text-gold-deep hover:underline">
                <Eye size={12} /> View on the website
              </Link>
            )}
          </div>
        </div>
        {(listing.status === "live" || listing.status === "paused") && (
          <PauseResume listingId={listing.id} status={listing.status} />
        )}
      </div>

      {created && (
        <div className="mt-4 rounded-2xl border border-green/30 bg-green/5 p-4 text-sm text-green">
          Listing submitted — now add your photos below. We&apos;ll review it and put it live, usually within a day.
        </div>
      )}
      {listing.status === "rejected" && listing.reviewNote && (
        <div className="mt-4 rounded-2xl border border-red/30 bg-red/5 p-4 text-sm text-red">
          <span className="font-medium">Not approved:</span> {listing.reviewNote} — update your listing and message us to re-review.
        </div>
      )}
      {listing.status === "paused" && listing.reviewNote && (
        <div className="mt-4 rounded-2xl border border-line bg-surface-2/60 p-4 text-sm text-muted">
          <span className="font-medium text-ink">Note from Esker:</span> {listing.reviewNote}
        </div>
      )}

      <div className="mt-6">
        <PhotoManager listingId={listing.id} photos={listing.photos} />
      </div>

      <div className="mt-5">
        <ListingForm existing={listing} />
      </div>

      <p className="mt-4 text-xs text-dim">Edits go live immediately. Availability follows your bookings automatically.</p>
    </div>
  );
}
