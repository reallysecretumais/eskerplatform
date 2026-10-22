import type { ListingStatus } from "@/lib/data/host";

const MAP: Record<ListingStatus, { label: string; cls: string; dot: string }> = {
  draft: { label: "Draft — finish setting up", cls: "text-blue", dot: "bg-blue" },
  pending: { label: "In review", cls: "text-orange", dot: "bg-orange" },
  live: { label: "Live", cls: "text-green", dot: "bg-green" },
  paused: { label: "Paused", cls: "text-muted", dot: "bg-dim" },
  rejected: { label: "Not approved", cls: "text-red", dot: "bg-red" },
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
