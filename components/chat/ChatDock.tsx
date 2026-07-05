import { getAccount } from "@/lib/auth";
import { getMyUnreadCount } from "@/lib/data/chat";
import { ChatLauncher } from "@/components/chat/ChatLauncher";

// Server shell for the floating chat — mounted once in the root layout so the
// launcher is on every page. Reads the session + unread count on the server;
// the heavy thread itself loads lazily when the panel is opened.
export async function ChatDock() {
  const account = await getAccount();
  const unread = account ? await getMyUnreadCount() : 0;
  return <ChatLauncher signedIn={Boolean(account)} initialUnread={unread} />;
}
