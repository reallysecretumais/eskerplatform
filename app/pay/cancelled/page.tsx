import { brand } from "@/lib/brand";

/** The payer backed out at the gateway. The link still works — "come back",
 *  never "failed". Public. */
export const dynamic = "force-static";

export default function PayCancelledPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Payment not completed</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          No money was taken. Your payment link still works whenever you&apos;re ready — just tap it again, or message
          the {brand.name} team on WhatsApp and we&apos;ll help.
        </p>
      </div>
    </main>
  );
}
