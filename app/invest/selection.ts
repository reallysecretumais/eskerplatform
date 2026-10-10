import { AREAS, PACKAGES, DEFAULT_PACKAGE, type PackageId, type UnitType } from "@/lib/invest/config";
import { findArea, unitsOf } from "@/lib/invest/calc";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** A selection from the URL, every part validated and defaulted — a mangled link
 *  still opens on a sensible projection rather than an error. With no area in the
 *  link the page opens on the option most of our leads can reach: a half share of
 *  a Bahria Town 1BHK (Rs 4.6 lakh). */
export function readSelection(sp: SearchParams): { areaId: string; unit: UnitType; stake: number; pkg: PackageId } {
  const given = findArea(one(sp.area));
  const area = given ?? AREAS.find((a) => a.id === "bahria") ?? AREAS[0];
  const want = one(sp.unit) as UnitType;
  const unit: UnitType = area.units[want] ? want : given ? (area.units["2BHK"] ? "2BHK" : unitsOf(area)[0]) : unitsOf(area)[0];
  const stake = one(sp.stake) === "50" ? 0.5 : one(sp.stake) === "100" ? 1 : given ? 1 : 0.5;
  const pkg = (PACKAGES.find((p) => p.id === one(sp.pkg))?.id ?? DEFAULT_PACKAGE) as PackageId;
  return { areaId: area.id, unit, stake, pkg };
}

/** `?for=Munim` — the greeting on the hero. Letters, spaces and a few marks only,
 *  so nothing a link could carry is ever rendered as text we didn't expect. */
export function readName(sp: SearchParams): string | null {
  const raw = one(sp.for).trim().slice(0, 40);
  return /^[\p{L}\p{M}' .-]{2,}$/u.test(raw) ? raw : null;
}
