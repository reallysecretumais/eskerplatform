import { Building2, CalendarDays, Wallet, MessageSquare, ArrowRight } from "lucide-react";
import { requireAccount } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { becomeHost } from "@/app/account/actions";

export const metadata = { title: "Hosting — Esker" };

export default async function HostHome() {
  const account = await requireAccount();
  const isHost = account.roles.includes("owner");

  if (!isHost) return <BecomeHost />;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Hosting</h1>
      <p className="mt-1 text-sm text-muted">Welcome to your host space, {account.name?.split(" ")[0] || "there"}. Your dashboard is being built — here&apos;s what&apos;s coming.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Listings" value="—" />
        <Stat label="Upcoming stays" value="—" />
        <Stat label="This month" value="—" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SoonCard icon={<Building2 size={18} />} title="Your listings" body="Add a place, set your nightly rate and photos, and go live after a quick Esker review." />
        <SoonCard icon={<CalendarDays size={18} />} title="Calendar" body="Block dates, see upcoming stays, and keep availability in sync with Esker." />
        <SoonCard icon={<Wallet size={18} />} title="Earnings" body="Track what each stay pays out and when — clear, no spreadsheets." />
        <SoonCard icon={<MessageSquare size={18} />} title="Guest messages" body="Chat with guests in the same inbox you already use — with Esker looking out for you." />
      </div>

      <p className="mt-6 text-xs text-dim">You can switch back to your Guest space any time using the toggle above — it&apos;s the same account.</p>
    </div>
  );
}

function BecomeHost() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Become an Esker host</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
        List your place with {brand.short} and reach premium short-stay guests across {brand.launchCities.join(" & ")} —
        with our team handling the polish, the guests, and the care. Same login you use now; you can switch between guest and host any time.
      </p>

      <ul className="mt-6 space-y-3">
        {[
          "We help you list beautifully — photos, pricing, the works.",
          "Guests message you in one inbox, with Esker support alongside.",
          "You stay in control of your dates and your place.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3 text-sm text-ink">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            {t}
          </li>
        ))}
      </ul>

      <form action={becomeHost} className="mt-8">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:opacity-90"
        >
          Become a host <ArrowRight size={16} />
        </button>
      </form>
      <p className="mt-3 text-xs text-dim">This just unlocks your host space — nothing goes live until you add a listing and we review it.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="text-xs uppercase tracking-wider text-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink tabular-nums">{value}</div>
    </div>
  );
}

function SoonCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-gold-deep">
        {icon}
        <span className="font-display text-base font-semibold tracking-tight text-ink">{title}</span>
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-dim">Soon</span>
      </div>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
