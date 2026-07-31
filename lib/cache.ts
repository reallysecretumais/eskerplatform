import { revalidateTag } from "next/cache";

/**
 * Bust every cached read of public listing data (getListings / getListing /
 * getMarkets — all tagged "listings").
 *
 * Use this rather than revalidatePath for anything that changes a listing:
 * listing pages live at slug URLs (lib/slug.ts), so busting a path built from
 * an id refreshes nothing, and the data cache is the real source anyway.
 *
 * The cast: Next 16's type wants a second cache-life argument for the new
 * caching model, but the runtime still accepts a lone tag. One place to fix
 * when we move to the new model.
 */
export function bustListings(): void {
  (revalidateTag as unknown as (tag: string) => void)("listings");
}
