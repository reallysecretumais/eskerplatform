/**
 * Listing URL slugs — PURE functions, safe in client components.
 *
 * A listing lives at `/stays/{words}-{first 8 of its uuid}`, e.g.
 *   /stays/2bhk-luxury-penthouse-e-11-islamabad-a1b2c3d4
 *
 * WHY the id is still in the URL: the words come from the title + area, which
 * founders edit freely. Carrying a stable key means a rename can never orphan a
 * URL — we look the listing up by the key, then 301 to its current spelling. No
 * slug column, no uniqueness bookkeeping, no chance of two listings colliding.
 *
 * WHY 8 chars: 4 billion combinations against a catalogue of tens — collision
 * is not a practical concern, and the resolver falls back to a full-id match
 * anyway. Every old `/stays/{full-uuid}` link (WhatsApp shares, ad creatives,
 * anything already sent) keeps working forever via a 301 — see the page.
 */

/** "2BHK Luxury Penthouse" + "E-11" → "2bhk-luxury-penthouse-e-11" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

type SluggableListing = { id: string; title: string; area?: string | null; city?: string | null };

/** The canonical path for a listing. The ONLY place a /stays/ URL is built. */
export function stayPath(listing: SluggableListing): string {
  const words = slugify([listing.title, listing.area, listing.city].filter(Boolean).join(" "));
  const key = listing.id.replace(/-/g, "").slice(0, 8);
  return `/stays/${words ? `${words}-${key}` : key}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read the route param. Either a bare uuid (a legacy link) or a slug whose last
 * `-`-separated chunk is the 8-char key. Returns what to match on; the page
 * resolves it against the cached listings and redirects to the canonical path.
 */
export function parseStayKey(param: string): { kind: "uuid"; id: string } | { kind: "key"; key: string } | null {
  const raw = decodeURIComponent(param || "").trim().toLowerCase();
  if (!raw) return null;
  if (UUID_RE.test(raw)) return { kind: "uuid", id: raw };
  const tail = raw.split("-").pop() ?? "";
  if (/^[0-9a-f]{8}$/.test(tail)) return { kind: "key", key: tail };
  return null;
}

/** Does this listing own that 8-char key? (uuid dashes removed first.) */
export function matchesKey(id: string, key: string): boolean {
  return id.replace(/-/g, "").slice(0, 8) === key;
}
