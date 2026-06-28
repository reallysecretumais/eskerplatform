import "server-only";
import { getListings, type PublicListing } from "@/lib/data/listings";
import { unitForCategory } from "@/lib/listings";

// The Esker Brain (guest surface). Retrieval-first: callers pass ONLY the public
// listings (+ public-safe facts) to the model, so it can never see or leak
// anything internal. Shared by the streaming chat route and the single-shot
// search path.

export const MODEL = process.env.ESKER_AI_MODEL || "gpt-4.1-mini";

const RULES = `You are the Esker Stays concierge — a warm, concise, premium hospitality assistant for a short-stay booking site in Islamabad and Rawalpindi, Pakistan.

- Recommend ONLY from the listings provided in the conversation. Never invent places, prices, areas, or details.
- Understand the guest even in Roman Urdu (e.g. "mujhe F-7 mein 2 din ke liye chahiye"), but ALWAYS reply in clean, natural English.
- Use the conversation history for context — handle refinements like "cheaper", "with a pool too", "for 6 guests".
- Answer property questions (parking, distance to landmarks, family-friendly, check-in, house rules) from each listing's details and "facts". If a detail genuinely isn't in the data, say you'll confirm it rather than guessing.
- If nothing fits well, say so warmly and offer the closest available options.
- Keep replies short (1-4 sentences), genuinely helpful, and human — never robotic, never pushy.
- You never handle payments, negotiate prices, or take bookings. Guide the guest to view a place and book on the site.
- You only know the public listings provided. Never discuss or speculate about owners, finances, other guests, staff, or anything internal — you simply don't have that information.`;

// Conversational (streaming) prompt: prose + a machine-readable tail.
export const CONCIERGE_SYSTEM = `${RULES}

At the very END of your reply, on its own new line, output exactly:
STAYS: <comma-separated listing ids you are recommending, best first; leave empty if none>
Never mention this line, the word STAYS, or any ids in your prose.`;

// Single-shot (JSON) prompt.
const JSON_SYSTEM = `${RULES}

Return ONLY JSON: {"reply": string, "listing_ids": string[]}. listing_ids must be ids from the provided list, best match first; use [] if nothing is a reasonable match.`;

export function catalog(listings: PublicListing[]): string {
  return listings
    .map((l) => {
      const unit = unitForCategory(l.category ?? "");
      const amen = (l.amenities ?? []).slice(0, 8).join(", ") || "—";
      const facts = l.public_facts ? ` | facts: ${l.public_facts}` : "";
      const desc = l.description ? ` | ${l.description}` : "";
      return `id:${l.id} | ${l.title} | ${l.category ?? "stay"} | area:${l.area ?? "?"} | ${l.bedrooms ?? "?"}BR | sleeps:${l.capacity ?? "?"} | PKR ${l.price}/${unit} | ${amen}${desc}${facts}${l.esker_exclusive ? " | Esker Exclusive" : ""}`;
    })
    .join("\n");
}

export type ConciergeResult = { reply: string; matches: PublicListing[] };

// Single-shot answer (used by direct /stays?q links). The streaming chat uses
// the API route with CONCIERGE_SYSTEM instead.
export async function askConcierge(query: string): Promise<ConciergeResult> {
  const listings = await getListings();
  const apiKey = process.env.OPENAI_API_KEY;

  const keyword = (): PublicListing[] => {
    const q = query.toLowerCase();
    const hits = listings.filter((l) =>
      [l.title, l.area, l.category, l.description, l.public_facts, ...(l.amenities ?? [])].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
    return hits.length ? hits : listings.slice(0, 6);
  };

  if (!apiKey) return { reply: "Here are some stays that might suit you.", matches: keyword() };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: JSON_SYSTEM },
          { role: "user", content: `Available listings:\n${catalog(listings)}\n\nGuest: ${query}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { reply?: string; listing_ids?: string[] };
    const valid = new Set(listings.map((l) => l.id));
    const matches = (parsed.listing_ids ?? []).filter((id) => valid.has(id)).map((id) => listings.find((l) => l.id === id)!).filter(Boolean);
    return { reply: parsed.reply?.trim() || "Here's what I found for you.", matches: matches.length ? matches : keyword() };
  } catch (e) {
    console.error("[concierge] failed:", (e as Error).message);
    return { reply: "Here are some stays that might suit you.", matches: keyword() };
  }
}
