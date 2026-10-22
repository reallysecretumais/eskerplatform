"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { brand } from "@/lib/brand";
import { company } from "@/lib/contact";
import { EskerLogo } from "@/components/EskerLogo";
import { MessagesBadge } from "@/components/chat/MessagesBadge";

const LINKS: { label: string; href: string; accent?: boolean; external?: boolean }[] = [
  { label: "Browse all stays", href: "/stays" },
  { label: brand.exclusiveTier, href: "/stays?tier=exclusive", accent: true },
  // Real help in one tap — WhatsApp, where Pakistani guests actually ask.
  { label: "Help", href: `https://wa.me/${company.whatsapp}`, external: true },
];

// Site navigation, from the Website board: the lockup, three links, and an
// outlined Sign in pill. `theme="hero"` sits over the hero's overlay (warm
// white, Esker Exclusive in ice); `theme="light"` is the sticky bar for inner
// pages (black, Esker Exclusive in Esker Blue). Phones get a menu sheet.
export function SiteNav({
  theme = "hero",
  account = null,
}: {
  theme?: "hero" | "light";
  account?: { name?: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  const onPhoto = theme === "hero";
  const authHref = account ? "/account" : "/login";
  const authLabel = account ? (account.name ? account.name.split(" ")[0] : "Account") : "Sign in";

  const plain = onPhoto ? "text-warm hover:text-ice" : "text-ink hover:text-brand";
  const accent = onPhoto ? "text-ice hover:text-warm" : "text-brand hover:text-brand-ink";

  const bar = (
    <nav className={`flex items-center justify-between gap-4 ${onPhoto ? "h-[84px]" : "h-[72px]"}`}>
      <Link href="/" aria-label={brand.name} className={onPhoto ? "text-warm" : "text-ink"}>
        <EskerLogo size="nav" className={onPhoto ? "" : "h-[49px] w-[60px]"} />
      </Link>

      <div className="hidden items-center gap-[26px] text-[15px] font-semibold md:flex">
        {LINKS.map((l) =>
          l.external ? (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={l.accent ? accent : plain}>
              {l.label}
            </a>
          ) : (
            <Link key={l.label} href={l.href} className={l.accent ? accent : plain}>
              {l.label}
            </Link>
          ),
        )}
        {account && (
          <Link href="/messages" className={`inline-flex items-center gap-1.5 ${plain}`}>
            Messages
            <MessagesBadge />
          </Link>
        )}
        <Link
          href={authHref}
          className={`inline-flex h-10 items-center rounded-full px-[18px] transition-colors ${
            onPhoto
              ? "text-warm shadow-[inset_0_0_0_1.5px_rgba(244,243,239,0.6)] hover:bg-warm/10"
              : "text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)] hover:bg-surface-2"
          }`}
        >
          {authLabel}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`grid h-11 w-11 place-items-center rounded-full md:hidden ${onPhoto ? "text-warm" : "text-ink"}`}
        aria-label="Open menu"
      >
        <Menu size={24} strokeWidth={1.8} />
      </button>
    </nav>
  );

  return (
    <>
      {onPhoto ? (
        bar
      ) : (
        <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto max-w-[1248px] px-5 sm:px-6">{bar}</div>
        </header>
      )}

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/55" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col bg-bg p-6">
            <div className="flex items-center justify-between">
              <EskerLogo size="nav" className="h-[49px] w-[60px] text-ink" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-full text-ink">
                <X size={22} strokeWidth={1.8} />
              </button>
            </div>
            <div className="mt-8 flex flex-col gap-5 text-[17px] font-semibold">
              {LINKS.map((l) =>
                l.external ? (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={l.accent ? "text-brand" : "text-ink"} onClick={() => setOpen(false)}>
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.label} href={l.href} className={l.accent ? "text-brand" : "text-ink"} onClick={() => setOpen(false)}>
                    {l.label}
                  </Link>
                ),
              )}
              {account && (
                <Link href="/messages" className="inline-flex items-center gap-2 text-ink" onClick={() => setOpen(false)}>
                  Messages
                  <MessagesBadge />
                </Link>
              )}
              <Link
                href={authHref}
                className="mt-2 inline-flex h-12 items-center justify-center rounded-full text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-hi)]"
                onClick={() => setOpen(false)}
              >
                {authLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
