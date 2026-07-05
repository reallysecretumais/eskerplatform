import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { ChatEntry } from "@/components/chat/ChatEntry";
import { requireAccount, getMyBookings, type AccountRole, type MyBooking } from "@/lib/auth";
import { thumb } from "@/lib/img";
import { signOut, becomeHost } from "./actions";

const ROLE_LABEL: Record<AccountRole, string> = { guest: "Guest", owner: "Host", partner: "Partner" };

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting verification",
  payment_collected: "Payment confirmed",
  handed_over: "Confirmed",
  awaiting_checkin: "Confirmed",
  currently_staying: "Staying now",
  checked_out: "Completed",
  cancelled: "Cancelled",
  needs_attention: "Needs attention",
  in_progress: "Pending",
};

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

export default async function AccountPage() {
  const account = await requireAccount();
  const bookings = await getMyBookings();
  const isOwner = account.roles.includes("owner");
  const isPartner = account.roles.includes("partner");

  return (
    <main className="min-h-full">
      <SiteNav theme="light" account={account} />

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Your account</h1>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <div className="text-xs uppercase tracking-wider text-dim">Signed in as</div>
          <div className="mt-1 text-lg font-medium text-ink">{account.name || account.email || "Guest"}</div>
          {account.email && <div className="text-sm text-muted">{account.email}</div>}
          {account.phone && <div className="text-sm text-muted">{account.phone}</div>}
          {account.roles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {account.roles.map((r) => (
                <span key={r} className="rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-gold-deep">{ROLE_LABEL[r]}</span>
              ))}
            </div>
          )}
        </div>

        {/* My bookings */}
        <h2 className="mb-3 mt-8 font-display text-lg font-semibold tracking-tight text-ink">Your bookings</h2>
        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="text-sm text-muted">No bookings yet.</p>
            <Link href="/stays" className="mt-2 inline-block text-sm text-gold-deep hover:underline">Browse stays</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </div>
        )}

        {/* Role panels */}
        {(isOwner || isPartner) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {isOwner && <Panel title="Your listings" body="Your host dashboard is coming soon — list and manage your places here." />}
            {isPartner && <Panel title="Your investment" body="Your read-only performance view is coming soon." />}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {!isOwner && (
            <form action={becomeHost}>
              <button type="submit" className="rounded-xl border border-line px-4 py-2 text-sm text-ink transition hover:bg-surface-2">Become a host</button>
            </form>
          )}
          <form action={signOut}>
            <button type="submit" className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink">Sign out</button>
          </form>
        </div>
      </div>
    </main>
  );
}

function BookingRow({ b }: { b: MyBooking }) {
  const photo = b.listing?.photos?.[0];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3">
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: "#e7e1d6", backgroundImage: photo ? `url(${thumb(photo, 240, 65)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{b.listing?.title ?? "Your stay"}</div>
        <div className="text-xs text-muted">{fmt(b.checkin)} – {fmt(b.checkout)} · ₨{b.amount.toLocaleString("en-PK")}</div>
        <ChatEntry label="Chat about this booking" bookingId={b.id} className="mt-1 !text-xs" />
      </div>
      <span className="shrink-0 rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold-deep">{STATUS_LABEL[b.status] ?? b.status}</span>
    </div>
  );
}

function Panel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="font-display text-base font-semibold tracking-tight text-ink">{title}</div>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
