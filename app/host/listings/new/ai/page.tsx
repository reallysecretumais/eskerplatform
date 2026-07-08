import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { getHostIdVerified } from "@/lib/data/host";
import { ListingInterview } from "@/components/host/ListingInterview";

export const metadata = { title: "List with AI — Esker" };

export default async function NewListingAiPage() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");
  const idVerified = await getHostIdVerified();
  if (!account.phoneVerified || !idVerified) redirect("/host");

  return (
    <div>
      <Link href="/host/listings/new" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ChevronLeft size={16} /> Back
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">Tell me about your place</h1>
      <p className="mt-1 text-sm text-muted">Chat naturally — English ya Roman Urdu, dono chalte hain. Your listing builds itself on the right.</p>

      <div className="mt-6">
        <ListingInterview />
      </div>
    </div>
  );
}
