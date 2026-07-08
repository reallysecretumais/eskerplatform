import type { ListingStatus } from "@/lib/data/host";

const MAP: Record<ListingStatus, { label: string; cls: string; dot: string }> = {
  draft: { label: "Draft — finish setting up", cls: "text-blue", dot: "bg-blue shadow-[0_0_8px_var(--color-blue,#4c7bd0)]" },
  pending: { label: "In review", cls: "text-orange", dot: "bg-orange shadow-[0_0_8px_var(--color-orange,#c8842f)]" },
  live: { label: "Live", cls: "text-green", dot: "bg-green shadow-[0_0_8px_var(--color-green,#2f9e6e)]" },
  paused: { label: "Paused", cls: "text-muted", dot: "bg-dim" },
  rejected: { label: "Not approved", cls: "text-red", dot: "bg-red shadow-[0_0_8px_var(--color-red,#d9534f)]" },
};

export function ListingStatusBadge({ status, className = "" }: { status: ListingStatus; className?: string }) {
  const s = MAP[status] ?? MAP.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.cls} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
