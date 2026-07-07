"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { createListing, updateListing, type ActionResult } from "@/app/host/actions";
import type { HostListing } from "@/lib/data/host";

const CATEGORIES = ["Apartment", "Penthouse", "Studio", "Villa", "Farmhouse", "House"];
const PRESET_AMENITIES = [
  "WiFi", "AC", "Parking", "Kitchen", "TV", "Washing machine", "Generator/UPS",
  "Jacuzzi", "Pool", "Terrace", "Projector", "Gaming console", "BBQ",
];

// One form for create + edit. Server does the authoritative validation; this
// keeps the inputs pleasant (amenity chips, live counters).
export function ListingForm({ existing }: { existing?: HostListing }) {
  const isEdit = Boolean(existing);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    isEdit ? updateListing : createListing,
    null,
  );
  const [amenities, setAmenities] = useState<string[]>(existing?.amenities ?? []);
  const [custom, setCustom] = useState("");
  const router = useRouter();

  // After a successful CREATE, go to the new listing's edit page to add photos.
  if (!isEdit && state?.ok && state.id) {
    router.replace(`/host/listings/${state.id}?created=1`);
  }

  const toggle = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const addCustom = () => {
    const a = custom.trim().slice(0, 40);
    if (a && !amenities.includes(a)) setAmenities((prev) => [...prev, a]);
    setCustom("");
  };

  return (
    <form action={action} className="space-y-5">
      {isEdit && <input type="hidden" name="listingId" value={existing!.id} />}
      <input type="hidden" name="amenities" value={amenities.join(",")} />

      <Section title="The basics">
        <Field label="Listing title">
          <input name="title" defaultValue={existing?.title ?? ""} required minLength={4} maxLength={90} placeholder="e.g. Sunlit 2-bed apartment with Margalla views" className={input} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select name="category" defaultValue={existing?.category ?? ""} required className={input}>
              <option value="" disabled>Choose…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Area">
            <input name="area" defaultValue={existing?.area ?? ""} required maxLength={60} placeholder="e.g. E-11, Bahria Phase 7" className={input} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Bedrooms">
            <input name="bedrooms" type="number" min={0} max={20} defaultValue={existing?.bedrooms ?? ""} placeholder="2" className={input} />
          </Field>
          <Field label="Sleeps">
            <input name="capacity" type="number" min={1} max={40} defaultValue={existing?.capacity ?? ""} placeholder="4" className={input} />
          </Field>
          <Field label="Price / night (₨)">
            <input name="price" type="number" min={1000} step={100} required defaultValue={existing?.price || ""} placeholder="15000" className={input} />
          </Field>
        </div>
      </Section>

      <Section title="Amenities">
        <div className="flex flex-wrap gap-2">
          {[...PRESET_AMENITIES, ...amenities.filter((a) => !PRESET_AMENITIES.includes(a))].map((a) => {
            const on = amenities.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggle(a)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-gold/50 bg-gold/10 text-gold-deep" : "border-line text-muted hover:text-ink"}`}
              >
                {a}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            maxLength={40}
            placeholder="Add your own…"
            className={`${input} flex-1`}
          />
          <button type="button" onClick={addCustom} className="rounded-xl border border-line px-3.5 text-muted transition hover:text-ink" aria-label="Add amenity">
            <Plus size={16} />
          </button>
        </div>
      </Section>

      <Section title="Description">
        <textarea
          name="description"
          defaultValue={existing?.description ?? ""}
          required
          minLength={40}
          maxLength={2500}
          rows={6}
          placeholder="What makes your place special? The space, the views, the neighbourhood, house rules…"
          className={`${input} resize-none`}
        />
      </Section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-ink px-6 py-2.5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Submit for review"}
        </button>
        {state?.ok && isEdit && (
          <span className="inline-flex items-center gap-1 text-sm text-green">
            <Check size={15} /> {state.message}
          </span>
        )}
        {state && !state.ok && <span className="text-sm text-red">{state.message}</span>}
      </div>
      {!isEdit && <p className="text-xs text-dim">You&apos;ll add photos right after this step. We review every new listing before it goes live.</p>}
    </form>
  );
}

const input = "w-full rounded-xl border border-line bg-bg/40 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-dim focus:border-gold/50";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 font-display text-base font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block last:mb-0">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
