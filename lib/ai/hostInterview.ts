import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTERVIEW_OPENER, type InterviewFields, type ChatMsg } from "./hostInterviewShared";

// ── The host-listing interview engine ────────────────────────────────────────
// A conversational interviewer that turns a 2-minute chat into a draft listing.
// Two-layer prompt:
//   • ENGINE layer (below, in code): the JSON contract, extraction rules, the
//     never-re-ask discipline, done-criteria, language mirroring. Not editable —
//     breaking it would break the live preview and draft creation.
//   • STYLE layer (founder-editable): persona/tone/pacing, stored in the shared
//     `app_settings` table under `ai_host_interview_prompt` (same mechanism as
//     the CRM's staff/inbox AI prompts, editable from CRM Settings). A strong
//     default ships in code and is used when no override exists.

export const MODEL = process.env.ESKER_AI_MODEL || "gpt-4.1-mini";

// Re-export the client-safe pieces so existing server imports of this module
// keep working. The definitions live in hostInterviewShared (no server-only).
export { INTERVIEW_OPENER };
export type { InterviewFields, ChatMsg };

export type InterviewTurnResult =
  | { ok: true; reply: string; fields: InterviewFields; done: boolean }
  | { ok: false; message: string };

// Founder-editable persona. Kept separate from the machine contract so edits
// can never break extraction. This is the DEFAULT when no app_settings override.
export const DEFAULT_STYLE = `PERSONA & STYLE (Esker):
- You are Esker's listing assistant: warm, sharp, genuinely fun to talk to — like a friendly local expert who's excited about their place, never a form-filling robot.
- React to what they say with ONE short, genuine beat before your next question ("A rooftop? Guests love that." / "E-11 — great area for families."). Vary your reactions; never repeat the same phrase twice.
- Keep every message SHORT: the reaction plus one clear question. Two sentences, three at most. No lists, no bullet points, no emoji spam (one ✨ or similar occasionally is fine).
- Pakistani warmth and context: you know Islamabad's areas, load-shedding matters (generator/UPS is a selling point), families care about privacy and parking, chai on a terrace is a vibe.
- If the host writes in Urdu or Roman Urdu, reply in respectful Roman Urdu (aap, not tum) — warm and natural, mixing everyday English words the way people actually talk. Once they've written Roman Urdu, STAY in Roman Urdu for the rest of the chat (don't drift back to English). If they write English, stay in English.
- Never oversell or invent. If they say it's simple, it's "comfortable and well-kept", not "luxury".`;

// The machine contract — NOT editable.
function engineRules(known: InterviewFields, areas: string[], categories: string[], priceBands: string): string {
  const knownLines = Object.entries(known)
    .filter(([, v]) => v !== undefined && v !== null && (Array.isArray(v) ? v.length : String(v).length))
    .map(([k, v]) => `  ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");

  return `You are interviewing a property owner to create their short-stay listing on Esker Stays (Islamabad/Rawalpindi, Pakistan).

FIELDS TO COLLECT (the checklist):
- category — one of: ${categories.join(", ")}
- area — one of Esker's covered areas EXACTLY as written: ${areas.join(" | ")} (if their location isn't one of these, pick the closest one and confirm it with them)
- bedrooms AND capacity (how many guests it sleeps) — ask these together
- what makes the place special (use it for amenities + the description)
- price per night in PKR — their number, or offer a suggestion from the typical rates below when they're unsure
- amenities — extract from everything they say (WiFi, AC, Parking, Kitchen, Generator/UPS, Pool, Terrace, etc.); never ask for a raw list

TYPICAL NIGHTLY RATES (real Esker data — use ONLY when suggesting a price):
${priceBands || "  (no data — suggest they pick a price and adjust later)"}

ALREADY KNOWN (NEVER ask about these again — this is the current state):
${knownLines || "  (nothing yet)"}

INTERVIEW DISCIPLINE:
- Extract EVERY field you can from EVERY message — a chatty answer may fill 4 fields at once; harvest them all, then ask only about what's still missing.
- ONE question per message (bedrooms+capacity count as one paired question). Aim to finish in 5–7 questions total; you MUST wrap up by question 9 using whatever is known.
- Ask in this rough order: the open basics (category+area usually come free) → bedrooms+sleeps → what makes it special → price. Skip anything already known.
- If an answer is vague, gently get specifics once — then move on, never interrogate.

WHEN THE CHECKLIST IS COMPLETE (or you hit the cap):
- Set "done": true and produce the finished listing in "fields":
  • title: ≤60 chars, specific and appealing. Do NOT use clichés — banned words: "stunning", "luxurious", "luxury", "getaway", "oasis", "nestled". Good: "Sunlit 2-Bed with Margalla Views & Rooftop Chai Corner".
  • description: AT LEAST 80 words (aim 80–120), premium but honest, in Esker's warm tone — lead with the best feature, weave in the area, family/practical notes (parking, generator) if mentioned. Write it in ENGLISH regardless of interview language (it's shown to all guests).
  • plus every other collected field.
- Your "reply" for the done turn: one warm line telling them their listing is drafted and photos are next (in THEIR language).

OUTPUT — return ONLY this JSON object, using EXACTLY these key names (this is a strict machine contract):
{
  "reply": string,              // your next message to the host (their language)
  "fields": {                   // include ONLY keys you learned or refined THIS turn
    "title": string,            // listing title (done turn, or if the host names it)
    "category": string,         // one of the categories above
    "area": string,             // one covered area, EXACTLY as written above
    "bedrooms": number,
    "capacity": number,         // guests it sleeps
    "price": number,            // nightly price in PKR — the key is ALWAYS "price"
    "amenities": string[],      // extracted features
    "description": string       // the finished writeup (done turn)
  },
  "done": boolean
}
CRITICAL: use ONLY those exact key names. Never invent keys — NOT "price_per_night", NOT "what_makes_special", NOT "features", NOT "sleeps". Fold "what makes it special" into "amenities" and the "description". Price is always "price".`;
}

/** Founder-editable style override from app_settings (shared table; edited in
 *  CRM Settings). Falls back to the built-in default. */
export async function getInterviewStyle(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_settings").select("value").eq("key", "ai_host_interview_prompt").maybeSingle();
    const text = (data?.value as { text?: string } | null)?.text;
    return text && text.trim().length > 20 ? text.trim() : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

/** Typical nightly rates per category+area from the real public listings —
 *  grounds the interviewer's price suggestions in reality. */
export async function getPriceBands(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("public_listings").select("category, area, price");
    const groups = new Map<string, number[]>();
    for (const r of (data ?? []) as { category: string | null; area: string | null; price: number | null }[]) {
      if (!r.price) continue;
      const key = `${r.category ?? "Stay"} in ${r.area ?? "Islamabad"}`;
      groups.set(key, [...(groups.get(key) ?? []), Number(r.price)]);
    }
    const fmt = (n: number) => `₨${Math.round(n).toLocaleString("en-PK")}`;
    return [...groups.entries()]
      .map(([k, prices]) => {
        const min = Math.min(...prices), max = Math.max(...prices);
        return `  ${k}: ${min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`}/night`;
      })
      .join("\n");
  } catch {
    return "";
  }
}

/** One interview turn: transcript in → { reply, newly-extracted fields, done }.
 *  Malformed JSON gets one retry; hard failures return ok:false so the UI can
 *  offer the manual form. */
export async function runInterviewTurn(
  transcript: ChatMsg[],
  known: InterviewFields,
  ctx: { areas: string[]; categories: string[]; priceBands: string; style: string },
): Promise<InterviewTurnResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, message: "AI listing isn't available right now — the manual form works great too." };

  const system = `${engineRules(known, ctx.areas, ctx.categories, ctx.priceBands)}\n\n${ctx.style}`;
  const messages = [
    { role: "system", content: system },
    { role: "assistant", content: INTERVIEW_OPENER },
    ...transcript.slice(-24).map((m) => ({ role: m.role, content: m.content.slice(0, 800) })),
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, temperature: 0.7, response_format: { type: "json_object" }, messages }),
      });
      const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content;
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { reply?: string; fields?: InterviewFields; done?: boolean };
      if (typeof parsed.reply !== "string" || !parsed.reply.trim()) continue;
      return { ok: true, reply: parsed.reply.trim(), fields: parsed.fields ?? {}, done: Boolean(parsed.done) };
    } catch {
      /* retry once */
    }
  }
  return { ok: false, message: "The assistant hiccuped — try again, or use the manual form." };
}

/** Server-side sanitisation of model-extracted fields — the model can never
 *  write junk into a draft. Area must match a covered label (case-insensitive). */
export function sanitiseFields(f: InterviewFields, areas: string[]): InterviewFields {
  const out: InterviewFields = {};
  if (typeof f.title === "string" && f.title.trim().length >= 4) out.title = f.title.trim().slice(0, 90);
  if (typeof f.category === "string" && f.category.trim()) out.category = f.category.trim().slice(0, 40);
  if (typeof f.area === "string" && f.area.trim()) {
    const match = areas.find((a) => a.toLowerCase() === f.area!.trim().toLowerCase());
    if (match) out.area = match;
  }
  if (typeof f.bedrooms === "number" && f.bedrooms >= 0 && f.bedrooms <= 20) out.bedrooms = Math.round(f.bedrooms);
  if (typeof f.capacity === "number" && f.capacity >= 1 && f.capacity <= 40) out.capacity = Math.round(f.capacity);
  if (typeof f.price === "number" && f.price >= 1000 && f.price <= 1_000_000) out.price = Math.round(f.price);
  if (Array.isArray(f.amenities)) {
    const list = f.amenities.filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim().slice(0, 40)).slice(0, 30);
    if (list.length) out.amenities = list;
  }
  if (typeof f.description === "string" && f.description.trim().length >= 40) out.description = f.description.trim().slice(0, 2500);
  return out;
}
