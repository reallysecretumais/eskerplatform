import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getListing, getAvailability } from "@/lib/data/listings";
import { getAccount } from "@/lib/auth";
import { unitForCategory, formatPrice } from "@/lib/listings";
import { advanceAmount } from "@/lib/payments";
import { thumb } from "@/lib/img";
import type { Metadata } from "next";

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
  searchParams: Promise<{ checkin?: string; checkout?: string }>;
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

  // Don't allow checkout for taken dates.
  const busy = await getAvailability(id);
  const booked = bookedSet(busy);
  for (let d = new Date(`${checkin}T00:00:00`), g = 0; d < new Date(`${checkout}T00:00:00`) && g < 400; d.setDate(d.getDate() + 1), g++) {
    if (booked.has(d.toISOString().slice(0, 10))) redirect(`/stays/${id}`);
  }

  const price = listing.price;
  const total = price * nights;
  const unit = unitForCategory(listing.category ?? "");
  const totalLabel = formatPrice(total, unit).amount;
  const exclusive = listing.esker_exclusive;
  const advance = advanceAmount(total, exclusive);
  const balance = total - advance;
  const advanceLabel = formatPrice(advance, unit).amount;
  const balanceLabel = formatPrice(balance, unit).amount;
  const pctLabel = exclusive ? "50%" : "25%";
  const account = await getAccount();
  const prefill = { name: account?.name ?? "", email: account?.email ?? "", phone: account?.phone ?? "" };

  return (
    <main className="min-h-full pb-16">
      <SiteNav theme="light" account={account} />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link href={`/stays/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> Back to the stay
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Confirm and pay</h1>

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CheckoutForm propertyId={id} checkin={checkin} checkout={checkout} advanceLabel={advanceLabel} balanceLabel={balanceLabel} pctLabel={pctLabel} prefill={prefill} />
          </div>

          {/* Order summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="relative h-36" style={{ backgroundColor: "#e7e1d6", backgroundImage: listing.photos?.[0] ? `url(${thumb(listing.photos[0], 600, 72)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
              <div className="space-y-3 p-4">
                <div>
                  <div className="text-sm font-medium text-ink">{listing.title}</div>
                  <div className="text-xs text-muted">{listing.category} · {listing.area}</div>
                </div>
                <div className="space-y-1.5 border-t border-line pt-3 text-sm">
                  <Row label="Check-in" value={fmt(checkin)} />
                  <Row label="Check-out" value={fmt(checkout)} />
                  <Row label={`${formatPrice(price, unit).amount} × ${nights} ${nights === 1 ? "night" : "nights"}`} value={totalLabel} />
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <span className="text-sm text-muted">Total</span>
                  <span className="text-sm text-ink tnum">{totalLabel}</span>
                </div>
                <div className="rounded-xl bg-surface-2/60 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-ink">Advance due now <span className="text-muted">({pctLabel})</span></span>
                    <span className="font-display text-lg font-semibold text-gold-deep tnum">{advanceLabel}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-xs text-muted">
                    <span>Balance at check-in</span>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink tnum">{value}</span>
    </div>
  );
}
