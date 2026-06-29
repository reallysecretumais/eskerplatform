import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";
import { getAccount } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { support } from "@/lib/payments";

// Shared shell for the legal pages — nav + readable prose column + footer.
export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const account = await getAccount();
  return (
    <main className="min-h-full">
      <SiteNav theme="light" account={account} />

      <article className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm text-dim">Last updated {updated}</p>
        <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-muted [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:tracking-tight [&_h2]:mt-1 [&_h2+p]:mt-2 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_strong]:text-ink">
          {children}
        </div>
        <div className="mt-12 border-t border-line pt-6 text-sm text-muted">
          Questions about this policy? Message us on{" "}
          <a href={`https://wa.me/${support.whatsapp}`} className="text-gold-deep underline hover:no-underline">WhatsApp</a> or email{" "}
          <a href={`mailto:${support.email}`} className="text-gold-deep underline hover:no-underline">{support.email}</a>.
        </div>
      </article>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display font-semibold text-ink">{brand.name}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/stays" className="hover:text-ink">Browse stays</Link>
            <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
            <Link href="/legal/cancellation" className="hover:text-ink">Cancellation</Link>
            <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
