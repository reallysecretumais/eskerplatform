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
      {/* Portrait 4:5 — the photo library is portrait phone shots (3:4); a
          landscape crop was hiding half of every photo. 4:5 shows ~94% of it. */}
      <div className="relative aspect-[4/5] overflow-hidden" style={{ backgroundColor: tone }}>
        {photo && (
          <img
            src={thumb(photo, 720, 74)}
            srcSet={`${thumb(photo, 480, 72)} 480w, ${thumb(photo, 720, 74)} 720w`}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
            alt={`${title} — ${category} in ${area}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          />
        )}
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
    "group block overflow-hidden rounded-2xl border border-line bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-md hover:shadow-black/[0.06]";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <article className={cls}>{body}</article>
  );
}
