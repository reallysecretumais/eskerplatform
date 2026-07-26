import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Day-use blocks and hourly windows for slotted listings (app plan §4.6).
 *
 * ONE module for both faces: the website's slot picker and the mobile app's
 * booking sheet import from here, so a pool can never be sold two different ways.
 *
 * All reads go through the public views added by `19_bookable.sql`
 * (`public_slots`, `public_slot_availability`), which are already gated to
 * published, live listings — so there is no way to read a private schedule here.
 * Before that migration runs the views don't exist; every function degrades to
 * "no slots", which renders as a listing with no bookable times rather than a
 * crash.
 */

export type Slot = {
  id: string;
  label: string;
  /** "HH:MM:SS" local (Asia/Karachi). */
  startTime: string;
  endTime: string;
  price: number;
  /** Weekdays this block runs (0=Sunday…6=Saturday). Empty = every day. */
  daysOfWeek: number[];
  capacity: number;
};

export type BusyTime = { startsAt: string; endsAt: string; slotId: string | null };

/** The bookable block menu for a listing, in display order. */
export async function getSlots(listingId: string): Promise<Slot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_slots")
    .select("id,label,start_time,end_time,price,days_of_week,capacity,sort_order")
    .eq("property_id", listingId)
    .order("sort_order");

  if (error) {
    // Pre-migration this is expected once per listing view; log quietly rather
    // than pretending the listing has no schedule for a different reason.
    console.error("[slots] read failed:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    startTime: r.start_time as string,
    endTime: r.end_time as string,
    price: Number(r.price) || 0,
    daysOfWeek: ((r.days_of_week as number[] | null) ?? []).map(Number),
    capacity: Number(r.capacity) || 1,
  }));
}

/** Taken time ranges for a slotted listing, so the UI can dim (never hide) them. */
export async function getBusyTimes(listingId: string): Promise<BusyTime[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_slot_availability")
    .select("starts_at,ends_at,slot_id")
    .eq("property_id", listingId)
    .order("starts_at");

  if (error) {
    console.error("[slots] busy read failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    slotId: (r.slot_id as string | null) ?? null,
  }));
}

/** True when this weekday (0=Sun…6=Sat) is one the block runs on. */
export function slotRunsOn(slot: Slot, weekday: number): boolean {
  return slot.daysOfWeek.length === 0 || slot.daysOfWeek.includes(weekday);
}

/**
 * Is a specific block on a specific date still free?
 *
 * Compares against booked ranges rather than slot ids, because an HOURLY booking
 * on the same listing can straddle a block's window — matching on slot id alone
 * would happily double-sell that afternoon.
 */
export function isSlotFree(date: string, slot: Slot, busy: BusyTime[]): boolean {
  const start = new Date(`${date}T${slot.startTime}`).getTime();
  // A block ending at midnight belongs to the evening it started, not the next day.
  const endRaw = new Date(`${date}T${slot.endTime}`).getTime();
  const end = endRaw <= start ? endRaw + 24 * 60 * 60 * 1000 : endRaw;

  return !busy.some((b) => {
    const bs = new Date(b.startsAt).getTime();
    const be = new Date(b.endsAt).getTime();
    return bs < end && be > start; // half-open overlap, same rule as the DB constraint
  });
}
