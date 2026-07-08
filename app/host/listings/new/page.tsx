import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, PencilLine, Sparkles, ArrowRight } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getHostIdVerified } from "@/lib/data/host";

export const metadata = { title: "New listing — Esker" };

// The fork: list it yourself (form → draft → photos) or let the AI interview
// you and draft the listing from the conversation.
export default async function NewListingChooser() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  const idVerified = await getHostIdVerified();
  if (!account.phoneVerified || !idVerified) redirect("/host");

  return (
    <div className="max-w-2xl">
      <Link href="/host/listings" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ChevronLeft size={16} /> Your listings
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">List your place</h1>
      <p className="mt-1 text-sm text-muted">Free to list. Pick how you&apos;d like to start:</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/host/listings/new/ai"
          className="group relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/[0.1] to-transparent p-6 transition hover:border-gold/60 hover:shadow-lg"
        >
          <span className="absolute right-4 top-4 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-deep">New</span>
          <Sparkles size={22} className="text-gold-deep" />
          <div className="mt-3 font-display text-lg font-semibold tracking-tight text-ink">Let AI help you list</div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Have a quick chat about your place — watch your listing write itself as you talk. About 2 minutes.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold-deep transition group-hover:gap-2">
            Start the chat <ArrowRight size={14} />
          </span>
        </Link>

        <Link
          href="/host/listings/new/manual"
          className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-line-hi hover:shadow-lg"
        >
          <PencilLine size={22} className="text-muted" />
          <div className="mt-3 font-display text-lg font-semibold tracking-tight text-ink">List it yourself</div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Fill in the details with a clean form — title, area, price, amenities, description.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-ink transition group-hover:gap-2">
            Open the form <ArrowRight size={14} />
          </span>
        </Link>
      </div>

      <p className="mt-5 text-xs text-dim">Either way you&apos;ll add photos next, and we review every listing before it goes live.</p>
    </div>
  );
}
