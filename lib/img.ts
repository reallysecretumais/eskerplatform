// Turn a Supabase public-object URL into a resized, lighter thumbnail via the
// storage image-transform endpoint. Keeps the photo-wall fast on mobile data.
//
// `size` is a bounding box on the LONGEST edge, not the width. We pass width AND
// height (a square box) with resize=contain so the image is scaled down
// PROPORTIONALLY — full frame, aspect preserved, no crop, no padding.
//
// Why not width-only: Supabase's render endpoint, given a width but no height,
// keeps the source's ORIGINAL height instead of scaling it — a 4032×3024 photo
// asked for width=600 comes back 600×3024, a 1:5 sliver. Fed into a `cover` card
// box that reads as an unintelligible zoomed-in band. A full-res portrait lead
// photo is the trigger; short legacy photos hid the bug. Always bound both edges.
export function thumb(url: string, size = 460, quality = 66): string {
  if (!url || !url.includes("/object/public/")) return url;
  return (
    url.replace("/object/public/", "/render/image/public/") +
    `?width=${size}&height=${size}&quality=${quality}&resize=contain`
  );
}

/**
 * The same endpoint, cropped to an EXACT frame rather than fitted inside a box.
 *
 * `thumb()` is right when the whole photograph has to survive. It is wrong when
 * the client will crop anyway, because a square contain box spends most of its
 * pixels on the axis that then gets thrown away.
 *
 * The corridor proved it. A 4032×3024 photo asked for a 340 box comes back
 * 340×255; a portrait tile cropping that with `cover` uses roughly 210×255 of
 * real image and stretches it across ~476×578 physical pixels on a 1080p phone.
 * A 2.3× upscale — which is precisely what "the photos look low quality" looks
 * like, and no amount of raising `quality` would have touched it.
 *
 * Ask for the frame you will actually display and every returned pixel is one
 * you use. Both edges are still bound: see the warning above — a width with no
 * height returns the source's original height and yields a sliver.
 */
export function crop(url: string, width: number, height: number, quality = 72): string {
  if (!url || !url.includes("/object/public/")) return url;
  return (
    url.replace("/object/public/", "/render/image/public/") +
    `?width=${Math.round(width)}&height=${Math.round(height)}&quality=${quality}&resize=cover`
  );
}
