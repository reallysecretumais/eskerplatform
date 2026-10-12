import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MapPin, Users, BedDouble, MessageCircle } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Gallery } from "@/components/Gallery";
import { AmenityList } from "@/components/AmenityList";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/listings";
import { company } from "@/lib/contact";
import { brand } from "@/lib/brand";

/**
 * A unit's PRIVATE photo page — eskerrentals.com/view/<token>.
 *
 * WhatsApp packs outside the free ad window send six photos and a link to the
 * rest (Esker OS, Oct 2026). A published unit links to its normal /stays page;
 * an UNPUBLISHED one (not ready, or the owner prefers it off the site) links
 * here instead. The token is a random per-unit value (phase94 `private_token`),
 * so the page is reachable only from a link we sent — never indexed, never in
 * the sitemap, never linked from the site. It shows the unit and a way to ask,
 * but no booking: unpublished units are booked through a person.
 */
export const dynamic = "force-dynamic";

type Unit = {
  id: string;
  title: string;
  area: string | null;
  bedrooms: number | null;
  capacity: number | null;
  price: number | null;
  photos: string[];
  video: string | null;
  description: string | null;
  amenities: string[];
  publicListing: boolean;
};

async function findUnit(token: string): Promise<Unit | null> {
  // Tokens are 32 hex characters; anything else is junk, not a lookup.
  if (!/^[0-9a-f]{32}$/i.test(token)) return null;
  const db = createAdminClient();
  const { data: own } = await db
    .from("properties")
    .select("id, name, short_name, public_title, public_description, bedrooms, capacity, nightly_rate, photos, video_url, amenities, public_listing, location:locations(name)")
    .eq("private_token", token)
    .maybeSingle();
  if (own) {
    const p = own as unknown as {
      id: string; name: string; short_name: string | null; public_title: string | null; public_description: string | null;
      bedrooms: number | null; capacity: number | null; nightly_rate: number | null; photos: string[] | null; video_url: string | null;
      amenities: string[] | null; public_listing: boolean | null; location: { name?: string } | null;
    };
    return {
      id: p.id,
      title: p.public_title || p.short_name || p.name,
      area: p.location?.name ?? null,
      bedrooms: p.bedrooms,
      capacity: p.capacity,
      price: p.nightly_rate,
      photos: p.photos ?? [],
      video: p.video_url,
      description: p.public_description,
      amenities: p.amenities ?? [],
      publicListing: !!p.public_listing,
    };
  }
  const { data: ext } = await db
    .from("external_properties")
    .select("id, name, public_title, public_description, bedrooms, capacity, public_price, typical_price, photo_urls, video_url, amenities, public_listing, active, location:locations(name)")
    .eq("private_token", token)
    .eq("active", true)
    .maybeSingle();
  if (!ext) return null;
  const e = ext as unknown as {
    id: string; name: string; public_title: string | null; public_description: string | null; bedrooms: number | null; capacity: number | null;
    public_price: number | null; typical_price: number | null; photo_urls: string[] | null; video_url: string | null; amenities: string[] | null;
    public_listing: boolean | null; location: { name?: string } | null;
  };
  return {
    id: e.id,
    title: e.public_title || e.name,
    area: e.location?.name ?? null,
    bedrooms: e.bedrooms,
    capacity: e.capacity,
    price: e.public_price ?? e.typical_price, // the guest price — never the owner's cost
    photos: e.photo_urls ?? [],
    video: e.video_url,
    description: e.public_description,
    amenities: e.amenities ?? [],
    publicListing: !!e.public_listing,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const unit = await findUnit(token);
  return {
    title: unit ? `${unit.title}${unit.area ? ` — ${unit.area}` : ""}` : "Stay not found",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  };
}

export default async function PrivateStayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const unit = await findUnit(token);
  if (!unit) notFound();
  // Published since the link was sent → the real page, where it can be booked.
  if (unit.publicListing) redirect(`/stays/${unit.id}`);

  const ask = `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(`Hi ${brand.name}, I'm interested in ${unit.title}. Is it available for my dates?`)}`;
  const price = unit.price ? formatPrice(unit.price, "night") : null;

  return (
    <main className="min-h-full pb-28 lg:pb-16">
      <SiteNav theme="light" />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{unit.title}</h1>
            {unit.area && (
              <div className="mt-1.5 flex items-center gap-1 text-sm text-muted">
                <MapPin size={15} /> {unit.area}
              </div>
            )}
          </div>
          {price && (
            <div className="shrink-0 sm:text-right">
              <div className="font-display text-2xl font-semibold text-ink tnum">{price.amount}</div>
              <div className="text-xs text-dim">per {price.unit}</div>
            </div>
          )}
        </div>

        <div className="mt-5">
          <Gallery photos={unit.photos} title={unit.title} where={unit.area} video={unit.video} />
        </div>

        <div className="mt-6">
          <a
            href={ask}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-bg transition hover:opacity-90"
          >
            <MessageCircle size={16} /> Ask about your dates on WhatsApp
          </a>
        </div>

        <div className="mt-8 max-w-3xl space-y-8">
          {(unit.capacity || unit.bedrooms) && (
            <div className="flex flex-wrap gap-5 text-sm text-ink">
              {unit.capacity ? (
                <span className="inline-flex items-center gap-1.5">
                  <Users size={16} className="text-gold" /> Sleeps {unit.capacity}
                </span>
              ) : null}
              {unit.bedrooms ? (
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble size={16} className="text-gold" /> {unit.bedrooms} bed{unit.bedrooms > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          )}

          {unit.description && (
            <section>
              <h2 className="mb-2 font-display text-lg font-semibold tracking-tight text-ink">About this place</h2>
              <p className="text-[15px] leading-relaxed text-muted">{unit.description}</p>
            </section>
          )}

          {unit.amenities.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Amenities</h2>
              <AmenityList amenities={unit.amenities} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
