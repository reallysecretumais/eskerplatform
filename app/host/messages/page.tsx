import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { getHostThreads, getHostThreadMessages } from "@/lib/data/host";
import { HostInbox } from "@/components/host/HostInbox";

export const metadata: Metadata = { title: "Host messages — Esker", robots: { index: false, follow: false } };

// The host's guest conversations — same cohesive shell as the rest of the host
// space. Guests message from listings/bookings; replies land here in realtime.
export default async function HostMessagesPage() {
  const account = await requireAccount();
  if (!account.roles.includes("owner")) redirect("/host");

  const threads = await getHostThreads();
  const first = threads[0] ? await getHostThreadMessages(threads[0].conversationId) : [];

  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-semibold tracking-tight text-ink">Messages</h1>
      <div className="flex h-[68dvh] min-h-[460px] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:h-[calc(100dvh-13rem)]">
        <HostInbox threads={threads} firstMessages={first} />
      </div>
    </>
  );
}
