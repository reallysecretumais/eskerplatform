import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Users, BedDouble, ShieldCheck } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { JsonLd } from "@/components/JsonLd";
import { listingLd, breadcrumbLd, listingOgImage } from "@/lib/seo";
import { Gallery } from "@/components/Gallery";
import { BookingWidget } from "@/components/BookingWidget";
import { AmenityList } from "@/components/AmenityList";
import { PropertyConcierge } from "@/components/PropertyConcierge";
import { ChatEntry } from "@/components/chat/ChatEntry";
import { PakistanDetails } from "@/components/PakistanDetails";
import { LocationSection } from "@/components/LocationSection";
import { Reviews } from "@/components/Reviews";
import { TrackEvent } from "@/components/TrackEvent";
import { getListing, getListings, getAvailability, slimListings } from "@/lib/data/listings";
import { getReviews } from "@/lib/data/reviews";
import { getAccount } from "@/lib/auth";
import { unitForCategory, formatPrice } from "@/lib/listings";
import { brand } from "@/lib/brand";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Stay not found" };
  const where = listing.area ?? brand.launchCities[0];
  const title = `${listing.title} — ${where}`;
  const description =
    (listing.description?.trim().slice(0, 200)) ||
    `${listing.category ?? "Premium stay"} in ${where}, ${brand.launchCities[0]}. ${listing.esker_exclusive ? `${brand.exclusiveTier} — professionally managed. ` : ""}Book with ${brand.name}.`;
  const img = listingOgImage(listing);
  const url = `/stays/${id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: `${title} · ${brand.name}`, description, url, images: [{ url: img, width: 1200, height: 630, alt: listing.title }] },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}

export default async function StayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const busy = await getAvailability(id);
  const all = await getListings();
  const account = await getAccount();
  const { reviews, summary } = await getReviews(id);
  const { amount, unit } = formatPrice(listing.price, unitForCategory(listing.category ?? ""));

  return (
    <main className="min-h-full pb-28 lg:pb-16">
      <JsonLd data={[listingLd(listing, summary), breadcrumbLd([{ name: "Home", path: "/" }, { name: "Stays", path: "/stays" }, { name: listing.title, path: `/stays/${id}` }])]} />
      <TrackEvent event="ViewContent" params={{ content_ids: [id], content_type: "product", value: listing.price, currency: "PKR" }} />
      <SiteNav theme="light" account={account} />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/stays" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> All stays
        </Link>

        {/* Title row */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {listing.esker_exclusive && (
                <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-medium text-ink">Esker Exclusive</span>
              )}
              {listing.category && <span className="text-xs uppercase tracking-wider text-dim">{listing.category}</span>}
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{listing.title}</h1>
            <div className="mt-1.5 flex items-center gap-1 text-sm text-muted">
              <MapPin size={15} /> {listing.area}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="font-display text-2xl font-semibold text-ink tnum">{amount}</div>
            <div className="text-xs text-dim">per {unit}</div>
          </div>
        </div>

        {/* Gallery */}
        <div className="mt-5">
          <Gallery photos={listing.photos ?? []} title={listing.title} />
        </div>

        {/* Ask about this place — contextual concierge (slim props — the AI
            catalog itself is built server-side in /api/concierge) */}
        <div className="mt-6">
          <PropertyConcierge property={slimListings([listing])[0]} listings={slimListings(all)} />
          <div className="mt-2 px-1">
            <ChatEntry label="Message us about this place" propertyId={listing.id} />
          </div>
        </div>

        {/* Body */}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:order-1 lg:col-span-2">
            {/* Quick facts */}
            <div className="flex flex-wrap gap-5 text-sm text-ink">
              {listing.capacity ? (
                <span className="inline-flex items-center gap-1.5"><Users size={16} className="text-gold" /> Sleeps {listing.capacity}</span>
              ) : null}
              {listing.bedrooms ? (
                <span className="inline-flex items-center gap-1.5"><BedDouble size={16} className="text-gold" /> {listing.bedrooms} bed{listing.bedrooms > 1 ? "s" : ""}</span>
              ) : null}
              {listing.type ? <span className="text-muted">{listing.type}</span> : null}
            </div>

            {/* Esker Exclusive guarantee */}
            {listing.esker_exclusive && (
              <div className="flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-gold" strokeWidth={1.75} />
                <div>
                  <div className="font-display text-base font-semibold tracking-tight text-ink">Esker Exclusive</div>
                  <p className="mt-0.5 text-sm text-muted">
                    Professionally managed by Esker — inspected and run to a guaranteed standard. Pay with{" "}
                    {brand.payments.slice(0, 3).join(", ")}; your payment is held securely and released after check-in.
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            {listing.description && (
              <section>
                <h2 className="mb-2 font-display text-lg font-semibold tracking-tight text-ink">About this place</h2>
                <p className="text-[15px] leading-relaxed text-muted">{listing.description}</p>
              </section>
            )}

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Amenities</h2>
                <AmenityList amenities={listing.amenities} />
              </section>
            )}

            {/* Built for Pakistan (§8) */}
            <PakistanDetails facts={listing.public_facts} />

            {/* Where you'll be (§6) */}
            <LocationSection area={listing.area} />

            {/* Reviews (curated now; post-stay later) */}
            <Reviews reviews={reviews} summary={summary} exclusive={listing.esker_exclusive} />
          </div>

          {/* Booking widget */}
          <aside className="order-first lg:order-2 lg:sticky lg:top-24 lg:self-start">
            <BookingWidget
              id={listing.id}
              title={listing.title}
              price={listing.price}
              unit={unitForCategory(listing.category ?? "")}
              capacity={listing.capacity}
              busy={busy}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
