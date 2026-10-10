import { redirect } from "next/navigation";
import { hasAccess } from "./access";
import { readName, readSelection, type SearchParams } from "./selection";
import { Gate } from "@/components/invest/Gate";
import { InvestPage } from "@/components/invest/InvestPage";
import { Suspense } from "react";
import { PulseLive, PulseWaiting } from "@/components/invest/PulseLive";

export const dynamic = "force-dynamic";

/**
 * /invest — the investor page Umais and Hamza send to leads and open in
 * meetings. Private: behind an access code, noindex, absent from nav and
 * sitemap. `?k=CODE` in a shared link unlocks the device in one tap (via
 * /invest/enter, which can set cookies); `?for=Name` greets the investor.
 */
export default async function Invest({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  if (!(await hasAccess())) {
    if (sp.k) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
      redirect(`/invest/enter?${qs}`);
    }
    return <Gate denied={sp.denied === "1"} />;
  }
  // The live line streams in on its own; the CRM round-trip never delays the page.
  const pulseSlot = (
    <Suspense fallback={<PulseWaiting />}>
      <PulseLive />
    </Suspense>
  );
  return (
    <main>
      <InvestPage initial={readSelection(sp)} name={readName(sp)} pulseSlot={pulseSlot} />
    </main>
  );
}
