import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getHostIdVerified } from "@/lib/data/host";
import { ListingForm } from "@/components/host/ListingForm";

export const metadata = { title: "New listing — Esker" };

export default async function NewListingPage() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  // Both verification gates must be done first (the dashboard walks them through it).
  const idVerified = await getHostIdVerified();
  if (!account.phoneVerified || !idVerified) redirect("/host");

  return (
    <div className="max-w-2xl">
      <Link href="/host/listings" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ChevronLeft size={16} /> Your listings
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">List your place</h1>
      <p className="mt-1 text-sm text-muted">Free to list. We review every listing before it goes live — usually within a day.</p>

      <div className="mt-6">
        <ListingForm />
      </div>
    </div>
  );
}
