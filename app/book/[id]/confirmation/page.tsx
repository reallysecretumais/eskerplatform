import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, ShieldCheck } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { getAccount } from "@/lib/auth";

export const metadata: Metadata = { title: "Booking received", robots: { index: false, follow: false } };

export default async function ConfirmationPage() {
  const account = await getAccount();

  return (
    <main className="min-h-full">
      <SiteNav theme="light" account={account} />

      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <CircleCheck size={48} className="mx-auto text-gold" strokeWidth={1.5} />
        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">Booking received</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Thank you! Your booking is in — our team is verifying your payment and will confirm shortly.
        </p>

        <div className="mt-8 space-y-3 rounded-2xl border border-line bg-surface p-5 text-left text-sm">
          <Step n={1} title="We verify your payment" body="Your dates are held for you while the team checks your screenshot against the transfer — usually within a few hours." />
          <Step n={2} title="You're confirmed" body="You'll get a confirmation, then check-in details before your stay." />
          <Step n={3} title="Held safely until check-in" body="Your payment is held securely and only released to the property after you check in." icon />
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {account && (
            <Link href="/account" className="rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-105">
              View my bookings
            </Link>
          )}
          <Link href="/stays" className="rounded-xl border border-line px-5 py-2.5 text-sm text-ink transition hover:bg-surface-2">
            Browse more stays
          </Link>
        </div>
      </div>
    </main>
  );
}

function Step({ n, title, body, icon }: { n: number; title: string; body: string; icon?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-medium text-gold-deep">
        {icon ? <ShieldCheck size={13} className="text-gold" /> : n}
      </span>
      <div>
        <div className="font-medium text-ink">{title}</div>
        <p className="text-muted">{body}</p>
      </div>
    </div>
  );
}
