import { CircleCheck } from "lucide-react";
import { brand } from "@/lib/brand";

/** Safepay's success return for WhatsApp pay-links tapped on the brand domain.
 *  No data shown — the guest's real confirmation arrives on WhatsApp the
 *  moment the webhook settles. Safe to revisit or screenshot. */
export const dynamic = "force-static";

export default function PayDonePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center">
        <CircleCheck size={44} className="mx-auto text-gold" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-ink">Payment received</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Thank you — your payment has gone through. Your confirmation is on its way on WhatsApp from {brand.name}.
          You can close this page.
        </p>
      </div>
    </main>
  );
}
