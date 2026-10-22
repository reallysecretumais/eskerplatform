import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getAccount } from "@/lib/auth";
import { getListings, getMarkets } from "@/lib/data/listings";
import { liveCities } from "@/lib/geo";
import { support } from "@/lib/payments";

// Shared shell for the legal pages — nav + readable prose column + the site footer.
export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const account = await getAccount();
  const cities = liveCities(await getListings(), await getMarkets());
  return (
    <main className="min-h-full">
      <SiteNav theme="light" account={account} />

      <article className="mx-auto max-w-2xl px-6 pb-16 pt-12">
        <h1 className="headline text-[34px] text-ink sm:text-[40px]">{title}</h1>
        <p className="mt-3 text-sm text-dim">Last updated <span className="tnum">{updated}</span></p>
        <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-muted [&_h2]:headline [&_h2]:text-2xl [&_h2]:text-ink [&_h2]:mt-1 [&_h2+p]:mt-2 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_strong]:text-ink">
          {children}
        </div>
        <div className="mt-12 border-t border-line pt-6 text-sm text-muted">
          Questions about this policy? Message us on{" "}
          <a href={`https://wa.me/${support.whatsapp}`} className="text-brand underline hover:no-underline">WhatsApp</a> or email{" "}
          <a href={`mailto:${support.email}`} className="text-brand underline hover:no-underline">{support.email}</a>.
        </div>
      </article>

      <SiteFooter cities={cities} />
    </main>
  );
}
