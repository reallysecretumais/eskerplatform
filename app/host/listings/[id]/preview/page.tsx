import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, MapPin, Users, BedDouble, Eye } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getMyListing, getListingGuestInfo } from "@/lib/data/host";
import { Gallery } from "@/components/Gallery";
import { AmenityList } from "@/components/AmenityList";
import { PakistanDetails } from "@/components/PakistanDetails";
import { LocationSection } from "@/components/LocationSection";
import { unitForCategory, formatPrice } from "@/lib/listings";

export const metadata = { title: "Preview — Esker" };

// "How guests will see it" — the listing rendered with the real guest-facing
// components (gallery, amenities, location, Built-for-Pakistan), from the host's
// own draft (owner-checked). Read-only: no live booking widget.
export default async function ListingPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  const { id } = await params;
  const [listing, guestInfo] = await Promise.all([getMyListing(id), getListingGuestInfo(id)]);
  if (!listing) notFound();

  const { amount, unit } = formatPrice(listing.price, unitForCategory(listing.category ?? ""));

  return (
    <div className="max-w-4xl">
      {/* Preview chrome (not part of the guest view) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/host/listings/${listing.id}`} className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
          <ChevronLeft size={16} /> Back to editing
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/12 px-3 py-1 text-xs font-medium text-gold-deep">
          <Eye size={13} /> Preview — this is how guests will see it
        </span>
      </div>

      {/* Guest-facing content */}
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {listing.category && <div className="mb-2 text-xs uppercase tracking-wider text-dim">{listing.category}</div>}
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{listing.title}</h1>
            {listing.area && (
              <div className="mt-1.5 flex items-center gap-1 text-sm text-muted">
                <MapPin size={15} /> {listing.area}
              </div>
            )}
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="font-display text-2xl font-semibold text-ink tnum">{amount}</div>
            <div className="text-xs text-dim">per {unit}</div>
          </div>
        </div>

        <div className="mt-5">
          {listing.photos.length > 0 ? (
            <Gallery photos={listing.photos} title={listing.title} />
          ) : (
            <div className="grid aspect-[16/9] place-items-center rounded-2xl border border-dashed border-line-hi text-sm text-dim">
              Add photos to see your gallery here
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-5 text-sm text-ink">
          {listing.capacity ? <span className="inline-flex items-center gap-1.5"><Users size={16} className="text-gold" /> Sleeps {listing.capacity}</span> : null}
          {listing.bedrooms ? <span className="inline-flex items-center gap-1.5"><BedDouble size={16} className="text-gold" /> {listing.bedrooms} bed{listing.bedrooms > 1 ? "s" : ""}</span> : null}
        </div>

        {listing.description && (
          <section className="mt-6">
            <h2 className="mb-2 font-display text-lg font-semibold tracking-tight text-ink">About this place</h2>
            <p className="text-[15px] leading-relaxed text-muted">{listing.description}</p>
          </section>
        )}

        {listing.amenities.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Amenities</h2>
            <AmenityList amenities={listing.amenities} />
          </section>
        )}

        <div className="mt-6">
          <PakistanDetails facts={guestInfo?.publicFacts ?? null} />
        </div>

        <div className="mt-6">
          <LocationSection area={listing.area} />
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-dim">Reviews and the booking panel appear for guests once your listing is live.</p>
    </div>
  );
}
