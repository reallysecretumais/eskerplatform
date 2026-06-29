import type { NextRequest } from "next/server";
import { isUrduText } from "@/lib/listings";

export const runtime = "nodejs";

// Text-to-speech for the voice concierge. Streams an MP3 of the concierge's
// reply back to the browser. One warm brand voice speaks both languages; the
// `instructions` tune the tone per language. Only the (public) reply text is
// spoken — never anything internal.

const TTS_MODEL = process.env.ESKER_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.ESKER_TTS_VOICE || "nova";
const TTS_SPEED = Number(process.env.ESKER_TTS_SPEED || "1.3");

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  let text = "";
  let lang = "";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.slice(0, 1200) : "";
    lang = typeof body?.lang === "string" ? body.lang : "";
  } catch {
    /* ignore */
  }
  if (!apiKey || !text.trim()) return new Response(null, { status: 204 });

  const urdu = lang === "ur" || isUrduText(text);
  const persona =
    "Voice: a pretty, bright young Pakistani woman, completely fluent in English. Tone: sweet, warm, and melodic with a real smile in it — cheerful and charming, genuinely human, never robotic, flat, or harsh. Pace: lively and upbeat, a little faster than normal, light and flowing; do NOT drag or slow down, but stay smooth and pleasant to listen to.";
  const instructions = urdu
    ? `The text is Roman Urdu (the Urdu language written in Latin letters) — read it as natural spoken Urdu, NOT with English pronunciation. ${persona} She is fluent in both Urdu and English, so the English words she mixes in sound natural.`
    : `${persona}`;

  // Only the gpt-4o tts models accept `instructions`; tts-1 / tts-1-hd reject it.
  const supportsInstructions = TTS_MODEL.startsWith("gpt-4o");
  const call = (withSpeed: boolean) =>
    fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: text,
        ...(supportsInstructions ? { instructions } : {}),
        response_format: "mp3",
        ...(withSpeed ? { speed: TTS_SPEED } : {}),
      }),
    });

  try {
    // Speed up delivery via the `speed` param; if a model ever rejects it,
    // fall back to a normal request rather than going silent.
    let res = await call(true);
    if (!res.ok) res = await call(false);
    if (!res.ok || !res.body) {
      console.error("[voice/speak] OpenAI", res.status);
      return new Response(null, { status: 204 });
    }
    return new Response(res.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[voice/speak] failed:", (e as Error).message);
    return new Response(null, { status: 204 });
  }
}
