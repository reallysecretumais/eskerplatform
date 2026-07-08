"use client";

import { useActionState } from "react";
import { Check, KeyRound } from "lucide-react";
import { saveGuestInfo } from "@/app/host/actions";
import type { ListingGuestInfo } from "@/lib/data/host";

// Guest info: the practical details that make a self-managed stay work.
// Private fields go to confirmed guests only; public facts feed the AI
// concierge and the listing page.
export function GuestInfoForm({ listingId, info }: { listingId: string; info: ListingGuestInfo }) {
  const [state, action, pending] = useActionState(saveGuestInfo, null);

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-gold-deep" />
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">Guest info</h2>
      </div>
      <p className="mt-1 text-xs text-dim">Check-in details stay private (shared with confirmed guests). Public facts help guests — and our AI concierge — answer questions before booking.</p>

      <div className="mt-4 space-y-4">
        <Field label="Check-in instructions" hint="Private — how guests get in: timings, who meets them, directions to the door.">
          <textarea name="checkIn" defaultValue={info.checkIn} rows={3} maxLength={2000} placeholder="Check-in from 2 PM. Call the caretaker at the gate…" className={area} />
        </Field>
        <Field label="House rules" hint="Private — shared with confirmed guests.">
          <textarea name="houseRules" defaultValue={info.houseRules} rows={2} maxLength={2000} placeholder="No parties. Families only. Checkout by 12 PM…" className={area} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WiFi name" hint="Private.">
            <input name="wifiName" defaultValue={info.wifiName} maxLength={120} className={input} />
          </Field>
          <Field label="WiFi password" hint="Private.">
            <input name="wifiPassword" defaultValue={info.wifiPassword} maxLength={120} className={input} />
          </Field>
        </div>
        <Field label="Access notes" hint="Private — parking spot, lift codes, generator switch…">
          <textarea name="accessNotes" defaultValue={info.accessNotes} rows={2} maxLength={2000} className={area} />
        </Field>
        <Field label="Public facts" hint="Public — parking, nearby landmarks, family-friendliness, anything guests ask before booking. No codes or passwords here.">
          <textarea name="publicFacts" defaultValue={info.publicFacts} rows={3} maxLength={2000} placeholder="Free parking for 2 cars. 5 min from Centaurus. Family-friendly building with a lift…" className={area} />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input type="hidden" name="listingId" value={listingId} />
        <button type="submit" disabled={pending} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : "Save guest info"}
        </button>
        {state?.ok && (
          <span className="inline-flex items-center gap-1 text-sm text-green">
            <Check size={15} /> {state.message}
          </span>
        )}
        {state && !state.ok && <span className="text-sm text-red">{state.message}</span>}
      </div>
    </form>
  );
}

const input = "w-full rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50";
const area = `${input} resize-none`;

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      <span className="mt-1 block text-[11px] text-dim">{hint}</span>
    </label>
  );
}
