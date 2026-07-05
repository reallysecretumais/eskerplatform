import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to a Supabase realtime channel with the signed-in user's JWT applied
 * to the socket FIRST. Without this, RLS on `messages`/`conversations`
 * (account_id = auth.uid()) silently drops EVERY event and the chat just stops
 * updating with no error. Same helper the CRM uses — use it for ALL
 * postgres_changes subscriptions here.
 *
 * `build` receives the channel, attaches the `.on(...)` handlers, and returns it.
 * Returns a cleanup function — call it from your effect's return.
 */
export function subscribeAuthed(
  channelName: string,
  build: (channel: RealtimeChannel) => RealtimeChannel,
): () => void {
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  void (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) await supabase.realtime.setAuth(token);
    if (cancelled) return; // unmounted before auth resolved
    channel = build(supabase.channel(channelName)).subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}
