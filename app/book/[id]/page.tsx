import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PromoProvider, OrderMoney } from "@/components/CheckoutPromo";
import { getListing, getAvailability, AvailabilityUnavailable } from "@/lib/data/listings";
import { getAccount } from "@/lib/auth";
import { rs } from "@/lib/listings";
import { quote, isQuoteError } from "@/lib/quote";
import { isSafepayConfigured } from "@/lib/safepay";
import { crop } from "@/lib/img";
import { stayPath } from "@/lib/slug";
import { TrackEvent } from "@/components/TrackEvent";
import type { Metadata } from "next";
import { getBankAccounts } from "@/lib/data/bankAccounts";
import { isOwnLiveHold, realEmail, realName } from "@/lib/booking/create";
import { CARD_HOLD_COOKIE } from "@/lib/booking/hold";

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
  // The one price calculation (lib/quote.ts), as the booking will charge it.
  const q = checkin && checkout ? quote({ mode: "nightly", price: listing.price, exclusive: listing.esker_exclusive, checkin, checkout }) : null;
  if (!q || isQuoteError(q) || checkin < today) redirect(`/stays/${id}`);

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
  // The guest's own card checkout, back from Safepay: named by its cancel link,
  // or (after Back) by the cookie this browser got when the checkout opened.
  const resumeId = sp.resume || (await cookies()).get(CARD_HOLD_COOKIE)?.value || "";
  const resumed = resumeId ? await isOwnLiveHold(resumeId, id, checkin, checkout) : false;
  // Where a transfer should go — the CRM's Settings, read server-side because
  // CheckoutForm is a client component.
  const accounts = await getBankAccounts();
  const booked = bookedSet(busy);
  if (!resumed) {
    for (let d = new Date(`${checkin}T00:00:00`), g = 0; d < new Date(`${checkout}T00:00:00`) && g < 400; d.setDate(d.getDate() + 1), g++) {
      if (booked.has(d.toISOString().slice(0, 10))) redirect(`/stays/${id}`);
    }
  }

  const nights = q.units;
  const account = await getAccount();
  // Never prefill WhatsApp sign-up's placeholders ("Guest", a no-mail address).
  const prefill = { name: realName(account?.name), email: realEmail(account?.email), phone: account?.phone ?? "" };

  return (
    <main className="min-h-full pb-16">
      <SiteNav theme="light" width="narrow" account={account} />
      <TrackEvent event="InitiateCheckout" params={{ content_ids: [id], value: q.advance, currency: "PKR" }} />

      <div className="mx-auto max-w-[1104px] px-5 py-8 sm:px-6">
        <Link href={stayPath(listing)} className="-my-2 inline-flex items-center gap-1 py-2 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft size={15} /> Back to the stay
        </Link>
        <h1 className="headline mt-4 text-[clamp(34px,4.4vw,44px)]">Confirm and pay</h1>

        <PromoProvider base={{ total: q.total, advance: q.advance, balance: q.balance }}>
        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CheckoutForm
              propertyId={id}
              checkin={checkin}
              checkout={checkout}
              advanceLabel={rs(q.advance)}
              pctLabel={q.advanceNote}
              prefill={prefill}
              accounts={accounts}
              safepayReady={isSafepayConfigured()}
              cardDeclined={resumed}
              resume={resumed ? resumeId : undefined}
            />
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
                </div>
                <OrderMoney rateLabel={`${rs(q.unitPrice)} × ${nights} ${nights === 1 ? "night" : "nights"}`} pctLabel={q.advanceNote} />
              </div>
            </div>
          </aside>
        </div>
        </PromoProvider>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink tnum">{value}</span>
    </div>
  );
}
