/**
 * Google's map, dressed as Esker: the same dark, quiet map the guest app draws
 * (founder, 26 Oct: "custom built, on brand, premium"). Near-black land, roads
 * a step lighter, navy water carrying a trace of Esker Blue, labels in the ash
 * greys. Businesses and transit are hidden; areas ("F-10", "Gulberg Greens")
 * stay, because that is how guests in Islamabad find their way.
 *
 * ⚠️ A deliberate copy: the app's `src/theme/mapStyle.ts` and the map colours
 * in its `src/theme/tokens.ts` ("The map") are the source. Two runtimes, no
 * shared package, and the style is needed before anything can be fetched.
 * Change one, change both, so a stay looks the same on the site and the app.
 */

/** The app's tokens, by the same names. */
export const MAP_COLOR = {
  mapLand: "#101010",
  mapPark: "#0F1311",
  mapWater: "#0B1024",
  mapRoad: "#1C1C1C",
  /** The area's ice wash and ring (the app's mapArea / mapAreaRing). */
  ice: "#D0D8FF",
  areaFillOpacity: 0.1,
  areaRingOpacity: 0.45,
  black: "#0B0B0B",
  line: "#232323",
  ring: "#262626",
  outline: "#333333",
  ash: "#9C9B96",
  ashLabel: "#8A8984",
  paperLabel: "#6B6A65",
  brandInk: "#18246E",
} as const;

const c = MAP_COLOR;

/** Google's JSON styling (MapOptions.styles), rule for rule the app's MAP_STYLE. */
export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: c.mapLand }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: c.ashLabel }] },
  { elementType: "labels.text.stroke", stylers: [{ color: c.black }] },

  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: c.ash }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: c.ashLabel }] },

  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: c.black }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: c.line }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: c.mapLand }] },

  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: c.mapPark }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },

  { featureType: "road", elementType: "geometry", stylers: [{ color: c.mapRoad }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: c.paperLabel }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: c.ring }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: c.outline }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: c.ashLabel }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },

  { featureType: "transit", stylers: [{ visibility: "off" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: c.mapWater }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: c.brandInk }] },
];
