import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin, Users, BedDouble, ShieldCheck } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { StayCard } from "@/components/StayCard";
import { areaLandingFor } from "@/lib/landings";
import { JsonLd } from "@/components/JsonLd";
import { listingLd, breadcrumbLd, listingOgImage, listingSummary } from "@/lib/seo";
import { stayPath, parseStayKey } from "@/lib/slug";
import { Gallery } from "@/components/Gallery";
import { BookingWidget } from "@/components/BookingWidget";
import { AmenityList } from "@/components/AmenityList";
import { PropertyConcierge } from "@/components/PropertyConcierge";
import { ChatEntry } from "@/components/chat/ChatEntry";
import { PakistanDetails } from "@/components/PakistanDetails";
import { LocationSection } from "@/components/LocationSection";
import { Reviews } from "@/components/Reviews";
import { TrackEvent } from "@/components/TrackEvent";
import { TrackListingView } from "@/components/TrackListingView";
import { findListingByParam, getListings, getAvailability, slimListings, getListingHost } from "@/lib/data/listings";
import { getExternalBookability } from "@/lib/data/externalBooking";
import { getWebsiteAi } from "@/lib/settings";
import { HostCard } from "@/components/HostCard";
import { getReviews } from "@/lib/data/reviews";
import { getAccount } from "@/lib/auth";
import { formatPrice } from "@/lib/listings";
import { brand } from "@/lib/brand";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await findListingByParam(id);
  if (!listing) return { title: "Stay not found" };
  // The listing's REAL geography (area, city) — never a hardcoded launch city,
  // or a Murree stay would be titled "…, Islamabad".
  const where = [listing.area, listing.city].filter(Boolean).join(", ") || "Pakistan";
  const title = `${listing.title} — ${listing.area ?? listing.city ?? brand.name}`;
  const description = (listing.description?.trim().slice(0, 200)) || listingSummary(listing);
  const img = listingOgImage(listing);
  // Always the slug path, never the requested one — a uuid link and a stale
  // slug must both point Google at the one canonical URL.
  const url = stayPath(listing);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: `${title} · ${brand.name}`, description, url, images: [{ url: img, width: 1200, height: 630, alt: listing.title }] },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}

export default async function StayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const listing = await findListingByParam(param);

  // A key we can read but no longer have a public listing for is almost always
  // a real listing that was unpublished or delisted — those URLs are shared on
  // WhatsApp and linked from ads, so send them somewhere useful instead of
  // dead-ending. A param we can't even parse is genuine junk: a true 404.
  if (!listing) {
    if (parseStayKey(param)) redirect("/stays");
    notFound();
  }

  // One canonical URL per listing. A legacy uuid link, or a slug left over from
  // an older title, permanently redirects to the current spelling.
  const canonical = stayPath(listing);
  if (`/stays/${param}` !== canonical) permanentRedirect(canonical);

  const id = listing.id;
  const busy = await getAvailability(id);
  const all = await getListings();
  const account = await getAccount();
  const { reviews, summary } = await getReviews(id);
  const host = await getListingHost(id);

  // Resale units can only be instant-booked while the owner's calendar sync is
  // fresh; otherwise the CTA asks the owner instead of taking payment for dates
  // Esker can't see. (createBooking enforces the same rule server-side.)
  const bookMode =
    listing.source === "external" ? (await getExternalBookability(id)).mode : "instant";

  const conciergeOn = (await getWebsiteAi()).concierge.enabled;
  const { amount, unit } = formatPrice(listing.price, listing.price_unit);

  // Related stays: same area first (the most useful comparison a guest can
  // make), then same category, closest in price. Pure over the cached list.
  const others = all.filter((l) => l.id !== id);
  const sameArea = others.filter((l) => l.area && l.area === listing.area);
  const sameCategory = others.filter((l) => !sameArea.includes(l) && l.category === listing.category);
  const byPrice = (a: typeof listing, b: typeof listing) =>
    Math.abs(a.price - listing.price) - Math.abs(b.price - listing.price);
  const related = [...sameArea.sort(byPrice), ...sameCategory.sort(byPrice)].slice(0, 3);
  const areaPage = areaLandingFor(listing, all);

  // Breadcrumb: Home › Stays › [area page, when one exists] › this listing.
  const breadcrumbTrail = [
    { name: "Home", path: "/" },
    { name: "Stays", path: "/stays" },
    ...(areaPage ? [{ name: areaPage.heading, path: `/${areaPage.slug}` }] : []),
    { name: listing.title, path: canonical },
  ];

  return (
    <main className="min-h-full pb-28 lg:pb-16">
      <JsonLd data={[listingLd(listing, summary), breadcrumbLd(breadcrumbTrail)]} />
      <TrackEvent event="ViewContent" params={{ content_ids: [id], content_type: "product", value: listing.price, currency: "PKR" }} />
      {/* Esker-run only: listing_views.property_id references `properties`, so a
          beacon for an EXTERNAL (resale) id would fail the FK. Those view counts
          only feed host dashboards, and external units aren't host listings. */}
      {listing.source !== "external" && <TrackListingView id={id} />}
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
          <Gallery
            photos={listing.photos ?? []}
            title={listing.title}
            where={[listing.area, listing.city].filter(Boolean).join(", ")}
            video={listing.video_url}
          />
        </div>

        {/* Ask about this place — contextual concierge (slim props — the AI
            catalog itself is built server-side in /api/concierge) */}
        {/* Concierge can be switched off from the CRM; the human chat entry below
            stays either way, so there's always a way to ask a question. */}
        <div className="mt-6">
          {conciergeOn && <PropertyConcierge property={slimListings([listing])[0]} listings={slimListings(all)} />}
          <div className={conciergeOn ? "mt-2 px-1" : "px-1"}>
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

            {/* Hosted by … (self-listed places only) */}
            {host && <HostCard host={host} />}

            {/* Reviews (curated now; post-stay later) */}
            <Reviews reviews={reviews} summary={summary} exclusive={listing.esker_exclusive} />

            {/* Related stays — the internal-linking layer. Every listing now
                links out to comparable ones and up to its area page, so no
                listing is a dead end for a guest OR a crawler. */}
            {related.length > 0 && (
              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                    {listing.area ? `More stays in ${listing.area}` : "More stays"}
                  </h2>
                  {areaPage && (
                    <Link href={`/${areaPage.slug}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
                      See all <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {related.map((r) => (
                    <StayCard
                      key={r.id}
                      title={r.title}
                      category={r.category ?? "Stay"}
                      area={r.area ?? ""}
                      city={r.city}
                      price={r.price}
                      priceUnit={r.price_unit}
                      exclusive={r.esker_exclusive}
                      photo={r.photos?.[0] ?? undefined}
                      href={stayPath(r)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Booking widget */}
          <aside className="order-first lg:order-2 lg:sticky lg:top-24 lg:self-start">
            <BookingWidget
              id={listing.id}
              title={listing.title}
              price={listing.price}
              unit={listing.price_unit}
              capacity={listing.capacity}
              busy={busy}
              bookMode={bookMode}
              signedIn={!!account}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
