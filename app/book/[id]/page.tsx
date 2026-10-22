import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getListing, getAvailability, AvailabilityUnavailable } from "@/lib/data/listings";
import { getAccount } from "@/lib/auth";
import { formatPrice } from "@/lib/listings";
import { advanceAmount, advanceLabel as advancePctLabel } from "@/lib/payments";
import { isSafepayConfigured } from "@/lib/safepay";
import { crop } from "@/lib/img";
import { stayPath } from "@/lib/slug";
import { TrackEvent } from "@/components/TrackEvent";
import type { Metadata } from "next";
import { getBankAccounts } from "@/lib/data/bankAccounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { blocksDates, isExpiringHold } from "@/lib/booking/hold";
import { realEmail, realName } from "@/lib/booking/create";

export const metadata: Metadata = { title: "Confirm & pay", robots: { index: false, follow: false } };

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function bookedSet(busy: { start_date: string; end_date: string }[]): Set<string> {
  const s = new Set<string>();
  for (const r of busy) {
    const d = new Date(`${r.start_date}T00:00:00`);
    const end = new Date(`${r.end_date}T00:00:00`);
    let g = 0;
    while (d < end && g++ < 400) {
      s.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  }
  return s;
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkin?: string; checkout?: string; resume?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const checkin = sp.checkin ?? "";
  const checkout = sp.checkout ?? "";

  const listing = await getListing(id);
  if (!listing) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const nights =
    checkin && checkout ? Math.round((new Date(`${checkout}T00:00:00`).getTime() - new Date(`${checkin}T00:00:00`).getTime()) / 86_400_000) : 0;
  if (!checkin || !checkout || checkin < today || nights < 1) redirect(`/stays/${id}`);

  // Don't allow checkout for taken dates — except the guest's own card hold,
  // when Safepay sends them back here after a payment that didn't go through.
  const busy = await getAvailability(id).catch((e) => {
    if (e instanceof AvailabilityUnavailable) return null;
    throw e;
  });
  // We couldn't read the calendar: say so, and don't take a booking we can't
  // stand behind (createBooking would re-check, but the guest shouldn't fill a
  // whole form first).
  if (busy === null) {
    const account = await getAccount();
    return (
      <main className="min-h-full pb-16">
        <SiteNav theme="light" account={account} />
        <div className="mx-auto max-w-xl px-5 py-16 text-center sm:px-6">
          <h1 className="headline text-[34px]">We couldn&apos;t check these dates</h1>
          <p className="mt-3 text-muted">Our availability check didn&apos;t answer just now. Please try again in a moment.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={`/book/${id}?checkin=${checkin}&checkout=${checkout}`}
              className="inline-flex h-12 items-center rounded-full bg-brand px-6 text-[15px] font-bold text-warm transition-colors hover:bg-brand-pressed"
            >
              Try again
            </Link>
            <Link href={stayPath(listing)} className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)] hover:text-brand">
              Back to the stay
            </Link>
          </div>
        </div>
      </main>
    );
  }
  const resumed = sp.resume ? await ownHold(sp.resume, id, checkin, checkout) : false;
  // Where a transfer should go — the CRM's Settings, read server-side because
  // CheckoutForm is a client component.
  const accounts = await getBankAccounts();
  const booked = bookedSet(busy);
  if (!resumed) {
    for (let d = new Date(`${checkin}T00:00:00`), g = 0; d < new Date(`${checkout}T00:00:00`) && g < 400; d.setDate(d.getDate() + 1), g++) {
      if (booked.has(d.toISOString().slice(0, 10))) redirect(`/stays/${id}`);
    }
  }

  const price = listing.price;
  const total = price * nights;
  const unit = listing.price_unit;
  const totalLabel = formatPrice(total, unit).amount;
  const exclusive = listing.esker_exclusive;
  const advance = advanceAmount(total, exclusive);
  const balance = total - advance;
  const advanceLabel = formatPrice(advance, unit).amount;
  const balanceLabel = formatPrice(balance, unit).amount;
  const pctLabel = advancePctLabel(total, exclusive);
  const account = await getAccount();
  // Never prefill WhatsApp sign-up's placeholders ("Guest", a no-mail address).
  const prefill = { name: realName(account?.name), email: realEmail(account?.email), phone: account?.phone ?? "" };

  return (
    <main className="min-h-full pb-16">
      <SiteNav theme="light" account={account} />
      <TrackEvent event="InitiateCheckout" params={{ content_ids: [id], value: advance, currency: "PKR" }} />

      <div className="mx-auto max-w-[1104px] px-5 py-8 sm:px-6">
        <Link href={stayPath(listing)} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft size={15} /> Back to the stay
        </Link>
        <h1 className="headline mt-4 text-[clamp(34px,4.4vw,44px)]">Confirm and pay</h1>

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CheckoutForm propertyId={id} checkin={checkin} checkout={checkout} advanceLabel={advanceLabel} balanceLabel={balanceLabel} pctLabel={pctLabel} prefill={prefill} accounts={accounts} safepayReady={isSafepayConfigured()} cardDeclined={resumed} />
          </div>

          {/* Order summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-[22px] bg-surface shadow-[0_1px_0_var(--color-line)]">
              <div className="relative h-40 bg-surface-2">
                {listing.photos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase transforms are the image CDN
                  <img src={crop(listing.photos[0], 720, 320)} alt={listing.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <div className="text-[17px] font-bold leading-tight text-ink">{listing.title}</div>
                  <div className="mt-0.5 text-sm text-dim">{[listing.category, [listing.area, listing.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="space-y-1.5 border-t border-line pt-3 text-sm">
                  <Row label="Check-in" value={fmt(checkin)} />
                  <Row label="Check-out" value={fmt(checkout)} />
                  <Row label={`${formatPrice(price, unit).amount} × ${nights} ${nights === 1 ? "night" : "nights"}`} value={totalLabel} />
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <span className="text-sm font-semibold text-ink">Total</span>
                  <span className="tnum text-[15px] font-bold text-ink">{totalLabel}</span>
                </div>
                <div className="rounded-[18px] bg-ice-tint p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-brand-ink">Pay now <span className="font-medium">({pctLabel})</span></span>
                    <span className="tnum text-xl font-bold text-brand">{advanceLabel}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between text-[13px] text-brand-ink">
                    <span>At check-in</span>
                    <span className="tnum">{balanceLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

/**
 * Is `bookingId` a still-live unpaid website hold on exactly these nights of
 * this stay? That is the booking the guest just tried to pay by card; its own
 * hold must not read as "taken" to them. createBooking applies the same
 * own-hold rule server-side, so this only decides what the page shows.
 * The id is a v4 uuid that only reaches this guest, via Safepay's cancel link.
 */
async function ownHold(bookingId: string, listingId: string, checkin: string, checkout: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return false;
  const { data } = await createAdminClient()
    .from("bookings")
    .select("status, source, created_at, hold_until, lost_reason, checkin, checkout, property_id, external_property_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!data || data.lost_reason) return false;
  const sameStay = data.property_id === listingId || data.external_property_id === listingId;
  const sameNights = String(data.checkin).slice(0, 10) === checkin && String(data.checkout).slice(0, 10) === checkout;
  return sameStay && sameNights && isExpiringHold(data) && blocksDates(data);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink tnum">{value}</span>
    </div>
  );
}
