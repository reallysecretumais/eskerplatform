import { AREAS, PACKAGES, DEFAULT_PACKAGE, type PackageId, type UnitType } from "@/lib/invest/config";
import { findArea, unitsOf } from "@/lib/invest/calc";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** A selection from the URL, every part validated and defaulted — a mangled link
 *  still opens on a sensible projection rather than an error. */
export function readSelection(sp: SearchParams): { areaId: string; unit: UnitType; stake: number; pkg: PackageId } {
  const area = findArea(one(sp.area)) ?? AREAS.find((a) => a.id === "e11") ?? AREAS[0];
  const want = one(sp.unit) as UnitType;
  const unit: UnitType = area.units[want] ? want : area.units["2BHK"] ? "2BHK" : unitsOf(area)[0];
  const stake = one(sp.stake) === "50" ? 0.5 : 1;
  const pkg = (PACKAGES.find((p) => p.id === one(sp.pkg))?.id ?? DEFAULT_PACKAGE) as PackageId;
  return { areaId: area.id, unit, stake, pkg };
}
