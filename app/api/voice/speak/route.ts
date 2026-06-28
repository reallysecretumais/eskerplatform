import type { NextRequest } from "next/server";
import { isUrduText } from "@/lib/listings";

export const runtime = "nodejs";

// Text-to-speech for the voice concierge. Streams an MP3 of the concierge's
// reply back to the browser. One warm brand voice speaks both languages; the
// `instructions` tune the tone per language. Only the (public) reply text is
// spoken — never anything internal.

const TTS_MODEL = process.env.ESKER_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.ESKER_TTS_VOICE || "shimmer";

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
  const instructions = urdu
    ? "The text is Roman Urdu (the Urdu language written in Latin letters). Read it aloud as natural, warm, conversational Urdu with a friendly Pakistani hospitality tone — NOT as English. Calm, clear, and unhurried."
    : "Speak in warm, natural English with a friendly, premium hospitality tone. Calm, clear, and unhurried.";

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input: text, instructions, response_format: "mp3" }),
    });
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
