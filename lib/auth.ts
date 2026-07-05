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
};

// The current website account (guest/owner/partner) + its role set, or null if
// signed out. Cached per request. Reads only the account's own rows (RLS).
export const getAccount = cache(async (): Promise<Account | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: acct }, { data: roleRows }] = await Promise.all([
    supabase.from("accounts").select("id,email,name,phone,phone_verified_at").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("account_id", user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as AccountRole);

  // Authenticated but no account row (e.g. a staff member who signed into the
  // site) → treat as a bare account with no website roles. Never exposes
  // internal data (is_staff() still gates that separately).
  if (!acct) {
    return { id: user.id, email: user.email ?? null, name: null, phone: null, phoneVerified: false, roles };
  }
  return { id: acct.id, email: acct.email, name: acct.name, phone: acct.phone, phoneVerified: Boolean(acct.phone_verified_at), roles };
});

export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  return account;
}

export type MyBooking = {
  id: string;
  checkin: string | null;
  checkout: string | null;
  amount: number;
  status: string;
  nights: number | null;
  listing: { title: string; area: string | null; photos: string[] | null } | null;
};

// The signed-in guest's own bookings (RLS-scoped to account_id), joined to the
// public listing for display. Returns [] when signed out.
export async function getMyBookings(): Promise<MyBooking[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, property_id, checkin, checkout, amount, status, nights")
    .eq("account_id", user.id)
    .order("checkin", { ascending: false });
  if (!bookings || bookings.length === 0) return [];

  const ids = [...new Set(bookings.map((b) => b.property_id))];
  const { data: listings } = await supabase.from("public_listings").select("id, title, area, photos").in("id", ids);
  const byId = new Map((listings ?? []).map((l) => [l.id, l]));

  return bookings.map((b) => ({
    id: b.id,
    checkin: b.checkin,
    checkout: b.checkout,
    amount: b.amount,
    status: b.status,
    nights: b.nights,
    listing: byId.get(b.property_id) ?? null,
  }));
}

