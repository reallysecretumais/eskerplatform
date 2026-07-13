import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import {
  assertPartnerProperty,
  getPartnerPerformance,
  getPartnerBookings,
  getPartnerPayouts,
  occupancyPct,
  currentPktMonth,
  recentMonths,
} from "@/lib/data/partner";
import { PerformanceCard } from "@/components/partner/PerformanceCard";
import { RecoveryBar } from "@/components/partner/RecoveryBar";
import { BookingList } from "@/components/partner/BookingList";
import { PayoutList } from "@/components/partner/PayoutList";
import { MonthPicker } from "@/components/partner/MonthPicker";

export const metadata = { title: "Property — Esker" };

export default async function PartnerPropertyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const account = await requireAccount();
  if (!account.roles.includes("partner")) redirect("/partner");

  const { id } = await params;
  const property = await assertPartnerProperty(id);
  if (!property) notFound();

  const months = recentMonths(12);
  const requested = (await searchParams).month;
  const month = requested && months.includes(requested) ? requested : currentPktMonth();
  const basePath = `/partner/properties/${id}`;

  const [performance, bookings, payouts] = await Promise.all([
    getPartnerPerformance(id, month),
    getPartnerBookings(id, month),
    getPartnerPayouts(id),
  ]);
  const occupancy = occupancyPct(bookings, month);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{property.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {property.area ?? ""}
            {property.status ? ` · ${capitalize(property.status)}` : ""}
          </p>
        </div>
        <MonthPicker basePath={basePath} months={months} current={month} />
      </div>

      {!performance ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No performance is recorded for this month yet.
        </div>
      ) : (
        <>
          <div className="mt-6">
            <PerformanceCard p={performance} occupancy={occupancy} bookingsCount={bookings.length} />
          </div>

          {performance.recovery && (
            <div className="mt-6">
              <RecoveryBar r={performance.recovery} />
            </div>
          )}

          <div className="mt-4">
            <Link
              href={`${basePath}/statement/${month}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-line-hi"
            >
              <FileText size={15} className="text-gold-deep" /> Download statement
            </Link>
          </div>
        </>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Bookings</h2>
        <BookingList bookings={bookings} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Payouts</h2>
        <PayoutList payouts={payouts} />
      </section>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
