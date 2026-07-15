import Link from "next/link";
import { FileText } from "lucide-react";
import type { PartnerDashboardData } from "@/lib/data/partner";
import { MonthPicker } from "./MonthPicker";
import { PerformanceCard } from "./PerformanceCard";
import { RecoveryBar } from "./RecoveryBar";
import { BookingList } from "./BookingList";
import { PayoutList } from "./PayoutList";
import { AvailableCard } from "./AvailableCard";
import { TrendChart } from "./TrendChart";
import { BookingCalendar } from "./BookingCalendar";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The full read-only view of one partner property. Shared by the single-property
// /partner home and the /partner/properties/[id] detail so there's one source of
// truth. `monthBase` is the route the month picker pushes onto; the statement link
// always lives under /partner/properties/[id].
export function PropertyDashboard({ data, months, monthBase }: { data: PartnerDashboardData; months: string[]; monthBase: string }) {
  const { property, month, performance, bookings, occupancy, payouts, trend, available } = data;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{property.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {property.area ?? ""}
            {property.status ? ` · ${cap(property.status)}` : ""}
          </p>
        </div>
        <MonthPicker basePath={monthBase} months={months} current={month} />
      </div>

      {!performance ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No performance is recorded for this month yet.
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
            <AvailableCard available={available} />
            <TrendChart points={trend} />
          </div>

          <PerformanceCard p={performance} occupancy={occupancy} bookingsCount={bookings.length} />

          {performance.recovery && <RecoveryBar r={performance.recovery} />}

          <div>
            <Link
              href={`/partner/properties/${property.id}/statement/${month}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-line-hi"
            >
              <FileText size={15} className="text-gold-deep" /> Download statement
            </Link>
          </div>
        </div>
      )}

      <section className="mt-8">
        <BookingCalendar month={month} bookings={bookings} />
      </section>

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
