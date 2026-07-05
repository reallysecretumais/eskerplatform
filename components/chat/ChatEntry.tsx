"use client";

import { MessageCircle } from "lucide-react";
import type { ChatContext } from "@/app/chat/actions";

// A tiny trigger any page can drop in: opens the floating chat panel with
// property/booking context via the launcher's window event. Server components
// stay server — only this button is client.
export function ChatEntry({
  label,
  propertyId,
  bookingId,
  className = "",
}: {
  label: string;
  propertyId?: string;
  bookingId?: string;
  className?: string;
}) {
  const open = () => {
    const detail: ChatContext = { propertyId, bookingId };
    window.dispatchEvent(new CustomEvent("esker:chat", { detail }));
  };
  return (
    <button
      type="button"
      onClick={open}
      className={`inline-flex items-center gap-1.5 text-sm text-gold-deep transition hover:underline ${className}`}
    >
      <MessageCircle size={15} /> {label}
    </button>
  );
}
