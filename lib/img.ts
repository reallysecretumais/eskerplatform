// Turn a Supabase public-object URL into a resized, lighter thumbnail via the
// storage image-transform endpoint. Keeps the photo-wall fast on mobile data.
export function thumb(url: string, width = 460, quality = 66): string {
  if (!url || !url.includes("/object/public/")) return url;
  return (
    url.replace("/object/public/", "/render/image/public/") +
    `?width=${width}&quality=${quality}&resize=cover`
  );
}
