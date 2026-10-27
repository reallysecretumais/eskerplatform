/**
 * Google's Maps JavaScript API, loaded once per page and only when a map is
 * about to be seen (components/AreaMap.tsx). Client only.
 *
 * A refused key (wrong site, API off, billing) doesn't fail the load: Google
 * calls the global `gm_authFailure` afterwards and greys the map out. Maps
 * listen for that with `onMapsRefused` and fall back to the area-name map.
 */

const READY = "__eskerMapsReady";

declare global {
  interface Window {
    __eskerMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

let loading: Promise<google.maps.MapsLibrary> | null = null;
let refused = false;
const listeners = new Set<() => void>();

export function loadMaps(key: string): Promise<google.maps.MapsLibrary> {
  loading ??= new Promise<void>((resolve, reject) => {
    window[READY] = resolve;
    window.gm_authFailure = () => {
      refused = true;
      console.error("[map] Google refused the Maps key (see the console's Google Maps API error for why)");
      listeners.forEach((fail) => fail());
    };
    const script = document.createElement("script");
    // region=PK: borders and names as Pakistan shows them.
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, loading: "async", callback: READY, language: "en", region: "PK" })}`;
    script.async = true;
    script.onerror = () => reject(new Error("the Maps script didn't load"));
    document.head.append(script);
  }).then(() => google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>);
  return loading;
}

/** True once Google has refused the key on this page (it says so only once). */
export function mapsRefused(): boolean {
  return refused;
}

/** Calls `fail` if Google refuses the key from now on. Returns the unsubscribe. */
export function onMapsRefused(fail: () => void): () => void {
  listeners.add(fail);
  return () => listeners.delete(fail);
}
