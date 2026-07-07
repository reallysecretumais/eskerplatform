"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyId } from "@/lib/ai/idcheck";
import { notifyChatEmail } from "@/lib/notifyChat";

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
  area: string;
  bedrooms: number | null;
  capacity: number | null;
  price: number;
  description: string;
  amenities: string[];
};

function parseListing(formData: FormData): { ok: true; v: ListingInput } | { ok: false; message: string } {
  const title = String(formData.get("title") || "").trim().slice(0, 90);
  const category = String(formData.get("category") || "").trim().slice(0, 40);
  const area = String(formData.get("area") || "").trim().slice(0, 60);
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
  if (!area) return { ok: false, message: "Enter the area (e.g. E-11, Bahria Phase 7)." };
  if (price < 1000) return { ok: false, message: "Enter a nightly price of at least ₨1,000." };
  if (description.length < 40) return { ok: false, message: "Describe your place in a few sentences (at least 40 characters)." };

  return {
    ok: true,
    v: {
      title,
      category,
      area,
      bedrooms: bedroomsRaw ? Math.max(0, Math.round(Number(bedroomsRaw) || 0)) : null,
      capacity: capacityRaw ? Math.max(1, Math.round(Number(capacityRaw) || 0)) : null,
      price,
      description,
      amenities,
    },
  };
}

// ── Create / update ──────────────────────────────────────────────────────────

export async function createListing(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const accountId = await sessionUserId();
  if (!accountId) return { ok: false, message: "Please sign in first." };

  const admin = createAdminClient();

  // Gate: host role + WhatsApp verified + CNIC verified.
  const [{ data: acct }, { data: roles }] = await Promise.all([
    admin.from("accounts").select("name, phone_verified_at, id_verified_at").eq("id", accountId).maybeSingle(),
    admin.from("account_roles").select("role").eq("account_id", accountId).eq("role", "owner"),
  ]);
  if (!roles || roles.length === 0) return { ok: false, message: "Unlock your host space first." };
  if (!acct?.phone_verified_at) return { ok: false, message: "Verify your WhatsApp number before listing (Profile → Verify)." };
  if (!acct?.id_verified_at) return { ok: false, message: "Verify your CNIC before listing." };

  const parsed = parseListing(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const v = parsed.v;

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
      bedrooms: v.bedrooms,
      capacity: v.capacity,
      nightly_rate: v.price,
      amenities: v.amenities,
      photos: [],
      public_listing: false, // flips true only on admin approval
      listing_status: "pending",
      owner_relationship: "host",
      comms_owner: "owner",
      owner_account_id: accountId,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, message: "Could not create your listing. Please try again." };

  await notifyStaff(admin, {
    title: `New host listing to review — ${v.title}`,
    body: `${acct?.name || "A host"} · ${v.category} in ${v.area} · ₨${v.price.toLocaleString("en-PK")}/night`,
    link: `/properties/${row.id}`,
  });

  revalidatePath("/host");
  revalidatePath("/host/listings");
  return { ok: true, message: "Listing submitted — we'll review it shortly.", id: row.id };
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

  // Edits go live instantly (founder decision) — status/publish flags untouched.
  const { error } = await admin
    .from("properties")
    .update({
      public_title: v.title,
      public_description: v.description,
      kind: v.category,
      area: v.area,
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
