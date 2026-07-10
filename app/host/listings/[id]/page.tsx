import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Eye } from "lucide-react";
import { MIN_LISTING_PHOTOS } from "@/lib/hostConstants";
import { requireAccount } from "@/lib/auth";
import { getMyListing, getCoveredAreas, getListingCalendar, getListingGuestInfo } from "@/lib/data/host";
import { ListingForm } from "@/components/host/ListingForm";
import { PhotoManager } from "@/components/host/PhotoManager";
import { ListingStatusBadge } from "@/components/host/ListingStatus";
import { PauseResume } from "@/components/host/PauseResume";
import { SubmitBar } from "@/components/host/SubmitBar";
import { AvailabilityCalendar } from "@/components/host/AvailabilityCalendar";
import { GuestInfoForm } from "@/components/host/GuestInfoForm";

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
  const [listing, areas, calendar, guestInfo] = await Promise.all([
    getMyListing(id),
    getCoveredAreas(),
    getListingCalendar(id),
    getListingGuestInfo(id),
  ]);
  if (!listing) notFound();

  const isDraft = listing.status === "draft" || listing.status === "rejected";
  // Mirror of the server-side submit checklist (submitListing re-validates).
  const checklist = {
    title: listing.title.trim().length >= 4,
    description: (listing.description ?? "").trim().length >= 40,
    price: listing.price >= 1000,
    photos: listing.photos.length >= MIN_LISTING_PHOTOS,
    ready: false,
  };
  checklist.ready = checklist.title && checklist.description && checklist.price && checklist.photos;

  return (
    <div className="max-w-2xl">
      <Link href="/host/listings" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ChevronLeft size={16} /> Your listings
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{listing.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <ListingStatusBadge status={listing.status} />
            <Link href={`/host/listings/${listing.id}/preview`} className="inline-flex items-center gap-1 text-xs text-gold-deep hover:underline">
              <Eye size={12} /> Preview as a guest
            </Link>
            {listing.status === "live" && (
              <Link href={`/stays/${listing.id}`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink hover:underline">
                View live listing
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
          Draft saved — add your photos below, then submit for review when you&apos;re happy with it.
        </div>
      )}
      {listing.status === "rejected" && listing.reviewNote && (
        <div className="mt-4 rounded-2xl border border-red/30 bg-red/5 p-4 text-sm text-red">
          <span className="font-medium">Not approved:</span> {listing.reviewNote} — update your listing below and resubmit.
        </div>
      )}
      {listing.status === "paused" && listing.reviewNote && (
        <div className="mt-4 rounded-2xl border border-line bg-surface-2/60 p-4 text-sm text-muted">
          <span className="font-medium text-ink">Note from Esker:</span> {listing.reviewNote}
        </div>
      )}

      {/* Draft / resubmit: the submit bar leads */}
      {isDraft && (
        <div className="mt-5">
          <SubmitBar listingId={listing.id} checklist={checklist} />
        </div>
      )}

      <div className="mt-5">
        <PhotoManager listingId={listing.id} photos={listing.photos} />
      </div>

      {calendar && (
        <div className="mt-5">
          <AvailabilityCalendar listingId={listing.id} bookings={calendar.bookings} blocks={calendar.blocks} />
        </div>
      )}

      {guestInfo && (
        <div className="mt-5">
          <GuestInfoForm listingId={listing.id} info={guestInfo} />
        </div>
      )}

      <div className="mt-5">
        <ListingForm existing={listing} areas={areas} />
      </div>

      <p className="mt-4 text-xs text-dim">
        {isDraft ? "Your draft is private until you submit it and Esker approves it." : "Edits go live immediately."}
      </p>
    </div>
  );
}
