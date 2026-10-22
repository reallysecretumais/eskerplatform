import Link from "next/link";
import { unitForCategory } from "@/lib/listings";
import { crop } from "@/lib/img";
import { PriceChip } from "@/components/PriceChip";

export type Stay = {
  id?: string;
  title: string;
  category: string;
  area: string;
  /** The city, shown after the area so a Rawalpindi stay reads honestly even
   *  inside the Islamabad · Rawalpindi market. Omit and only the area shows. */
  city?: string | null;
  price: number;
  /** The word after the price ("night" | "block" | "hour") — comes from the
   *  listing (DB-decided). Falls back to the category mapping if not passed. */
  priceUnit?: string;
  exclusive?: boolean;
  photo?: string; // public URL; a quiet tile shows until photos exist
  href?: string;
  /** feature = the Esker Exclusive row (2 across) · standard = the 3-across
   *  grids · compact = narrow places (concierge results, "similar stays"). */
  size?: "feature" | "standard" | "compact";
};

/**
 * The photo card from the Website board. The photo leads — nothing sits on it
 * but the EXCLUSIVE tag (top-left, Exclusive stays only) and the price chip,
 * which hangs half below the bottom-right corner. Title and the facts line sit
 * under the photo. The whole card is the link.
 *
 * Frames are the board's: feature 380px tall at radius 28, standard 260px at
 * radius 24 (shorter on phones, where a full-width 380px photo would be a
 * portrait). The image is asked for at the frame it fills (`crop()`, both
 * edges bound) so every pixel downloaded is a pixel shown, and `object-cover`
 * centres it exactly as the old background-image card did.
 */
const FRAMES = {
  feature: {
    box: "h-[300px] rounded-[28px] md:h-[380px]",
    src: [600, 404, 1128, 760] as const,
    sizes: "(min-width: 768px) 50vw, 100vw",
    chip: "l" as const,
    title: "text-[22px] stretch-88",
    body: "gap-1 pt-[30px]",
  },
  standard: {
    box: "h-[240px] rounded-[24px] md:h-[260px]",
    src: [400, 283, 736, 520] as const,
    sizes: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
    chip: "m" as const,
    title: "text-[17px]",
    body: "gap-[3px] pt-6",
  },
  compact: {
    box: "aspect-[4/3] rounded-[22px]",
    src: [360, 270, 640, 480] as const,
    sizes: "(min-width: 640px) 30vw, 50vw",
    chip: "m" as const,
    title: "text-[15px]",
    body: "gap-0.5 pt-6",
  },
};

export function StayCard({ title, category, area, city, price, priceUnit, exclusive, photo, href, size = "standard" }: Stay) {
  const f = FRAMES[size];
  const unit = priceUnit ?? unitForCategory(category).unit;
  const [w1, h1, w2, h2] = f.src;
  // Filtered join — a listing with no area set must not render "Apartment · ".
  // Area then city ("Bahria Phase 7, Rawalpindi"): the city is always told,
  // which is what earns the right to show it inside a shared market.
  const facts = [category, [area, city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

  const body = (
    <>
      <span className="relative block">
        <span className={`block overflow-hidden bg-surface-2 ${f.box}`}>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase transforms are the image CDN
            <img
              src={crop(photo, w1, h1)}
              srcSet={`${crop(photo, w1, h1)} ${w1}w, ${crop(photo, w2, h2)} ${w2}w`}
              sizes={f.sizes}
              alt={title}
              loading="lazy"
              decoding="async"
              className="block h-full w-full object-cover"
            />
          )}
        </span>
        {exclusive && (
          <span className="label absolute left-[18px] top-[18px] inline-flex h-7 items-center rounded-full bg-ink/45 px-3 text-[11px] tracking-[0.1em] text-warm shadow-[inset_0_0_0_1px_rgba(244,243,239,0.3)]">
            Exclusive
          </span>
        )}
        <PriceChip price={price} unit={unit} size={f.chip} />
      </span>
      <span className={`flex flex-col ${f.body}`}>
        <span className={`font-bold leading-tight text-ink ${f.title}`}>{title}</span>
        {facts && <span className={size === "feature" ? "text-[15px] text-muted" : "text-sm text-dim"}>{facts}</span>}
      </span>
    </>
  );

  // Pressed: the spec's 0.98 scale, 200ms ease-out; off under reduced motion.
  const cls =
    "flex min-w-0 flex-col text-ink no-underline transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <article className={cls}>{body}</article>
  );
}
