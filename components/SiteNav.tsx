"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { brand } from "@/lib/brand";
import { EskerLogo } from "@/components/EskerLogo";

const LINKS = [
  { label: "Browse all stays", href: "/stays" },
  { label: brand.exclusiveTier, href: "/stays?tier=exclusive", gold: true },
  { label: "Help", href: "#" },
];

// Site navigation. `theme="hero"` sits over the hero photo (white, no bar);
// `theme="light"` is a sticky header for inner pages (dark text on a light bar).
// Mobile gets a real hamburger → slide-over either way.
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

  const bar = (
    <nav className={`flex items-center justify-between py-5 ${onPhoto ? "[text-shadow:0_1px_10px_rgba(0,0,0,0.55)]" : ""}`}>
      <Link href="/" aria-label={brand.name} className={onPhoto ? "text-white" : "text-ink"}>
        <EskerLogo />
      </Link>

      <div className="hidden items-center gap-7 text-sm sm:flex">
        {LINKS.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className={l.gold ? "text-gold hover:opacity-80" : onPhoto ? "text-white/90 hover:text-white" : "text-muted hover:text-ink"}
          >
            {l.label}
          </Link>
        ))}
        <Link
          href={authHref}
          className={`rounded-lg border px-4 py-1.5 ${onPhoto ? "border-white/45 text-white hover:bg-white/10" : "border-line text-ink hover:bg-surface-2"}`}
        >
          {authLabel}
        </Link>
      </div>

      <button type="button" onClick={() => setOpen(true)} className={`sm:hidden ${onPhoto ? "text-white" : "text-ink"}`} aria-label="Open menu">
        <Menu size={24} />
      </button>
    </nav>
  );

  return (
    <>
      {onPhoto ? (
        bar
      ) : (
        <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6">{bar}</div>
        </header>
      )}

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-bg p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <EskerLogo className="text-ink" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="text-ink">
                <X size={22} />
              </button>
            </div>
            <div className="mt-8 flex flex-col gap-5 text-[15px]">
              {LINKS.map((l) => (
                <Link key={l.label} href={l.href} className={l.gold ? "text-gold-deep" : "text-ink"} onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              ))}
              <Link href={authHref} className="mt-2 rounded-lg border border-line px-4 py-2 text-center text-ink" onClick={() => setOpen(false)}>
                {authLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
