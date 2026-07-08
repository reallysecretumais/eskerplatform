import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getHostBookings, type HostStay } from "@/lib/data/host";
import { StatusBadge } from "@/components/account/StatusBadge";

export const metadata = { title: "Bookings — Esker" };

const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const isPast = (b: HostStay) => b.status === "checked_out" || b.status === "cancelled";

// The host's bookings across all their listings — read-only, guest first names
// only. Esker collects + verifies payments; the host sees the state clearly.
export default async function HostBookingsPage() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  const bookings = await getHostBookings();

  const upcoming = bookings.filter((b) => !isPast(b)).sort((a, b) => (a.checkin ?? "").localeCompare(b.checkin ?? ""));
  const past = bookings.filter(isPast);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Bookings</h1>
      <p className="mt-1 text-sm text-muted">Every stay across your listings. Esker collects and verifies payments; you host.</p>

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center">
          <CalendarDays size={20} className="mx-auto text-dim" />
          <p className="mt-2 text-sm text-muted">No bookings yet — they&apos;ll appear here as guests book your listings.</p>
        </div>
      ) : (
        <>
          <Section title="Upcoming & current" rows={upcoming} empty="Nothing upcoming right now." />
          <Section title="Past" rows={past} empty="No past stays yet." />
        </>
      )}
    </div>
  );
}

function Section({ title, rows, empty }: { title: string; rows: HostStay[]; empty: string }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-dim">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 font-display text-sm font-semibold text-gold-deep">
                {b.guestFirstName[0]?.toUpperCase() ?? "G"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">
                  {b.guestFirstName} · {b.listingTitle}
                </div>
                <div className="text-xs text-muted">
                  {fmt(b.checkin)} – {fmt(b.checkout)} · {b.nights ?? 0} {b.nights === 1 ? "night" : "nights"}
                </div>
                <div className="mt-1"><StatusBadge status={b.status} /></div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-sm font-semibold text-ink tabular-nums">{pkr(b.amount)}</div>
                <div className="text-[11px] text-dim tabular-nums">{b.advancePaid > 0 ? `${pkr(b.advancePaid)} collected` : "advance pending"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
