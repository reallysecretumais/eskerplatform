import { AREAS, type MapPin } from "@/lib/invest/config";

/**
 * A drawn map of Islamabad and Rawalpindi in the page's own palette — the
 * Margalla ridges, the sector grid, Rawal Lake, the Expressway, Kashmir
 * Highway, GT Road and Murree Road — with every area we operate in pinned.
 * Approximate placement (stated on the map: "not to scale"). Pure SVG: crisp
 * at any size, a few KB, no image requests.
 *
 * The base map is defined ONCE (<MapDefs/>) and every tile reuses it through
 * <use href="#inv-map">; only the hero draws its own animated copy. Colours are
 * literal hex because content cloned into a <use> tree can't be reached by the
 * page's class rules.
 */

const C = {
  bg: "#16211b",
  land: "#1b2820",
  ridge: "#2f4136",
  grid: "#2a3a31",
  city: "#1f2c24",
  water: "#2c4a46",
  road: "#d8cbb5",
  roadMinor: "#9eaa9a",
  label: "#9eaa9a",
  pin: "#c97a58",
  pinDim: "#d8cbb5",
  bone: "#efe8dc",
};

// Geometry in map units (see MapPin). The canvas runs well past the edges so
// any crop — even B-17 at the far west — lands on map, never on blank.
const RIDGES = [
  "M-120 64 C-40 50 20 70 90 58 S 210 38 290 50 S 400 40 520 52",
  "M-120 50 C-30 34 30 56 100 44 S 220 24 300 36 S 410 26 520 36",
  "M-120 36 C-20 20 40 42 110 30 S 230 10 310 22 S 420 12 520 22",
  "M-120 22 C-10 6 50 28 120 16 S 240 -4 320 8 S 430 -2 520 8",
];
const CITY = "M146 90 C200 76 262 68 322 72 L340 140 C322 160 292 172 268 178 L196 194 C170 190 148 172 138 150 Z";
const PINDI = "M198 214 C240 204 292 212 314 240 C320 272 292 294 250 294 C214 292 190 262 198 214 Z";
const LAKE = "M306 106 C316 97 338 99 345 108 C350 117 337 125 322 123 C311 121 300 115 306 106 Z";
const ROADS = {
  expressway: "M265 127 C272 145 278 160 282 168 S 320 185 332 194 S 352 215 360 228 S 362 282 352 318 S 382 362 440 410",
  kashmir: "M265 127 C230 136 200 144 180 150 S 100 160 60 162 S 0 160 -120 154",
  gt: "M-120 170 C-20 174 20 160 40 158 S 120 200 170 214 S 230 240 250 252 S 310 290 330 302 S 384 342 440 376",
};
const MINOR = [
  "M282 168 C274 190 262 215 250 250", // Murree Road
  "M265 127 C280 118 296 108 314 96", // Jinnah Avenue towards the hills
  "M300 334 C306 318 318 306 330 302", // into Bahria
  "M180 121 C186 128 190 134 187 139", // E-11 to F-11
  "M38 152 C44 156 50 158 60 162", // B-17 off the highway
];

/** Render once per page. Holds the shared base map and the sector-grid pattern. */
export function MapDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <pattern id="inv-grid" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
          <path d="M13 0H0V13" fill="none" stroke={C.grid} strokeWidth="0.7" />
        </pattern>
        <clipPath id="inv-city-clip">
          <path d={CITY} />
        </clipPath>
        <g id="inv-map">
          <BaseMap />
        </g>
      </defs>
    </svg>
  );
}

function BaseMap({ draw = false }: { draw?: boolean }) {
  const road = draw ? "map-road" : undefined;
  return (
    <>
      <rect x="-200" y="-200" width="800" height="800" fill={C.bg} />
      <path d={PINDI} fill={C.city} opacity="0.55" />
      <path d={CITY} fill={C.city} />
      <rect x="-200" y="-200" width="800" height="800" fill="url(#inv-grid)" clipPath="url(#inv-city-clip)" opacity="0.9" />
      {RIDGES.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={C.ridge} strokeWidth={1.1 - i * 0.15} />
      ))}
      <path d={LAKE} fill={C.water} />
      {MINOR.map((d, i) => (
        <path key={i} className={road} pathLength={1} d={d} fill="none" stroke={C.roadMinor} strokeWidth="0.9" strokeLinecap="round" opacity="0.55" />
      ))}
      {Object.values(ROADS).map((d, i) => (
        <path key={i} className={road} pathLength={1} d={d} fill="none" stroke={C.road} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      ))}
      <text x="300" y="42" fill={C.label} fontSize="9" fontStyle="italic" fontFamily="var(--f-serif), Georgia, serif" opacity="0.8">
        Margalla Hills
      </text>
      <text x="222" y="170" fill={C.label} fontSize="6.5" letterSpacing="2.4" fontWeight="600" opacity="0.6" stroke={C.bg} strokeWidth="2.4" paintOrder="stroke">
        ISLAMABAD
      </text>
      <text x="226" y="276" fill={C.label} fontSize="6.5" letterSpacing="2.4" fontWeight="600" opacity="0.5" stroke={C.bg} strokeWidth="2.4" paintOrder="stroke">
        RAWALPINDI
      </text>
      <text x="314" y="134" fill={C.label} fontSize="5.5" fontStyle="italic" opacity="0.6">
        Rawal Lake
      </text>
    </>
  );
}

/** A pin. `focus` = the one this view is about: clay, ringed, pulsing. */
function Pin({ pin, focus, label, sub, delay }: { pin: MapPin; focus: boolean; label?: string; sub?: string; delay?: number }) {
  const left = pin.label === "left";
  const style = delay !== undefined ? { animationDelay: `${delay}s` } : undefined;
  return (
    <g className={delay !== undefined ? "map-pin" : undefined} style={style}>
      {focus ? (
        <>
          <circle className="map-pulse" cx={pin.x} cy={pin.y} r="5" fill={C.pin} opacity="0.5" />
          <circle cx={pin.x} cy={pin.y} r="8" fill="none" stroke={C.pin} strokeWidth="0.8" opacity="0.6" />
          <circle cx={pin.x} cy={pin.y} r="3.6" fill={C.pin} stroke={C.bone} strokeWidth="1.2" />
        </>
      ) : (
        <circle cx={pin.x} cy={pin.y} r="2.2" fill={C.pinDim} opacity="0.55" />
      )}
      {label ? (
        <text x={pin.x + (left ? -12 : 12)} y={pin.y + (sub ? -1 : 3)} textAnchor={left ? "end" : "start"} fill={C.bone} fontSize="9" fontWeight="700" stroke={C.bg} strokeWidth="2.6" paintOrder="stroke" strokeLinejoin="round">
          {label}
          {sub ? (
            <tspan x={pin.x + (left ? -12 : 12)} dy="10" fill={C.pin} fontSize="7.5" fontWeight="700">
              {sub}
            </tspan>
          ) : null}
        </text>
      ) : null}
    </g>
  );
}

/**
 * The hero: the whole region. Roads draw themselves in, then each area's pin
 * drops in turn with its best Standard return beside it.
 */
export function HeroMap({ returns }: { returns: Record<string, number> }) {
  return (
    <svg className="map map-draw" viewBox="104 0 320 427" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Where we operate: E-11, F-11, SkyPark One, DHA Phase 2 and Bahria Town">
      <g className="map-drift">
        <BaseMap draw />
        {AREAS.map((a, i) => (
          <Pin key={a.id} pin={a.pin} focus label={a.name} sub={`up to ${returns[a.id]}% / yr`} delay={1.3 + i * 0.28} />
        ))}
      </g>
      <text x="408" y="404" textAnchor="end" fill={C.label} fontSize="5.5" letterSpacing="1.2" opacity="0.55">
        NOT TO SCALE
      </text>
    </svg>
  );
}

/** One area's tile: the base map cropped around its pin, neighbours as faint dots. */
export function AreaTile({ areaId, active }: { areaId: string; active: boolean }) {
  const area = AREAS.find((a) => a.id === areaId)!;
  const { x, y } = area.pin;
  return (
    <svg className="map" viewBox={`${x - 100} ${y - 128} 200 228`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Map: ${area.name}`}>
      <use href="#inv-map" />
      {AREAS.filter((a) => a.id !== areaId).map((a) => (
        <Pin key={a.id} pin={a.pin} focus={false} />
      ))}
      <g className={active ? "" : "map-still"}>
        <Pin pin={area.pin} focus />
      </g>
    </svg>
  );
}

/** A wide crop for the proof cards: where the property actually is. */
export function PlaceMap({ pin, label }: { pin: MapPin; label: string }) {
  return (
    <svg className="map" viewBox={`${pin.x - 120} ${pin.y - 64} 240 128`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Map: ${label}`}>
      <use href="#inv-map" />
      {AREAS.map((a) => (
        <Pin key={a.id} pin={a.pin} focus={false} />
      ))}
      <Pin pin={pin} focus label={label} />
    </svg>
  );
}
