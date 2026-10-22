import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, ShieldCheck } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { ChatEntry } from "@/components/chat/ChatEntry";
import { getAccount } from "@/lib/auth";
import { holdLabel } from "@/lib/booking/hold";

export const metadata: Metadata = { title: "Booking received", robots: { index: false, follow: false } };

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ b?: string; via?: string }> }) {
  const account = await getAccount();
  const { b: bookingId, via } = await searchParams;
  // Safepay return: the gateway already took the payment; the webhook settles
  // it into the booking within moments — no screenshot, no manual verification.
  const paidOnline = via === "safepay";

  return (
    <main className="min-h-full">
      <SiteNav theme="light" account={account} />

      <div className="mx-auto max-w-xl px-5 py-16 text-center sm:px-6">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ice-tint">
          <CircleCheck size={32} className="text-brand" strokeWidth={1.8} />
        </span>
        <h1 className="headline mt-5 text-[40px]">
          {paidOnline ? "Payment received" : "Booking received"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          {paidOnline
            ? "Thank you. Your payment went through Safepay and your booking is confirming automatically."
            : "Thank you. Your booking is in, and our team is verifying your payment."}
        </p>

        <div className="mt-8 space-y-4 rounded-[22px] bg-surface p-5 text-left text-[15px] shadow-[0_1px_0_var(--color-line)]">
          {paidOnline ? (
            <Step n={1} title="Payment settled" body="Safepay has confirmed your payment — no screenshots, nothing to verify by hand." />
          ) : (
            <Step n={1} title="We verify your payment" body={`Your dates are held for ${holdLabel("transfer")} while the team checks your screenshot against the transfer.`} />
          )}
          <Step n={2} title="You're confirmed" body="You'll get a confirmation, then check-in details before your stay." />
          <Step n={3} title="Held, not handed over" body="Esker holds your advance until you check in." icon />
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {account && (
            <Link href="/account" className="inline-flex h-12 items-center rounded-full bg-brand px-6 text-[15px] font-bold text-warm transition-colors hover:bg-brand-pressed">
              View my bookings
            </Link>
          )}
          <Link href="/stays" className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)] transition-colors hover:text-brand">
            Browse more stays
          </Link>
        </div>

        {account && (
          <div className="mt-5">
            <ChatEntry label="Questions? Chat with us about this booking" bookingId={bookingId} />
          </div>
        )}
      </div>
    </main>
  );
}

function Step({ n, title, body, icon }: { n: number; title: string; body: string; icon?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ice-tint text-[13px] font-bold text-brand-ink">
        {icon ? <ShieldCheck size={14} /> : n}
      </span>
      <div>
        <div className="font-semibold text-ink">{title}</div>
        <p className="text-muted">{body}</p>
      </div>
    </div>
  );
}
