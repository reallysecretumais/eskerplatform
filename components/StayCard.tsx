import Link from "next/link";
import { formatPrice, unitForCategory } from "@/lib/listings";
import { thumb } from "@/lib/img";

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
  photo?: string; // public URL; falls back to a warm tone until photos exist
  tone?: string;
  href?: string;
};

// One card, correct everywhere. The price unit comes from the listing itself
// (`price_unit`, set by category in the DB) so pools read "/ block" and content
// spaces "/ hour", never "/ night" — and the website and app always agree.
// When `href` is set the whole card is a link. The photo is a real <img> —
// lazy-loaded, alt-texted (SEO/a11y) and responsive via srcSet — and the card
// comes alive on hover (photo zoom + gentle lift).
export function StayCard({ title, category, area, city, price, priceUnit, exclusive, photo, tone = "#e7e1d6", href }: Stay) {
  const { amount, unit } = formatPrice(price, priceUnit ?? unitForCategory(category).unit);

  const body = (
    <>
      {/* 4:3 card, cover-cropped centred — rendered exactly as production does
          (CSS background-image, lead photo), so the crop is pixel-identical to
          the live site. */}
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{
          backgroundColor: tone,
          backgroundImage: photo ? `url(${thumb(photo, 600, 70)})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {exclusive && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-gold px-2 py-0.5 text-[10px] font-medium text-ink">
            Exclusive
          </span>
        )}
      </div>
      <div className="p-3.5">
        <div className="truncate text-sm font-medium text-ink">{title}</div>
        {/* Filtered join — a listing with no area set must not render "Apartment · ".
            Area then city ("Bahria Phase 7, Rawalpindi"): the city is always told,
            which is what earns the right to show it inside a shared market. */}
        <div className="text-xs text-muted">
          {[category, [area, city].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </div>
        <div className="mt-2 text-sm text-ink tnum">
          {amount}
          <span className="text-dim"> / {unit}</span>
        </div>
      </div>
    </>
  );

  const cls =
    "block overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-line-hi hover:shadow-sm";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <article className={cls}>{body}</article>
  );
}
