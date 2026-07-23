"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { subscribeAuthed } from "@/lib/supabase/realtime";
import { unreadCount } from "@/app/chat/actions";

// A small unread pill for the "Messages" nav item. Fetches the count on mount
// and on every route change (so reading a thread clears it when you navigate
// away), and bumps live when a new website message arrives over realtime — so an
// availability reply lights the menu even while the guest sits on another page.
export function MessagesBadge({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const refresh = () => unreadCount().then((n) => alive && setCount(n)).catch(() => {});
    refresh();

    // New rows land in `messages`; any change to the guest's own rows
    // (RLS-scoped) is a reason to re-count. Cheap and correct.
    const unsub = subscribeAuthed("nav-unread", (ch) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh),
    );
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (count <= 0) return null;
  return (
    <span className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-semibold leading-[18px] text-ink ${className}`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}
