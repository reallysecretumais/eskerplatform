"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, MessageSquare, User, Shield, SlidersHorizontal, LogOut, Building2, Star, LineChart } from "lucide-react";
import type { ComponentType } from "react";
import { signOut } from "@/app/account/actions";

type Item = { href: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; match: (p: string) => string };

const exact = (href: string) => (p: string) => (p === href ? href : "");
const prefix = (...hrefs: string[]) => (p: string) => (hrefs.some((h) => p === h || p.startsWith(`${h}/`)) ? hrefs[0] : "");

const GUEST: Item[] = [
  { href: "/account", label: "Overview", icon: Home, match: exact("/account") },
  { href: "/account/trips", label: "Trips", icon: CalendarDays, match: prefix("/account/trips", "/account/bookings") },
  { href: "/messages", label: "Messages", icon: MessageSquare, match: prefix("/messages") },
];

const HOST: Item[] = [
  { href: "/host", label: "Overview", icon: Home, match: exact("/host") },
  { href: "/host/listings", label: "Listings", icon: Building2, match: prefix("/host/listings") },
  { href: "/host/bookings", label: "Bookings", icon: CalendarDays, match: prefix("/host/bookings") },
  { href: "/host/reviews", label: "Reviews", icon: Star, match: prefix("/host/reviews") },
  { href: "/host/messages", label: "Messages", icon: MessageSquare, match: prefix("/host/messages") },
];

const PARTNER: Item[] = [
  { href: "/partner", label: "Overview", icon: Home, match: exact("/partner") },
  { href: "/partner/properties", label: "Properties", icon: Building2, match: prefix("/partner/properties") },
];

const SHARED: Item[] = [
  { href: "/account/profile", label: "Profile", icon: User, match: prefix("/account/profile") },
  { href: "/account/security", label: "Security", icon: Shield, match: prefix("/account/security") },
  { href: "/account/preferences", label: "Preferences", icon: SlidersHorizontal, match: prefix("/account/preferences") },
];

type Mode = "guest" | "host" | "partner";
const primaryFor = (mode: Mode): Item[] => (mode === "host" ? HOST : mode === "partner" ? PARTNER : GUEST);

// The account/host/partner shell navigation: a Guest⇄Hosting⇄Partner mode switch +
// section links with active states. Desktop = sticky left rail; mobile = pill strip.
export function AccountNav({ mode, showPartner = false }: { mode: Mode; showPartner?: boolean }) {
  const pathname = usePathname() || "/account";

  const link = (it: Item, compact = false) => {
    const active = it.match(pathname) !== "";
    const base = compact
      ? `flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm whitespace-nowrap transition`
      : `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition`;
    const cls = active ? "bg-gold/12 text-gold-deep font-medium" : "text-muted hover:bg-surface-2 hover:text-ink";
    return (
      <Link key={it.href} href={it.href} className={`${base} ${cls}`}>
        <it.icon size={17} className={active ? "text-gold-deep" : "text-dim"} />
        {it.label}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile: pill strip */}
      <div className="lg:hidden">
        <ModeSwitch mode={mode} showPartner={showPartner} />
        <div className="mt-3 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[...primaryFor(mode), ...SHARED].map((it) => link(it, true))}
        </div>
      </div>

      {/* Desktop: sticky rail */}
      <nav className="hidden lg:block">
        <ModeSwitch mode={mode} showPartner={showPartner} />
        <div className="mt-5 space-y-1">
          {primaryFor(mode).map((it) => link(it))}
          <div className="my-3 border-t border-line" />
          {SHARED.map((it) => link(it))}
          <div className="my-3 border-t border-line" />
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink">
              <LogOut size={17} className="text-dim" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}

// Segmented Guest / Hosting / Partner control. Guest → /account, Hosting → /host
// (which invites you to become a host if you aren't one yet), Partner → /partner.
// The Partner segment only appears for accounts that hold the (admin-granted)
// partner role. This is the whole "shared shell, multiple workspaces" idea in one
// control — one login can book stays, self-list, AND view its investor property.
function ModeSwitch({ mode, showPartner = false }: { mode: Mode; showPartner?: boolean }) {
  const item = (active: boolean, href: string, Icon: ComponentType<{ size?: number; className?: string }>, label: string) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium whitespace-nowrap transition ${
        active ? "bg-bg text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
      }`}
    >
      <Icon size={14} className={active ? "text-gold-deep" : "text-dim"} />
      <span className="truncate">{label}</span>
    </Link>
  );
  return (
    <div className="flex items-stretch gap-1 rounded-xl border border-line bg-surface-2 p-1">
      {item(mode === "guest", "/account", Home, "Guest")}
      {item(mode === "host", "/host", Building2, "Hosting")}
      {showPartner && item(mode === "partner", "/partner", LineChart, "Partner")}
    </div>
  );
}
