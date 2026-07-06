import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { MessagesInbox } from "@/components/chat/MessagesInbox";
import { getMyThreads, getThreadMessages } from "@/lib/data/chat";

export const metadata: Metadata = { title: "Messages — Esker", robots: { index: false, follow: false } };

// The guest's inbox lives inside the account shell (same nav + workspace rail), so
// it's one cohesive space you can always navigate out of. Esker Support + a thread
// per host (per stay); no contact numbers shared. Same engine as the floating panel.
export default async function MessagesPage() {
  const threads = await getMyThreads(); // always ≥1 (Esker Support, virtual until first msg)
  const first = threads[0]?.conversationId ? await getThreadMessages(threads[0].conversationId) : [];

  return (
    <AccountShell mode="guest">
      <h1 className="mb-4 font-display text-2xl font-semibold tracking-tight text-ink">Messages</h1>
      <div className="flex h-[68dvh] min-h-[460px] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:h-[calc(100dvh-13rem)]">
        <MessagesInbox threads={threads} firstMessages={first} />
      </div>
    </AccountShell>
  );
}
