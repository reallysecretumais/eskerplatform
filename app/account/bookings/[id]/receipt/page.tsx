import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getMyBooking, requireAccount } from "@/lib/auth";
import { EskerLogo } from "@/components/EskerLogo";
import { PrintButton } from "@/components/account/PrintButton";
import { statusLabel } from "@/lib/bookingStatus";
import { support } from "@/lib/payments";

export const metadata = { title: "Receipt — Esker" };

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const pkr = (n: number) => `₨${n.toLocaleString("en-PK")}`;
const ref = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [account, b] = await Promise.all([requireAccount(), getMyBooking(id)]);
  if (!b) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/account/bookings/${b.id}`} className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
          <ChevronLeft size={16} /> Back to booking
        </Link>
        <PrintButton />
      </div>

      {/* Receipt document */}
      <article className="mt-4 rounded-2xl border border-line bg-surface p-6 text-ink sm:p-8 print:mt-0 print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="flex items-start justify-between border-b border-line pb-5 print:border-black/15">
          <EskerLogo />
          <div className="text-right">
            <div className="font-display text-base font-semibold">Receipt</div>
            <div className="text-xs text-muted print:text-black/60">No. {ref(b.id)}</div>
            <div className="text-xs text-muted print:text-black/60">Issued {fmt(new Date().toISOString().slice(0, 10))}</div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-dim print:text-black/50">Billed to</div>
            <div className="mt-1 font-medium">{account.name || "Guest"}</div>
            {account.email && <div className="text-muted print:text-black/60">{account.email}</div>}
            {account.phone && <div className="text-muted print:text-black/60">{account.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-dim print:text-black/50">Status</div>
            <div className="mt-1 font-medium">{statusLabel(b.status)}</div>
            <div className="text-muted print:text-black/60">Source: {b.source ?? "Website"}</div>
          </div>
        </div>

        <div className="rounded-xl border border-line print:border-black/15">
          <div className="border-b border-line px-4 py-3 print:border-black/15">
            <div className="font-display font-semibold">{b.listing?.title ?? "Esker stay"}</div>
            <div className="text-sm text-muted print:text-black/60">
              {fmt(b.checkin)} → {fmt(b.checkout)} · {b.nights ?? 0} {b.nights === 1 ? "night" : "nights"}
              {b.rateAtBooking ? ` · ${pkr(b.rateAtBooking)}/night` : ""}
            </div>
          </div>
          <div className="px-4 py-3 text-sm">
            <Line label="Stay total" value={pkr(b.amount)} />
            <Line label="Advance paid" value={`− ${pkr(b.advancePaid)}`} />
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2 print:border-black/15">
              <span className="font-medium">{b.balance > 0 ? "Balance due at check-in" : "Balance"}</span>
              <span className="font-display text-base font-semibold tabular-nums">{b.balance > 0 ? pkr(b.balance) : pkr(0)}</span>
            </div>
          </div>
        </div>

        <footer className="mt-6 border-t border-line pt-4 text-xs text-muted print:border-black/15 print:text-black/60">
          Thank you for booking with Esker Rentals. Questions about this receipt? Email {support.email} or WhatsApp +{support.whatsapp}.
        </footer>
      </article>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted print:text-black/60">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
