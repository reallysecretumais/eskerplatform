import { MapPin } from "lucide-react";

// §6 — Location intelligence. Leads with the human-readable area, then a real
// neighborhood map (no API key needed). Exact landmark distances ("12 min from
// Centaurus") come from public_facts / the concierge once filled.
export function LocationSection({ area }: { area?: string | null }) {
  if (!area) return null;
  const map = `https://www.google.com/maps?q=${encodeURIComponent(`${area}, Pakistan`)}&z=14&output=embed`;

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Where you&apos;ll be</h2>
      <div className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted">
        <MapPin size={15} className="text-gold" /> {area}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <iframe
          src={map}
          title={`Map of ${area}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-64 w-full border-0 sm:h-72"
        />
      </div>
      <p className="mt-3 text-sm text-muted">
        Ask the concierge above for exact distances — &quot;how far from Centaurus?&quot;, &quot;nearest mosque or pharmacy?&quot;
      </p>
    </section>
  );
}
