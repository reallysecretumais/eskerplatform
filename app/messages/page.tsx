import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { MessagesInbox } from "@/components/chat/MessagesInbox";
import { requireAccount } from "@/lib/auth";
import { getMyThreads, getThreadMessages } from "@/lib/data/chat";

export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };

// The guest's inbox — Esker Support + a thread per host (per stay), no contact
// numbers shared. Same engine as the floating panel, with room to breathe.
export default async function MessagesPage() {
  const account = await requireAccount();
  const threads = await getMyThreads(); // always ≥1 (Esker Support, virtual until first msg)
  const first = threads[0]?.conversationId ? await getThreadMessages(threads[0].conversationId) : [];

  return (
    <main className="flex h-dvh flex-col">
      <SiteNav theme="light" account={account} />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-0 sm:px-6 sm:py-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-line sm:rounded-2xl sm:border">
          <MessagesInbox threads={threads} firstMessages={first} />
        </div>
      </div>
    </main>
  );
}
