import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/auth";
import { hostCommission } from "@/lib/payments";

// Host-portal reads. Host listings live in the shared `properties` table
// (owner_relationship='host', owner_account_id=the host). Base-table RLS doesn't
// grant hosts row access, so these read via the SERVICE ROLE and filter strictly
// by owner_account_id = the signed-in account — exposing only host-safe fields
// (never internal ops columns, caretakers, or other people's rows).

export type ListingStatus = "pending" | "live" | "paused" | "rejected";

export type HostListing = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  area: string | null;
  bedrooms: number | null;
  capacity: number | null;
  price: number;
  amenities: string[];
  photos: string[];
  status: ListingStatus;
  reviewNote: string | null;
  createdAt: string | null;
};

type ListingRow = {
  id: string;
  name: string;
  public_title: string | null;
  public_description: string | null;
  kind: string | null;
  area: string | null;
  bedrooms: number | null;
  capacity: number | null;
  nightly_rate: number | null;
  public_price: number | null;
  amenities: string[] | null;
  photos: string[] | null;
  listing_status: string | null;
  review_note: string | null;
  created_at: string | null;
};

const LISTING_COLS =
  "id, name, public_title, public_description, kind, area, bedrooms, capacity, nightly_rate, public_price, amenities, photos, listing_status, review_note, created_at";

function toListing(r: ListingRow): HostListing {
  return {
    id: r.id,
    title: r.public_title || r.name,
    description: r.public_description,
    category: r.kind,
    area: r.area,
    bedrooms: r.bedrooms,
    capacity: r.capacity,
    price: Number(r.public_price ?? r.nightly_rate ?? 0),
    amenities: r.amenities ?? [],
    photos: r.photos ?? [],
    status: (r.listing_status as ListingStatus) || "pending",
    reviewNote: r.review_note,
    createdAt: r.created_at,
  };
}

/** All of the signed-in host's listings, newest first. [] when signed out. */
export async function getMyListings(): Promise<HostListing[]> {
  const user = await currentUser();
  if (!user) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("properties")
    .select(LISTING_COLS)
    .eq("owner_account_id", user.id)
    .eq("owner_relationship", "host")
    .order("created_at", { ascending: false });
  return ((data ?? []) as ListingRow[]).map(toListing);
}

/** One listing the signed-in host owns, or null. */
export async function getMyListing(id: string): Promise<HostListing | null> {
  const user = await currentUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("properties")
    .select(LISTING_COLS)
    .eq("id", id)
    .eq("owner_account_id", user.id)
    .eq("owner_relationship", "host")
    .maybeSingle();
  return data ? toListing(data as ListingRow) : null;
}

// ── Host inbox ───────────────────────────────────────────────────────────────

export type HostThreadSummary = {
  conversationId: string;
  guestFirstName: string; // privacy: first name only
  listingTitle: string;
  lastPreview: string | null;
  lastAt: string | null;
  unread: number; // guest messages since the host last read
};

/** The host's guest threads (owner_account_id = them), newest first, with unread
 *  counts. Service-role read exposing only host-safe fields; live message reads
 *  in the open thread use the session client under the owner RLS policy. */
export async function getHostThreads(): Promise<HostThreadSummary[]> {
  const user = await currentUser();
  if (!user) return [];
  const admin = createAdminClient();

  const { data: convos } = await admin
    .from("conversations")
    .select("id, account_id, property_id, last_message_preview, last_message_at, owner_last_read_at")
    .eq("owner_account_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);
  const rows = (convos ?? []) as {
    id: string; account_id: string | null; property_id: string | null;
    last_message_preview: string | null; last_message_at: string | null; owner_last_read_at: string | null;
  }[];
  if (rows.length === 0) return [];

  const accIds = [...new Set(rows.map((r) => r.account_id).filter(Boolean))] as string[];
  const propIds = [...new Set(rows.map((r) => r.property_id).filter(Boolean))] as string[];
  const [{ data: accs }, { data: props }, { data: inbound }] = await Promise.all([
    accIds.length ? admin.from("accounts").select("id, name").in("id", accIds) : Promise.resolve({ data: [] }),
    propIds.length ? admin.from("properties").select("id, name, public_title").in("id", propIds) : Promise.resolve({ data: [] }),
    admin.from("messages").select("conversation_id, created_at").in("conversation_id", rows.map((r) => r.id)).eq("direction", "inbound"),
  ]);
  const nameBy = new Map(((accs ?? []) as { id: string; name: string | null }[]).map((a) => [a.id, a.name]));
  const titleBy = new Map(((props ?? []) as { id: string; name: string; public_title: string | null }[]).map((p) => [p.id, p.public_title || p.name]));

  const unreadBy = new Map<string, number>();
  const lastRead = new Map(rows.map((r) => [r.id, r.owner_last_read_at ? new Date(r.owner_last_read_at).getTime() : 0]));
  for (const m of ((inbound ?? []) as { conversation_id: string; created_at: string }[])) {
    if (new Date(m.created_at).getTime() > (lastRead.get(m.conversation_id) ?? 0)) {
      unreadBy.set(m.conversation_id, (unreadBy.get(m.conversation_id) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({
    conversationId: r.id,
    guestFirstName: ((r.account_id ? nameBy.get(r.account_id) : null) ?? "Guest").trim().split(/\s+/)[0],
    listingTitle: (r.property_id ? titleBy.get(r.property_id) : null) ?? "Your listing",
    lastPreview: r.last_message_preview,
    lastAt: r.last_message_at,
    unread: unreadBy.get(r.id) ?? 0,
  }));
}

/** Messages for one host-owned thread (service-role read after ownership check —
 *  used for the initial render; live updates arrive via session-RLS realtime). */
export async function getHostThreadMessages(conversationId: string): Promise<import("@/lib/data/chat").ChatMessage[]> {
  const user = await currentUser();
  if (!user) return [];
  const admin = createAdminClient();
  const { data: convo } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("owner_account_id", user.id)
    .maybeSingle();
  if (!convo) return [];
  const { data } = await admin
    .from("messages")
    .select("id, direction, sender_kind, type, body, media_url, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(300);
  return (data ?? []) as import("@/lib/data/chat").ChatMessage[];
}

/** Whether the signed-in account has passed CNIC verification (hosting gate). */
export async function getHostIdVerified(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("accounts").select("id_verified_at").eq("id", user.id).maybeSingle();
  return Boolean(data?.id_verified_at);
}

// ── Host stays + earnings ────────────────────────────────────────────────────

export type HostStay = {
  id: string;
  listingTitle: string;
  guestFirstName: string; // privacy: first name only
  checkin: string | null;
  checkout: string | null;
  nights: number | null;
  amount: number;
  advancePaid: number;
  status: string;
};

export type HostStats = {
  listings: number;
  liveListings: number;
  upcomingStays: number;
  monthValue: number; // booked value with checkin this calendar month
  monthCommission: number; // Esker fee on that value (0 while free)
  upcoming: HostStay[]; // soonest few, for the dashboard
};

const ACTIVE = ["awaiting_payment", "payment_collected", "handed_over", "awaiting_checkin", "currently_staying"];

/** Dashboard numbers + the next stays across all of the host's listings. */
export async function getHostStats(): Promise<HostStats> {
  const empty: HostStats = { listings: 0, liveListings: 0, upcomingStays: 0, monthValue: 0, monthCommission: 0, upcoming: [] };
  const user = await currentUser();
  if (!user) return empty;
  const admin = createAdminClient();

  const { data: props } = await admin
    .from("properties")
    .select("id, name, public_title, listing_status")
    .eq("owner_account_id", user.id)
    .eq("owner_relationship", "host");
  const listings = (props ?? []) as { id: string; name: string; public_title: string | null; listing_status: string | null }[];
  if (listings.length === 0) return empty;
  const titleById = new Map(listings.map((p) => [p.id, p.public_title || p.name]));

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const { data: bk } = await admin
    .from("bookings")
    .select("id, property_id, checkin, checkout, nights, amount, advance_paid, status, guest:guests(name)")
    .in("property_id", listings.map((p) => p.id))
    .in("status", ACTIVE)
    .gte("checkout", today)
    .order("checkin", { ascending: true })
    .limit(50);
  const stays = ((bk ?? []) as unknown as {
    id: string; property_id: string; checkin: string | null; checkout: string | null; nights: number | null;
    amount: number | null; advance_paid: number | null; status: string; guest: { name: string | null } | null;
  }[]).map((b) => ({
    id: b.id,
    listingTitle: titleById.get(b.property_id) ?? "Your listing",
    guestFirstName: (b.guest?.name ?? "Guest").trim().split(/\s+/)[0],
    checkin: b.checkin,
    checkout: b.checkout,
    nights: b.nights,
    amount: Math.max(0, Math.round(Number(b.amount) || 0)),
    advancePaid: Math.max(0, Math.round(Number(b.advance_paid) || 0)),
    status: b.status,
  }));

  const monthValue = stays.filter((s) => (s.checkin ?? "") >= monthStart).reduce((n, s) => n + s.amount, 0);
  return {
    listings: listings.length,
    liveListings: listings.filter((p) => (p.listing_status ?? "live") === "live").length,
    upcomingStays: stays.length,
    monthValue,
    monthCommission: hostCommission(monthValue),
    upcoming: stays.slice(0, 5),
  };
}
