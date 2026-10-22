"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

// Site navigation, from the Website board: the wordmark, three links, and an
// outlined Sign in pill. `theme="hero"` sits over the hero's photo-wall (warm
// white, Esker Exclusive in ice) and, once the guest scrolls past the hero,
// the light bar slides down and stays, so the menu is never a scroll away.
// `theme="light"` is that sticky bar on inner pages (black, Esker Exclusive in
// Esker Blue). Phones get a menu sheet. `width="narrow"` matches the 1104px
// column of a stay page and checkout, so the wordmark lines up with the title.
export function SiteNav({
  theme = "hero",
  account = null,
  width = "wide",
}: {
  theme?: "hero" | "light";
  account?: { name?: string | null } | null;
  width?: "wide" | "narrow";
}) {
  const [open, setOpen] = useState(false);
  const onPhoto = theme === "hero";
  const [pastHero, setPastHero] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The menu sheet holds the page still behind it and closes on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Hero pages: show the light bar once most of the first screen has gone by.
  // One passive listener, a boolean that only changes at the threshold.
  useEffect(() => {
    if (!onPhoto) return;
    const check = () => setPastHero(window.scrollY > window.innerHeight * 0.7);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [onPhoto]);
  const authHref = account ? "/account" : "/login";
  const authLabel = account ? (account.name ? account.name.split(" ")[0] : "Account") : "Sign in";

  const bar = (dark: boolean) => {
    const plain = dark ? "text-warm hover:text-ice" : "text-ink hover:text-brand";
    const accent = dark ? "text-ice hover:text-warm" : "text-brand hover:text-brand-ink";
    return (
      <nav className={`flex items-center justify-between gap-4 ${dark ? "h-[84px]" : "h-[72px]"}`}>
        <Link href="/" aria-label={brand.name} className={dark ? "text-warm" : "text-ink"}>
          <EskerLogo size="nav" />
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
              dark
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
          className={`grid h-11 w-11 place-items-center rounded-full md:hidden ${dark ? "text-warm" : "text-ink"}`}
          aria-label="Open menu"
        >
          <Menu size={24} strokeWidth={1.8} />
        </button>
      </nav>
    );
  };

  const lightBar = (
    <div className={`mx-auto px-5 sm:px-6 ${width === "narrow" ? "max-w-[1104px]" : "max-w-[1248px]"}`}>{bar(false)}</div>
  );

  return (
    <>
      {onPhoto ? (
        <>
          {bar(true)}
          {/* The same menu, light, once the hero has scrolled away. `inert`
              while hidden so it never doubles the tab order. Portalled to
              <body>: inside the hero's stacking context the sections below
              would paint over it. */}
          {mounted && createPortal(
          <header
            inert={!pastHero}
            className={`fixed inset-x-0 top-0 z-40 border-b border-line bg-bg/95 backdrop-blur transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
              pastHero ? "translate-y-0" : "-translate-y-full"
            }`}
          >
            {lightBar}
          </header>,
          document.body,
          )}
        </>
      ) : (
        <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">{lightBar}</header>
      )}

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/55" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col bg-bg p-6">
            <div className="flex items-center justify-between">
              <EskerLogo size="nav" className="text-ink" />
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
        </div>,
        document.body,
      )}
    </>
  );
}
