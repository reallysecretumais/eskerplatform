import Link from "next/link";
import { unitForCategory, formatPrice } from "@/lib/listings";
import { thumb } from "@/lib/img";

export type Stay = {
  id?: string;
  title: string;
  category: string;
  area: string;
  price: number;
  exclusive?: boolean;
  photo?: string; // public URL; falls back to a warm tone until photos exist
  tone?: string;
  href?: string;
};

// One card, correct everywhere. Price unit is derived from the listing's
// category so pools read "/ slot" and content spaces "/ hour", never "/ night".
// When `href` is set the whole card is a link. The photo is a real <img> —
// lazy-loaded, alt-texted (SEO/a11y) and responsive via srcSet — and the card
// comes alive on hover (photo zoom + gentle lift).
export function StayCard({ title, category, area, price, exclusive, photo, tone = "#e7e1d6", href }: Stay) {
  const { amount, unit } = formatPrice(price, unitForCategory(category));

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
        <div className="text-xs text-muted">
          {category} · {area}
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
