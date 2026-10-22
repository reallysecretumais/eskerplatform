import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { company } from "@/lib/contact";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

// A wrong link still lands somewhere that looks like Esker and offers the two
// ways forward: browse, or ask a person.
export default function NotFound() {
  return (
    <main className="flex min-h-full flex-col">
      <SiteNav theme="light" />
      <div className="mx-auto flex w-full max-w-[1248px] flex-1 flex-col items-start justify-center px-5 py-24 sm:px-6 sm:py-32">
        <span className="label text-xs text-brand">Page not found</span>
        <h1 className="headline mt-4 max-w-[760px] text-[clamp(44px,7vw,88px)] leading-[0.92]">
          This page has <span className="text-brand">checked out.</span>
        </h1>
        <p className="mt-5 max-w-[520px] text-lg text-muted">
          The link may be old, or the stay may no longer be listed. Everything that&apos;s open is a tap away.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/stays" className="inline-flex h-[52px] items-center rounded-full bg-brand px-7 text-[15px] font-bold text-warm transition-colors hover:bg-brand-pressed">
            Browse all stays
          </Link>
          <a
            href={`https://wa.me/${company.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[52px] items-center rounded-full px-7 text-[15px] font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)] transition-colors hover:text-brand"
          >
            Message us on WhatsApp
          </a>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
