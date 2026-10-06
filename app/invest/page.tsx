import { redirect } from "next/navigation";
import { hasAccess } from "./access";
import { readSelection, investPhotos, type SearchParams } from "./selection";
import { Gate } from "@/components/invest/Gate";
import { InvestPage } from "@/components/invest/InvestPage";

export const dynamic = "force-dynamic";

/**
 * /invest — the investor page Umais and Hamza open in meetings. Private: behind
 * an access code, noindex, absent from nav and sitemap. `?k=CODE` in a shared
 * link unlocks the device in one tap (via /invest/enter, which can set cookies).
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
  return (
    <main>
      <InvestPage photos={await investPhotos()} initial={readSelection(sp)} />
    </main>
  );
}
