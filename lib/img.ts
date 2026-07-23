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
