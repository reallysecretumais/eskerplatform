"use client";

import { useEffect } from "react";
import Link from "next/link";
import { company } from "@/lib/contact";
import { EskerLogo } from "@/components/EskerLogo";

// Something broke while rendering a page. Say what happened and what to do
// next, in one line each (BUILD_REFERENCE "Errors"), with a retry that
// re-renders in place rather than a full reload.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="flex min-h-full flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-[72px] max-w-[1248px] items-center px-5 sm:px-6">
          <Link href="/" aria-label="Esker Rentals" className="text-ink">
            <EskerLogo />
          </Link>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1248px] flex-1 flex-col items-start justify-center px-5 py-24 sm:px-6">
        <span className="label text-xs text-brand">Something went wrong</span>
        <h1 className="headline mt-4 max-w-[720px] text-[clamp(40px,6vw,72px)] leading-[0.94]">
          This page didn&apos;t load. <span className="text-brand">Try once more.</span>
        </h1>
        <p className="mt-5 max-w-[520px] text-lg text-muted">
          It&apos;s on our side, not yours. If it keeps happening, a person on WhatsApp can help straight away.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-[52px] items-center rounded-full bg-brand px-7 text-[15px] font-bold text-warm transition-colors hover:bg-brand-pressed"
          >
            Try again
          </button>
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
    </main>
  );
}
