import { Avatar } from "@/components/account/Avatar";
import type { ListingHost } from "@/lib/data/listings";

// Public "Hosted by …" card shown on a self-listed place's page — warm, trust-
// building, Airbnb-style. Only safe host fields (first name, avatar, since, bio).
export function HostCard({ host }: { host: ListingHost }) {
  return (
    <section className="border-t border-line pt-8">
      <div className="flex items-start gap-4 rounded-[22px] bg-surface p-5 shadow-[0_1px_0_var(--color-line)]">
        <Avatar name={host.firstName} src={host.avatarUrl} size={56} className="shrink-0" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight text-ink stretch-88">Hosted by {host.firstName}</h2>
          {host.since && <div className="mt-0.5 text-xs text-dim">Host since {host.since}</div>}
          {host.bio && <p className="mt-2 text-sm leading-relaxed text-muted">{host.bio}</p>}
        </div>
      </div>
    </section>
  );
}
