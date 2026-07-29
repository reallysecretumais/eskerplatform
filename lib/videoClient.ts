/**
 * Client-side video validation for a listing's optional walkthrough video.
 *
 * The file goes STRAIGHT from the host's browser to Supabase Storage with a
 * signed upload URL, because a 16MB upload cannot pass through a server action
 * (the request body is capped far below that). The server therefore never sees
 * the bytes, so it cannot be what enforces the rules:
 *   • this file is a COURTESY check — it reads the first 16 bytes so a wrong
 *     file fails instantly instead of after a minute of uploading. It runs in
 *     the browser; assume it can be bypassed.
 *   • the REAL enforcement is the property-videos bucket (16MB limit + a
 *     video-only MIME allow-list), set in the Esker OS phase66 migration.
 *
 * Mirrors lib/videoClient.ts in the Esker OS repo — the two repos don't share
 * code, so if you change the accepted containers, change both.
 */

/** WhatsApp's own cap, so the same clip can also be sent to a guest later. */
export const MAX_VIDEO_BYTES = 16 * 1024 * 1024;

export const VIDEO_EXTS = ["mp4", "mov", "webm", "3gp"] as const;
export type VideoExt = (typeof VIDEO_EXTS)[number];

export function isVideoExt(ext: string): ext is VideoExt {
  return (VIDEO_EXTS as readonly string[]).includes(ext);
}

export type SniffResult =
  | { ok: true; ext: VideoExt; contentType: string }
  | { ok: false; message: string };

function sniffVideoBytes(b: Uint8Array): { ext: VideoExt; contentType: string } | null {
  // ISO-BMFF container  ....ftyp<brand> — the brand separates MOV / 3GP / MP4.
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    // A HEIC photo is also an ftyp box — reject it here, not at the bucket.
    if (["heic", "heif", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return null;
    if (brand === "qt  ") return { ext: "mov", contentType: "video/quicktime" };
    if (brand.startsWith("3g")) return { ext: "3gp", contentType: "video/3gpp" };
    return { ext: "mp4", contentType: "video/mp4" };
  }
  // WebM / Matroska  1A 45 DF A3
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return { ext: "webm", contentType: "video/webm" };
  return null;
}

/** Size first (cheap), then the real container from the file's first bytes. */
export async function sniffVideoFile(file: File): Promise<SniffResult> {
  if (!file || file.size === 0) return { ok: false, message: "Choose a video." };
  if (file.size > MAX_VIDEO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, message: `That video is ${mb}MB — the limit is 16MB. Try a shorter clip.` };
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const s = sniffVideoBytes(head);
  if (!s) return { ok: false, message: "That doesn't look like a video — please upload an MP4, MOV, WebM or 3GP." };
  return { ok: true, ...s };
}

/** Storage's own rejections, in words a host can act on. */
export function friendlyUploadError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("exceeded") || m.includes("too large") || m.includes("413"))
    return "That video is over the 16MB limit.";
  if (m.includes("mime") || m.includes("content type") || m.includes("invalid_mime"))
    return "That file type isn't supported — please upload an MP4, MOV, WebM or 3GP.";
  return message || "Upload failed — please try again.";
}
