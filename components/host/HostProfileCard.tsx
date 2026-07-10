"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Check, UserRound } from "lucide-react";
import { Avatar } from "@/components/account/Avatar";
import { saveHostBio } from "@/app/host/actions";

// Compact "Your host profile" editor on the dashboard: avatar + name (from the
// account) + an optional short bio guests see in the "Hosted by …" card.
export function HostProfileCard({ name, avatarUrl, bio }: { name: string | null; avatarUrl: string | null; bio: string }) {
  const [state, action, pending] = useActionState(saveHostBio, null);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <UserRound size={16} className="text-gold-deep" />
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">Your host profile</h2>
      </div>
      <p className="mt-1 text-xs text-dim">Guests see this on your listings as “Hosted by {name?.split(" ")[0] || "you"}”.</p>

      <div className="mt-4 flex items-start gap-4">
        <div className="shrink-0 text-center">
          <Avatar name={name} src={avatarUrl} size={56} />
          {!avatarUrl && (
            <Link href="/account/profile" className="mt-1.5 block text-[11px] text-gold-deep hover:underline">Add a photo</Link>
          )}
        </div>
        <form action={action} className="min-w-0 flex-1">
          <textarea
            name="bio"
            defaultValue={bio}
            rows={3}
            maxLength={300}
            placeholder="A warm line or two about you as a host — e.g. “I love hosting families and making check-in easy.”"
            className="w-full resize-none rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50"
          />
          <div className="mt-2 flex items-center gap-3">
            <button type="submit" disabled={pending} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
              {pending ? "Saving…" : "Save profile"}
            </button>
            {state?.ok && (
              <span className="inline-flex items-center gap-1 text-sm text-green">
                <Check size={14} /> {state.message}
              </span>
            )}
            {state && !state.ok && <span className="text-sm text-red">{state.message}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
