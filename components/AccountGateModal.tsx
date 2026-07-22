"use client";

import { useRouter } from "next/navigation";
import { X, MessageCircle } from "lucide-react";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";

// A reusable "you need an account for this" gate — creates one in seconds with
// phone + WhatsApp code, right in place (no page hop). First user: request-to-
// book on external stays; also fits future gates (wishlist, reviews…).
export function AccountGateModal({
  open,
  onClose,
  onAuthed,
  title = "Create your account in seconds",
  subtitle = "We'll WhatsApp you a 6-digit code — no password, no forms.",
}: {
  open: boolean;
  onClose: () => void;
  /** Called after the session cookie is set. Caller refreshes + continues. */
  onAuthed: () => void;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-t-2xl border border-line bg-surface p-6 shadow-2xl sm:rounded-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted transition hover:bg-surface-2 hover:text-ink">
          <X size={16} />
        </button>

        <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/12">
          <MessageCircle size={19} className="text-gold-deep" />
        </span>
        <h2 className="mt-3 font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{subtitle}</p>

        <div className="mt-4">
          {/* No email form in this sheet — send them to the full signup page,
              carrying nothing but intent, so a stuck code still converts. */}
          <PhoneOtpForm showName cta="Continue with WhatsApp" onDone={onAuthed} onUseEmail={() => router.push("/signup")} />
        </div>
      </div>
    </div>
  );
}
