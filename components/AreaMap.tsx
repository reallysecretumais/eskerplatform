"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { MapArea } from "@/lib/map";
import { MAP_COLOR, MAP_STYLE } from "@/lib/mapStyle";
import { loadMaps, mapsRefused, onMapsRefused } from "@/lib/googleMaps";

/** Enough map around a 350 m area to read it as a neighbourhood. */
const ZOOM = 14;

/**
 * "Where you'll be" on the stay page: the area the stay is somewhere inside,
 * as a soft ice circle on the Esker map, never a pin on the building (the
 * app's AreaMap draws the same). Google's script is fetched only as the guest
 * scrolls near it, so a page that's never scrolled this far pays nothing.
 * If Google can't load or refuses the key, `fallback` (the area-name map)
 * takes its place.
 */
export function AreaMap({ area, apiKey, label, fallback }: { area: MapArea; apiKey: string; label: string; fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(mapsRefused);

  useEffect(() => {
    const el = ref.current;
    if (!el || failed) return;
    let cancelled = false;
    const fail = () => {
      if (!cancelled) setFailed(true);
    };
    const unsubscribe = onMapsRefused(fail);

    const draw = async () => {
      try {
        const { Map, Circle } = await loadMaps(apiKey);
        if (cancelled) return;
        const center = { lat: area.lat, lng: area.lng };
        const map = new Map(el, {
          center,
          zoom: ZOOM,
          // Out to the city, in to the streets around the circle: closer adds
          // nothing, because the circle is the answer, not a building.
          minZoom: 12,
          maxZoom: 16,
          styles: MAP_STYLE,
          backgroundColor: MAP_COLOR.mapLand,
          colorScheme: "DARK",
          disableDefaultUI: true,
          zoomControl: true,
          // One finger scrolls the page; two move the map.
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        new Circle({
          map,
          center,
          radius: area.radiusM,
          fillColor: MAP_COLOR.ice,
          fillOpacity: MAP_COLOR.areaFillOpacity,
          strokeColor: MAP_COLOR.ice,
          strokeOpacity: MAP_COLOR.areaRingOpacity,
          strokeWeight: 1.5,
          clickable: false,
        });
      } catch (e) {
        console.error("[map] Google Maps didn't load:", e);
        fail();
      }
    };

    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        seen.disconnect();
        void draw();
      },
      { rootMargin: "400px" },
    );
    seen.observe(el);
    return () => {
      cancelled = true;
      seen.disconnect();
      unsubscribe();
    };
  }, [area.lat, area.lng, area.radiusM, apiKey, failed]);

  // Keyed apart: Google draws into the map's box (an error card, too), and a
  // reused box would keep that under the fallback.
  if (failed) return <Fragment key="fallback">{fallback}</Fragment>;
  return (
    <>
      <div
        key="map"
        ref={ref}
        role="region"
        aria-label={label}
        className="h-64 w-full overflow-hidden rounded-[22px] border border-line sm:h-72"
        style={{ backgroundColor: MAP_COLOR.mapLand }}
      />
      <p className="mt-3 text-sm text-muted">The stay is inside the circle. Its exact address is shared once you&apos;ve booked.</p>
    </>
  );
}
