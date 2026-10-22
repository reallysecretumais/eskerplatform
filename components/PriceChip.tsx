import { NF, unitLabel } from "@/lib/listings";

/**
 * THE PRICE CHIP — the website's version of Esker's signature (BUILD_REFERENCE
 * "Price chip"): an Esker Blue pill, warm-white figure, ice "Rs" and unit.
 *
 * It hangs half below the photo's bottom-right corner with a ring in the page
 * colour, so it reads as cut out of the photo. The PARENT places it (the photo
 * frame is `relative`); the chip only draws itself. Always bottom-right, never
 * moved per image.
 *
 * Two sizes, both measured from the Website board:
 *   l   Esker Exclusive cards   38px · Rs 11 · 17 · / NIGHT 10.5 · 5px ring
 *   m   More stays cards        32px · Rs 10.5 · 15 · / NIGHT 10 · 4px ring
 */
const SIZES = {
  l: { box: "h-[38px] px-4 gap-[7px] -bottom-[19px] right-5 shadow-[0_0_0_5px_var(--color-bg)]", rs: "text-[11px]", num: "text-[17px]", unit: "text-[10.5px]" },
  m: { box: "h-8 px-3.5 gap-1.5 -bottom-4 right-4 shadow-[0_0_0_4px_var(--color-bg)]", rs: "text-[10.5px]", num: "text-[15px]", unit: "text-[10px]" },
} as const;

export function PriceChip({ price, unit, size = "m" }: { price: number; unit: string; size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span
      className={`absolute inline-flex items-center rounded-full bg-brand text-warm tnum ${s.box}`}
      aria-label={`${NF.format(price)} rupees per ${unit}`}
    >
      <span aria-hidden className={`${s.rs} font-medium text-ice`}>Rs</span>
      <span aria-hidden className={`${s.num} font-bold tracking-[-0.01em]`}>{NF.format(price)}</span>
      <span aria-hidden className={`${s.unit} font-semibold tracking-[0.06em] text-ice`}>{unitLabel(unit)}</span>
    </span>
  );
}
