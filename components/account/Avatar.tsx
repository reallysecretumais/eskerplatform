import { thumb } from "@/lib/img";

// Account avatar: the uploaded photo, or a clean gold-tinted initials circle.
// Works in server and client components (no client-only deps).
export function Avatar({ name, src, size = 40, className = "" }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const initials =
    (name || "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "G";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumb(src, size * 2, 72)}
        alt={name || "Profile picture"}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ height: size, width: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full bg-gold/15 font-display font-semibold text-gold-deep ${className}`}
      style={{ height: size, width: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}
