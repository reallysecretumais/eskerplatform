import { brand } from "@/lib/brand";

/** Terminal pay-link states on the brand domain — already paid, cancelled,
 *  invalid, or gateway trouble. Calm wording: a guest re-tapping an old link
 *  after paying must read "all good", never "error". */
export const dynamic = "force-dynamic";

const COPY: Record<string, { title: string; body: string }> = {
  paid: {
    title: "Payment already received",
    body: "This payment has already been made — there's nothing more to pay on this link. Your confirmation was sent on WhatsApp.",
  },
  cancelled: {
    title: "This payment link is no longer active",
    body: "It may have been replaced with a newer one. Please check your chat for the latest link, or message us and we'll send a fresh one.",
  },
  invalid: {
    title: "This link isn't valid",
    body: "It may have been mistyped. Please use the exact link from your chat, or message us for a fresh one.",
  },
  unavailable: {
    title: "Online payment is briefly unavailable",
    body: "Please try again in a little while, or message us on WhatsApp — we'll help you complete the payment another way.",
  },
  error: {
    title: "We couldn't start the payment",
    body: "Nothing was charged. Please try the link again in a moment, or message us on WhatsApp and we'll help.",
  },
};

export default async function PayClosedPage({ searchParams }: { searchParams: Promise<{ why?: string }> }) {
  const { why } = await searchParams;
  const c = COPY[why ?? ""] ?? COPY.invalid;
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink">{c.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{c.body}</p>
        <p className="mt-4 text-xs text-dim">{brand.name}</p>
      </div>
    </main>
  );
}
