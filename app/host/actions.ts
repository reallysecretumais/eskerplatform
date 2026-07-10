"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyId } from "@/lib/ai/idcheck";
import { notifyChatEmail } from "@/lib/notifyChat";
import {
  runInterviewTurn,
  sanitiseFields,
  getInterviewStyle,
  getPriceBands,
  type InterviewFields,
  type ChatMsg,
} from "@/lib/ai/hostInterview";
import { getCoveredAreas } from "@/lib/data/host";
import { PAYOUT_METHODS, MIN_LISTING_PHOTOS, MAX_LISTING_PHOTOS } from "@/lib/hostConstants";

export type ActionResult = { ok: boolean; message: string; id?: string };

// Host listing writes. Base-table RLS doesn't grant hosts access to `properties`,
// so every mutation here re-validates the session, confirms the row belongs to
// the host (owner_account_id + owner_relationship='host'), then writes via the
// service role — the same validated-elevated pattern the booking flow uses.

const PHOTO_BUCKET = "property-photos";
const DOC_BUCKET = "guest-docs"; // private — host CNICs live under host-ids/{accountId}/
const MAX_PHOTOS = 14;
const MAX_BYTES = 10 * 1024 * 1024;

function ext(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (file.type.split("/")[1] || "jpg").toLowerCase();
}

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

type Admin = ReturnType<typeof createAdminClient>;

/** The host's own listing row, or null (not theirs / not a host listing). */
async function ownListing(admin: Admin, accountId: string, listingId: string) {
  const { data } = await admin
    .from("properties")
    .select("id, name, public_title, photos, listing_status")
    .eq("id", listingId)
    .eq("owner_account_id", accountId)
    .eq("owner_relationship", "host")
    .maybeSingle();
  return data as { id: string; name: string; public_title: string | null; photos: string[] | null; listing_status: string | null } | null;
}

/** In-app alert for every active staff member (same shape as booking alerts). */
async function notifyStaff(admin: Admin, n: { title: string; body: string; link: string }): Promise<void> {
  try {
    const { data: staff } = await admin.from("users").select("id").eq("active", true);
    const rows = (staff ?? []).map((u: { id: string }) => ({ user_id: u.id, type: "listing", title: n.title, body: n.body, link: n.link }));
    if (rows.length) await admin.from("notifications").insert(rows);
  } catch {
    /* best-effort */
  }
}

// ── Shared form parsing ──────────────────────────────────────────────────────

type ListingInput = {
  title: string;
  category: string;
  areaId: string;
  bedrooms: number | null;
  capacity: number | null;
  price: number;
  description: string;
  amenities: string[];
};

function parseListing(formData: FormData): { ok: true; v: ListingInput } | { ok: false; message: string } {
  const title = String(formData.get("title") || "").trim().slice(0, 90);
  const category = String(formData.get("category") || "").trim().slice(0, 40);
  const areaId = String(formData.get("areaId") || "").trim();
  const description = String(formData.get("description") || "").trim().slice(0, 2500);
  const price = Math.round(Number(formData.get("price")) || 0);
  const bedroomsRaw = String(formData.get("bedrooms") || "").trim();
  const capacityRaw = String(formData.get("capacity") || "").trim();
  const amenities = String(formData.get("amenities") || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 30);

  if (title.length < 4) return { ok: false, message: "Give your place a name (at least 4 characters)." };
  if (!category) return { ok: false, message: "Pick a category." };
  if (!areaId) return { ok: false, message: "Pick the area your place is in." };
  if (price < 1000) return { ok: false, message: "Enter a nightly price of at least ₨1,000." };
  if (description.length < 40) return { ok: false, message: "Describe your place in a few sentences (at least 40 characters)." };

  return {
    ok: true,
    v: {
      title,
      category,
      areaId,
      bedrooms: bedroomsRaw ? Math.max(0, Math.round(Number(bedroomsRaw) || 0)) : null,
      capacity: capacityRaw ? Math.max(1, Math.round(Number(capacityRaw) || 0)) : null,
      price,
      description,
      amenities,
    },
  };
}

/** Resolve a picked covered-area id → { id, guest-facing label }. */
async function resolveArea(admin: Admin, areaId: string): Promise<{ id: string; label: string } | null> {
  const { data } = await admin.from("locations").select("id, name").eq("id", areaId).maybeSingle();
  if (!data) return null;
  const name = data.name as string;
  return { id: data.id as string, label: name === "Near Airport" ? "Near Islamabad Airport" : name };
}

// ── Create (draft) / submit / update ─────────────────────────────────────────

/** Both verification gates + host role, or a message explaining what's missing. */
async function hostGate(admin: Admin, accountId: string): Promise<{ ok: true; name: string | null } | { ok: false; message: string }> {
  const [{ data: acct }, { data: roles }] = await Promise.all([
    admin.from("accounts").select("name, phone_verified_at, id_verified_at").eq("id", accountId).maybeSingle(),
    admin.from("account_roles").select("role").eq("account_id", accountId).eq("role", "owner"),
  ]);
  if (!roles || roles.length === 0) return { ok: false, message: "Unlock your host space first." };
  if (!acct?.phone_verified_at) return { ok: false, message: "Verify your WhatsApp number before listing (Profile → Verify)." };
  if (!acct?.id_verified_at) return { ok: false, message: "Verify your CNIC before listing." };
  return { ok: true, name: (acct?.name as string) ?? null };
}

/** Shared draft insert (form path + AI-interview path). Drafts are private: not
 *  public (view needs 'live') and not in the CRM queue (needs 'pending'). */
async function insertDraft(
  admin: Admin,
  accountId: string,
  v: { title: string; category: string; area: string; locationId: string | null; bedrooms: number | null; capacity: number | null; price: number; description: string; amenities: string[] },
): Promise<string | null> {
  // properties.name is UNIQUE — host titles can collide, so the internal name
  // carries a short suffix; the guest-facing title lives in public_title.
  const suffix = crypto.randomUUID().slice(0, 6);
  const { data: row, error } = await admin
    .from("properties")
    .insert({
      name: `${v.title} — ${suffix}`,
      public_title: v.title,
      public_description: v.description,
      kind: v.category,
      area: v.area,
      location_id: v.locationId,
      bedrooms: v.bedrooms,
      capacity: v.capacity,
      nightly_rate: v.price,
      amenities: v.amenities,
      photos: [],
      public_listing: false, // flips true only on admin approval
      listing_status: "draft",
      owner_relationship: "host",
      comms_owner: "owner",
      owner_account_id: accountId,
    })
    .select("id")
    .single();
  return error || !row ? null : (row.id as string);
}

/** Start a listing from the manual form → a private draft; next step is photos. */
export async function createDraft(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };
  const admin = createAdminClient();

  const gate = await hostGate(admin, accountId);
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = parseListing(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const v = parsed.v;
  const area = await resolveArea(admin, v.areaId);
  if (!area) return { ok: false, message: "Pick the area your place is in." };

  const id = await insertDraft(admin, accountId, { ...v, area: area.label, locationId: area.id });
  if (!id) return { ok: false, message: "Could not create your listing. Please try again." };

  revalidatePath("/host");
  revalidatePath("/host/listings");
  return { ok: true, message: "Draft saved — now add your photos.", id };
}

/** The draft's readiness checklist (shared by the submit bar + submitListing). */
export type SubmitChecklist = { title: boolean; description: boolean; price: boolean; photos: boolean; ready: boolean };

function checklistFor(l: { public_title: string | null; public_description?: string | null; nightly_rate?: number | null; photos: string[] | null }): SubmitChecklist {
  const title = Boolean(l.public_title && l.public_title.trim().length >= 4);
  const description = Boolean((l as { public_description?: string | null }).public_description && ((l as { public_description?: string | null }).public_description as string).trim().length >= 40);
  const price = Number((l as { nightly_rate?: number | null }).nightly_rate) >= 1000;
  const photos = (l.photos ?? []).length >= MIN_LISTING_PHOTOS;
  return { title, description, price, photos, ready: title && description && price && photos };
}

/** Submit a finished draft for Esker review (draft → pending + staff bell). */
export async function submitListing(listingId: string): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };
  const admin = createAdminClient();

  const { data: l } = await admin
    .from("properties")
    .select("id, public_title, public_description, kind, area, nightly_rate, photos, listing_status")
    .eq("id", listingId)
    .eq("owner_account_id", accountId)
    .eq("owner_relationship", "host")
    .maybeSingle();
  if (!l) return { ok: false, message: "Listing not found." };
  if (l.listing_status !== "draft" && l.listing_status !== "rejected") {
    return { ok: false, message: "This listing is already submitted." };
  }

  const c = checklistFor(l as { public_title: string | null; public_description: string | null; nightly_rate: number | null; photos: string[] | null });
  if (!c.ready) {
    const missing = [!c.title && "a title", !c.description && "a fuller description", !c.price && "a nightly price", !c.photos && `at least ${MIN_LISTING_PHOTOS} photos`].filter(Boolean).join(", ");
    return { ok: false, message: `Almost there — add ${missing} first.` };
  }

  const { error } = await admin.from("properties").update({ listing_status: "pending", review_note: null }).eq("id", listingId);
  if (error) return { ok: false, message: "Could not submit. Please try again." };

  const { data: acct } = await admin.from("accounts").select("name").eq("id", accountId).maybeSingle();
  await notifyStaff(admin, {
    title: `New host listing to review — ${l.public_title}`,
    body: `${acct?.name || "A host"} · ${l.kind ?? "Listing"} in ${l.area ?? "?"} · ₨${Number(l.nightly_rate || 0).toLocaleString("en-PK")}/night`,
    link: `/properties/${listingId}`,
  });

  revalidatePath("/host");
  revalidatePath("/host/listings");
  revalidatePath(`/host/listings/${listingId}`);
  return { ok: true, message: "Submitted — we'll review it shortly (usually within a day)." };
}

export async function updateListing(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };
  const listingId = String(formData.get("listingId") || "");

  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };

  const parsed = parseListing(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const v = parsed.v;
  const area = await resolveArea(admin, v.areaId);
  if (!area) return { ok: false, message: "Pick the area your place is in." };

  // Edits go live instantly (founder decision) — status/publish flags untouched.
  const { error } = await admin
    .from("properties")
    .update({
      public_title: v.title,
      public_description: v.description,
      kind: v.category,
      area: area.label,
      location_id: area.id,
      bedrooms: v.bedrooms,
      capacity: v.capacity,
      nightly_rate: v.price,
      amenities: v.amenities,
    })
    .eq("id", listingId);
  if (error) return { ok: false, message: "Could not save your changes. Please try again." };

  revalidatePath("/host/listings");
  revalidatePath(`/host/listings/${listingId}`);
  revalidatePath(`/stays/${listingId}`);
  return { ok: true, message: "Changes saved — they're live." };
}

// ── AI listing interview ─────────────────────────────────────────────────────

const INTERVIEW_CATEGORIES = ["Apartment", "Penthouse", "Studio", "Villa", "Farmhouse", "House"];

export type InterviewTurnResponse = {
  ok: boolean;
  reply?: string;
  known?: InterviewFields; // server-merged + sanitised state (drives the live preview)
  done?: boolean;
  draftId?: string; // set when the finished interview created the draft
  message?: string; // error / fallback text
};

/** One conversational turn of the AI listing interview. The server owns the
 *  merged field state (sanitised every turn), and on completion creates the
 *  draft itself — the client only ever renders what the server verified. */
export async function interviewTurn(transcript: ChatMsg[], knownIn: InterviewFields): Promise<InterviewTurnResponse> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };
  const admin = createAdminClient();
  const gate = await hostGate(admin, accountId);
  if (!gate.ok) return { ok: false, message: gate.message };

  const [areas, style, priceBands] = await Promise.all([getCoveredAreas(), getInterviewStyle(), getPriceBands()]);
  const areaLabels = areas.map((a) => a.label);
  const known = sanitiseFields(knownIn ?? {}, areaLabels);

  const turn = await runInterviewTurn(
    (transcript ?? []).slice(-24),
    known,
    { areas: areaLabels, categories: INTERVIEW_CATEGORIES, priceBands, style },
  );
  if (!turn.ok) return { ok: false, message: turn.message };

  const merged: InterviewFields = { ...known, ...sanitiseFields(turn.fields, areaLabels) };

  // Done only counts when the essentials actually survived sanitisation —
  // otherwise keep the conversation going (the engine sees what's missing).
  const complete = Boolean(merged.title && merged.category && merged.area && merged.price && merged.description);
  if (turn.done && complete) {
    const areaRow = areas.find((a) => a.label === merged.area);
    const id = await insertDraft(admin, accountId, {
      title: merged.title!,
      category: merged.category!,
      area: merged.area!,
      locationId: areaRow?.id ?? null,
      bedrooms: merged.bedrooms ?? null,
      capacity: merged.capacity ?? null,
      price: merged.price!,
      description: merged.description!,
      amenities: merged.amenities ?? [],
    });
    if (!id) return { ok: false, message: "Could not save your draft — please try again." };
    revalidatePath("/host");
    revalidatePath("/host/listings");
    return { ok: true, reply: turn.reply, known: merged, done: true, draftId: id };
  }

  return { ok: true, reply: turn.reply, known: merged, done: false };
}

// ── Photos ───────────────────────────────────────────────────────────────────

export async function uploadListingPhoto(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };
  const listingId = String(formData.get("listingId") || "");
  const file = formData.get("photo") as File | null;

  if (!file || file.size === 0) return { ok: false, message: "Choose a photo." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Photos must be images (JPG, PNG or WebP)." };
  if (file.size > MAX_BYTES) return { ok: false, message: "That photo is too large (max 10 MB)." };

  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };
  const photos = own.photos ?? [];
  if (photos.length >= MAX_PHOTOS) return { ok: false, message: `Up to ${MAX_PHOTOS} photos per listing.` };

  const path = `${listingId}/${crypto.randomUUID()}.${ext(file)}`;
  const up = await admin.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return { ok: false, message: "Couldn't upload the photo. Please try again." };
  const { data: pub } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);

  const { error } = await admin.from("properties").update({ photos: [...photos, pub.publicUrl] }).eq("id", listingId);
  if (error) return { ok: false, message: "Couldn't save the photo. Please try again." };

  revalidatePath(`/host/listings/${listingId}`);
  revalidatePath(`/stays/${listingId}`);
  return { ok: true, message: "Photo added." };
}

export async function removeListingPhoto(listingId: string, url: string): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };

  const photos = (own.photos ?? []).filter((p) => p !== url);
  await admin.from("properties").update({ photos }).eq("id", listingId);

  // Best-effort storage cleanup (URL → bucket path).
  const marker = `/${PHOTO_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i >= 0) {
    try {
      await admin.storage.from(PHOTO_BUCKET).remove([url.slice(i + marker.length)]);
    } catch {
      /* ignore */
    }
  }

  revalidatePath(`/host/listings/${listingId}`);
  revalidatePath(`/stays/${listingId}`);
  return { ok: true, message: "Photo removed." };
}

export async function setListingCover(listingId: string, url: string): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };

  const photos = own.photos ?? [];
  if (!photos.includes(url)) return { ok: false, message: "That photo isn't on this listing." };
  await admin.from("properties").update({ photos: [url, ...photos.filter((p) => p !== url)] }).eq("id", listingId);

  revalidatePath(`/host/listings/${listingId}`);
  revalidatePath(`/stays/${listingId}`);
  return { ok: true, message: "Cover photo set." };
}

/** Persist a new photo order (first = cover). `ordered` must be a permutation of
 *  the listing's current photos — anything else is rejected. */
export async function reorderListingPhotos(listingId: string, ordered: string[]): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };

  const current = own.photos ?? [];
  // Same set, same length — a true reorder, no adds/drops.
  const same = ordered.length === current.length && [...ordered].sort().join("|") === [...current].sort().join("|");
  if (!same) return { ok: false, message: "Photo list changed — refresh and try again." };

  await admin.from("properties").update({ photos: ordered }).eq("id", listingId);
  revalidatePath(`/host/listings/${listingId}`);
  revalidatePath(`/stays/${listingId}`);
  return { ok: true, message: "Order saved." };
}

// ── Guest info (private stay details + public facts) ────────────────────────

/** Save the listing's guest info: private details into property_info (staff +
 *  confirmed guests) and public facts onto the property (feeds the concierge
 *  and the listing page). Owner-checked. */
export async function saveGuestInfo(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };
  const listingId = String(formData.get("listingId") || "");

  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };

  const t = (k: string, max: number) => String(formData.get(k) || "").trim().slice(0, max) || null;

  const { error: e1 } = await admin.from("property_info").upsert(
    {
      property_id: listingId,
      check_in_instructions: t("checkIn", 2000),
      house_rules: t("houseRules", 2000),
      wifi_name: t("wifiName", 120),
      wifi_password: t("wifiPassword", 120),
      access_notes: t("accessNotes", 2000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );
  const { error: e2 } = await admin.from("properties").update({ public_facts: t("publicFacts", 2000) }).eq("id", listingId);
  if (e1 || e2) return { ok: false, message: "Could not save guest info. Please try again." };

  revalidatePath(`/host/listings/${listingId}`);
  revalidatePath(`/stays/${listingId}`);
  return { ok: true, message: "Guest info saved." };
}

// ── Availability blocks (host calendar) ──────────────────────────────────────

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Block a date range on the host's own listing (end exclusive, like checkout).
 *  Blocked dates grey out on the website and reject bookings. */
export async function blockDates(listingId: string, start: string, end: string, note?: string): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };
  if (!DAY_RE.test(start) || !DAY_RE.test(end) || end <= start) {
    return { ok: false, message: "Pick a valid date range." };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (end <= today) return { ok: false, message: "That range is in the past." };

  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };

  const { error } = await admin.from("property_blocks").insert({
    property_id: listingId,
    start_date: start,
    end_date: end,
    note: (note ?? "").trim().slice(0, 200) || null,
  });
  if (error) return { ok: false, message: "Could not block those dates. Please try again." };

  revalidatePath(`/host/listings/${listingId}`);
  return { ok: true, message: "Dates blocked — guests can't book them." };
}

/** Remove one of the host's own blocks. */
export async function unblockDates(listingId: string, blockId: string): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };
  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };

  const { error } = await admin.from("property_blocks").delete().eq("id", blockId).eq("property_id", listingId);
  if (error) return { ok: false, message: "Could not remove the block. Please try again." };

  revalidatePath(`/host/listings/${listingId}`);
  return { ok: true, message: "Dates opened up again." };
}

// ── Pause / resume ───────────────────────────────────────────────────────────

export async function pauseListing(listingId: string): Promise<ActionResult> {
  return setStatus(listingId, "paused", "Listing paused — it's hidden from the website.");
}
export async function resumeListing(listingId: string): Promise<ActionResult> {
  return setStatus(listingId, "live", "Listing resumed — it's visible again.");
}

async function setStatus(listingId: string, to: "paused" | "live", okMsg: string): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const admin = createAdminClient();
  const own = await ownListing(admin, accountId, listingId);
  if (!own) return { ok: false, message: "Listing not found." };
  // A host can only toggle between live and paused — never out of pending/rejected.
  if (own.listing_status !== (to === "paused" ? "live" : "paused")) {
    return { ok: false, message: "This listing can't be changed right now." };
  }

  const { error } = await admin.from("properties").update({ listing_status: to }).eq("id", listingId);
  if (error) return { ok: false, message: "Could not update the listing. Please try again." };

  revalidatePath("/host/listings");
  revalidatePath(`/host/listings/${listingId}`);
  return { ok: true, message: okMsg };
}

// ── Host inbox (guest↔host threads) ─────────────────────────────────────────

/** A conversation this host owns (owner_account_id = them), or null. */
async function ownThread(admin: Admin, hostId: string, conversationId: string) {
  const { data } = await admin
    .from("conversations")
    .select("id, account_id, property_id, unreplied")
    .eq("id", conversationId)
    .eq("owner_account_id", hostId)
    .maybeSingle();
  return data as { id: string; account_id: string | null; property_id: string | null; unreplied: boolean } | null;
}

/** Host replies to a guest. Realtime delivers it to the guest instantly; a
 *  throttled email brings the guest back if they're not watching. */
export async function sendHostMessage(conversationId: string, body: string): Promise<ActionResult> {
  const hostId = await sessionUserId();
  if (!hostId) return { ok: false, message: "Please sign in first." };
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, message: "Write a message first." };

  const admin = createAdminClient();
  const convo = await ownThread(admin, hostId, conversationId);
  if (!convo) return { ok: false, message: "Conversation not found." };

  const now = new Date().toISOString();
  const { error } = await admin.from("messages").insert({
    conversation_id: convo.id,
    direction: "outbound",
    channel: "website",
    type: "text",
    body: text,
    status: "sent",
    sender_kind: "owner",
    sender_account_id: hostId,
  });
  if (error) return { ok: false, message: "Could not send. Please try again." };

  await admin
    .from("conversations")
    .update({ last_message_at: now, last_message_preview: text.slice(0, 140), unreplied: false, owner_last_read_at: now, updated_at: now })
    .eq("id", convo.id);

  // Bring the guest back if they're away (throttled; realtime covers live viewers).
  if (convo.account_id) {
    try {
      const { data: guest } = await admin.from("accounts").select("email, name, notify_email").eq("id", convo.account_id).maybeSingle();
      if (guest?.email && guest.notify_email !== false) {
        await notifyChatEmail({
          to: guest.email as string,
          name: (guest.name as string) ?? null,
          event: "chat_reply",
          conversationId: convo.id,
          headline: "Your host replied to your message",
          cta: "Read the reply",
          link: "/messages",
        });
      }
    } catch {
      /* best-effort */
    }
  }

  return { ok: true, message: "Sent." };
}

/** Lazy-load one host thread's messages for the inbox (ownership-checked). */
export async function loadHostThreadMessages(conversationId: string) {
  const { getHostThreadMessages } = await import("@/lib/data/host");
  return getHostThreadMessages(conversationId);
}

/** Clear the host-side unread marker when they open a thread. */
export async function markHostThreadRead(conversationId: string): Promise<ActionResult> {
  const hostId = await sessionUserId();
  if (!hostId) return { ok: false, message: "Please sign in first." };
  const admin = createAdminClient();
  const convo = await ownThread(admin, hostId, conversationId);
  if (!convo) return { ok: false, message: "Conversation not found." };
  await admin.from("conversations").update({ owner_last_read_at: new Date().toISOString() }).eq("id", conversationId);
  return { ok: true, message: "ok" };
}

// ── Payout preference (optional) ─────────────────────────────────────────────

/** Save the host's optional payout method + number (stored as JSON in
 *  accounts.payout_details). Payouts are settled directly by Esker for now;
 *  this just gets us ready. */
export async function savePayout(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const method = String(formData.get("method") || "").trim().slice(0, 30);
  const number = String(formData.get("number") || "").trim().slice(0, 40);
  const title = String(formData.get("title") || "").trim().slice(0, 80);

  const admin = createAdminClient();

  // Empty number → clear the whole thing.
  if (!number) {
    const { error } = await admin.from("accounts").update({ payout_details: null }).eq("id", accountId);
    if (error) return { ok: false, message: "Could not save. Please try again." };
    revalidatePath("/host");
    return { ok: true, message: "Payout details cleared." };
  }
  if (!method || !(PAYOUT_METHODS as readonly string[]).includes(method)) {
    return { ok: false, message: "Pick a payment method." };
  }

  const value = JSON.stringify({ method, number, title });
  const { error } = await admin.from("accounts").update({ payout_details: value }).eq("id", accountId);
  if (error) return { ok: false, message: "Could not save. Please try again." };

  revalidatePath("/host");
  return { ok: true, message: "Payout details saved." };
}

// ── Host CNIC verification ───────────────────────────────────────────────────

export async function submitHostId(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const front = formData.get("front") as File | null;
  const back = formData.get("back") as File | null;
  if (!front || front.size === 0 || !back || back.size === 0) {
    return { ok: false, message: "Add both sides of your CNIC." };
  }
  if (front.size > MAX_BYTES || back.size > MAX_BYTES) return { ok: false, message: "ID images are too large (max 10 MB each)." };

  // Same AI check guests pass at booking: genuine, readable, not expired.
  const f = await verifyId(front, "front");
  if (!f.ok) return { ok: false, message: f.message || "The CNIC front couldn't be verified — try a clearer photo." };
  const b = await verifyId(back, "back");
  if (!b.ok) return { ok: false, message: b.message || "The CNIC back couldn't be verified — try a clearer photo." };

  const admin = createAdminClient();
  const frontPath = `host-ids/${accountId}/cnic-front-${Date.now()}.${ext(front)}`;
  const backPath = `host-ids/${accountId}/cnic-back-${Date.now()}.${ext(back)}`;
  const up1 = await admin.storage.from(DOC_BUCKET).upload(frontPath, front, { contentType: front.type, upsert: false });
  const up2 = await admin.storage.from(DOC_BUCKET).upload(backPath, back, { contentType: back.type, upsert: false });
  if (up1.error || up2.error) return { ok: false, message: "Couldn't upload your ID. Please try again." };

  const { error } = await admin
    .from("accounts")
    .update({ id_front_url: frontPath, id_back_url: backPath, id_verified_at: new Date().toISOString() })
    .eq("id", accountId);
  if (error) return { ok: false, message: "Couldn't save your verification. Please try again." };

  revalidatePath("/host");
  return { ok: true, message: "Your identity is verified — you can list your place now." };
}
