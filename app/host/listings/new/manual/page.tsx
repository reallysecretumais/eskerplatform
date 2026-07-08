import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getHostIdVerified, getCoveredAreas } from "@/lib/data/host";
import { ListingForm } from "@/components/host/ListingForm";

export const metadata = { title: "New listing — Esker" };

export default async function NewListingManualPage() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  const [idVerified, areas] = await Promise.all([getHostIdVerified(), getCoveredAreas()]);
  if (!account.phoneVerified || !idVerified) redirect("/host");

  return (
    <div className="max-w-2xl">
      <Link href="/host/listings/new" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ChevronLeft size={16} /> Back
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">List your place</h1>
      <p className="mt-1 text-sm text-muted">The basics first — photos, availability and guest info come next.</p>

      <div className="mt-6">
        <ListingForm areas={areas} />
      </div>
    </div>
  );
}
