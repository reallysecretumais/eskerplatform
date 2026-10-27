import { MapPin } from "lucide-react";
import { AreaMap } from "@/components/AreaMap";
import type { MapArea } from "@/lib/map";

/** Google's browser key for the stay map: Maps JavaScript API only, locked to
 *  this site (it reaches the page, so the lock is what protects it). Read on
 *  the server and handed to the map. Unset, every stay shows the area-name map. */
const MAPS_KEY = process.env.GOOGLE_MAPS_BROWSER_KEY;

// §6 — Location intelligence. Leads with the human-readable area, then the
// map: the Esker map with the stay's area circled once its location is set in
// Esker OS (and the key is set), otherwise Google's map of the area's name.
// Exact landmark distances ("12 min from Centaurus") come from public_facts /
// the concierge once filled.
export function LocationSection({ area, city, mapArea }: { area?: string | null; city?: string | null; mapArea?: MapArea | null }) {
  if (!area) return null;
  const where = [area, city].filter(Boolean).join(", ");
  // Area AND city: "B-17, Pakistan" alone can land the map anywhere.
  const place = [area, city, "Pakistan"].filter(Boolean).join(", ");
  const embed = (
    <div className="overflow-hidden rounded-[22px] border border-line">
      <iframe
        src={`https://www.google.com/maps?q=${encodeURIComponent(place)}&z=14&output=embed`}
        title={`Map of ${place}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-64 w-full border-0 sm:h-72"
      />
    </div>
  );

  return (
    <section>
      <h2 className="headline mb-3 text-2xl">Where you&apos;ll be</h2>
      <div className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted">
        <MapPin size={16} strokeWidth={1.8} className="text-brand" /> {where}
      </div>
      {mapArea && MAPS_KEY ? (
        <AreaMap area={mapArea} apiKey={MAPS_KEY} label={`Map of the area around ${where}. The stay is inside the circle.`} fallback={embed} />
      ) : (
        embed
      )}
      <p className="mt-3 text-sm text-muted">
        Ask the concierge above for exact distances — &quot;how far from Centaurus?&quot;, &quot;nearest mosque or pharmacy?&quot;
      </p>
    </section>
  );
}
