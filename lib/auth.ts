import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AccountRole = "guest" | "owner" | "partner";

export type Account = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  phoneVerified: boolean;
  roles: AccountRole[];
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  language: "en" | "ur";
  avatarUrl: string | null;
};

// The authenticated user, fetched at most ONCE per request. `auth.getUser()` is a
// network round-trip to Supabase; several reads need the user id, so caching it
// removes the auth waterfall on every account page. Returns null when signed out.
export const currentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// The current website account (guest/owner/partner) + its role set, or null if
// signed out. Cached per request. Reads only the account's own rows (RLS).
export const getAccount = cache(async (): Promise<Account | null> => {
  const user = await currentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: acct }, { data: roleRows }] = await Promise.all([
    supabase.from("accounts").select("id,email,name,phone,phone_verified_at,notify_email,notify_whatsapp,language,avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("account_id", user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as AccountRole);

  // Authenticated but no account row (e.g. a staff member who signed into the
  // site) → treat as a bare account with no website roles. Never exposes
  // internal data (is_staff() still gates that separately).
  if (!acct) {
    return { id: user.id, email: user.email ?? null, name: null, phone: null, phoneVerified: false, roles, notifyEmail: true, notifyWhatsapp: true, language: "en", avatarUrl: null };
  }
  return {
    id: acct.id,
    email: acct.email,
    name: acct.name,
    phone: acct.phone,
    phoneVerified: Boolean(acct.phone_verified_at),
    roles,
    notifyEmail: acct.notify_email ?? true,
    notifyWhatsapp: acct.notify_whatsapp ?? true,
    language: (acct.language as "en" | "ur") ?? "en",
    avatarUrl: (acct.avatar_url as string | null) ?? null,
  };
});

export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  return account;
}

export type BookingListing = { id: string; title: string; area: string | null; category: string | null; photos: string[] | null };

export type MyBooking = {
  id: string;
  checkin: string | null;
  checkout: string | null;
  amount: number;
  advancePaid: number;
  balance: number;
  paymentStatus: string | null;
  status: string;
  nights: number | null;
  listing: BookingListing | null;
};

// Full detail for one booking (adds rate + source + created_at to MyBooking).
export type MyBookingDetail = MyBooking & {
  rateAtBooking: number | null;
  source: string | null;
  createdAt: string | null;
};

const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

// The signed-in guest's own bookings (RLS-scoped to account_id), joined to the
// public listing for display. Returns [] when signed out.
export async function getMyBookings(): Promise<MyBooking[]> {
  const user = await currentUser();
  if (!user) return [];
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, property_id, checkin, checkout, amount, advance_paid, payment_status, status, nights")
    .eq("account_id", user.id)
    .order("checkin", { ascending: false });
  if (!bookings || bookings.length === 0) return [];

  const ids = [...new Set(bookings.map((b) => b.property_id))];
  const { data: listings } = await supabase.from("public_listings").select("id, title, area, category, photos").in("id", ids);
  const byId = new Map((listings ?? []).map((l) => [l.id, l as BookingListing]));

  return bookings.map((b) => {
    const amount = num(b.amount);
    const advancePaid = num(b.advance_paid);
    return {
      id: b.id,
      checkin: b.checkin,
      checkout: b.checkout,
      amount,
      advancePaid,
      balance: Math.max(0, amount - advancePaid),
      paymentStatus: b.payment_status ?? null,
      status: b.status,
      nights: b.nights,
      listing: byId.get(b.property_id) ?? null,
    };
  });
}

// One booking the signed-in guest owns (RLS guarantees ownership), with its
// public listing. Returns null if not found / not theirs / signed out.
export async function getMyBooking(id: string): Promise<MyBookingDetail | null> {
  const user = await currentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("bookings")
    .select("id, property_id, checkin, checkout, amount, advance_paid, payment_status, status, nights, rate_at_booking, source, created_at")
    .eq("id", id)
    .eq("account_id", user.id)
    .maybeSingle();
  if (!b) return null;

  const { data: listing } = await supabase
    .from("public_listings")
    .select("id, title, area, category, photos")
    .eq("id", b.property_id)
    .maybeSingle();

  const amount = num(b.amount);
  const advancePaid = num(b.advance_paid);
  return {
    id: b.id,
    checkin: b.checkin,
    checkout: b.checkout,
    amount,
    advancePaid,
    balance: Math.max(0, amount - advancePaid),
    paymentStatus: b.payment_status ?? null,
    status: b.status,
    nights: b.nights,
    listing: (listing as BookingListing) ?? null,
    rateAtBooking: b.rate_at_booking != null ? Number(b.rate_at_booking) : null,
    source: b.source ?? null,
    createdAt: b.created_at ?? null,
  };
}

