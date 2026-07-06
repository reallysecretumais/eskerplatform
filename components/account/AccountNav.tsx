"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, MessageSquare, User, Shield, SlidersHorizontal, LogOut, Building2 } from "lucide-react";
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

const SHARED: Item[] = [
  { href: "/account/profile", label: "Profile", icon: User, match: prefix("/account/profile") },
  { href: "/account/security", label: "Security", icon: Shield, match: prefix("/account/security") },
  { href: "/account/preferences", label: "Preferences", icon: SlidersHorizontal, match: prefix("/account/preferences") },
];

// The account/host shell navigation: a Guest⇄Hosting mode switch + section links
// with active states. Desktop = sticky left rail; mobile = horizontal pill strip.
export function AccountNav({ mode }: { mode: "guest" | "host" }) {
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
        <ModeSwitch mode={mode} />
        <div className="mt-3 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mode === "guest" ? [...GUEST, ...SHARED].map((it) => link(it, true)) : null}
        </div>
      </div>

      {/* Desktop: sticky rail */}
      <nav className="hidden lg:block">
        <ModeSwitch mode={mode} />
        {mode === "guest" && (
          <div className="mt-5 space-y-1">
            {GUEST.map((it) => link(it))}
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
        )}
      </nav>
    </>
  );
}

// Segmented Guest / Hosting control. Guest → /account, Hosting → /host (which
// invites you to become a host if you aren't one yet). This is the whole
// "shared shell, two workspaces" idea in one control.
function ModeSwitch({ mode }: { mode: "guest" | "host" }) {
  const item = (active: boolean, href: string, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-bg text-ink shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
  return (
    <div className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
      {item(mode === "guest", "/account", <Home size={16} />, "Guest")}
      {item(mode === "host", "/host", <Building2 size={16} />, "Hosting")}
    </div>
  );
}
