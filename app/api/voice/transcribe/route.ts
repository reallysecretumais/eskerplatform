import type { NextRequest } from "next/server";
import { isUrduText } from "@/lib/listings";

export const runtime = "nodejs";

// Speech-to-text for the voice concierge. Takes the guest's recorded audio and
// returns the transcript. We use OpenAI (Whisper family) rather than the browser
// SpeechRecognition API because it handles Urdu / Roman-Urdu / code-switching
// reliably across phones (esp. iOS Safari, where browser speech is weak/absent).
// Only the guest's own words are sent — no internal data is ever involved.

const STT_MODEL = process.env.ESKER_STT_MODEL || "gpt-4o-mini-transcribe";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ text: "", language: "en" });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof File) file = f;
  } catch {
    /* ignore */
  }
  if (!file) return Response.json({ text: "", language: "en" });

  const oa = new FormData();
  oa.append("file", file, file.name || "audio.webm");
  oa.append("model", STT_MODEL);
  oa.append("response_format", "json");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: oa,
    });
    if (!res.ok) {
      console.error("[voice/transcribe] OpenAI", res.status, await res.text());
      return Response.json({ text: "", language: "en" });
    }
    const data = await res.json();
    const text = (data?.text ?? "").trim();
    // Best-effort tag for the language badge; the reply's own language (which the
    // concierge mirrors) is what actually drives the spoken voice.
    return Response.json({ text, language: isUrduText(text) ? "ur" : "en" });
  } catch (e) {
    console.error("[voice/transcribe] failed:", (e as Error).message);
    return Response.json({ text: "", language: "en" });
  }
}
