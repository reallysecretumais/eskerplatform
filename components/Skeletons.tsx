import { EskerLogo } from "@/components/EskerLogo";

// Loading states (BUILD_REFERENCE "Empty, loading, error"): grey shapes that
// match the real layout, a soft pulse, no spinners. Shown by the routes'
// loading.tsx while the server renders, so a tap answers instantly.
//
// The header is a quiet stand-in rather than the real SiteNav: the real one
// needs the account, and guessing "Sign in" for a signed-in guest would flash.

export function Block({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-[14px] bg-surface-2 motion-reduce:animate-none ${className}`} style={style} />;
}

export function HeaderSkeleton({ narrow = false }: { narrow?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95">
      <div className={`mx-auto flex h-[72px] items-center justify-between px-5 sm:px-6 ${narrow ? "max-w-[1104px]" : "max-w-[1248px]"}`}>
        <EskerLogo className="text-ink" />
        <Block className="hidden h-10 w-24 rounded-full md:block" />
      </div>
    </header>
  );
}

/** The photo card's shape: photo frame, then a title and a facts line. */
export function CardSkeleton({ size = "standard" }: { size?: "feature" | "standard" | "compact" }) {
  const frame =
    size === "feature" ? "h-[300px] rounded-[28px] md:h-[380px]" : size === "compact" ? "aspect-[4/3] rounded-[22px]" : "h-[240px] rounded-[24px] md:h-[260px]";
  return (
    <div className="flex flex-col">
      <Block className={frame} />
      <Block className="mt-6 h-5 w-3/4" />
      <Block className="mt-2 h-4 w-1/2" />
    </div>
  );
}
