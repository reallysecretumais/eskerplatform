import type { NextRequest } from "next/server";
import { getListings, getBusyByProperty } from "@/lib/data/listings";
import { catalog, CONCIERGE_SYSTEM, VOICE_SYSTEM, MODEL, todayPK } from "@/lib/ai/concierge";
import { getAiSurface, type AiSurface } from "@/lib/settings";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string };

/** All three AI surfaces stream through this one route, so the client says which
 *  it is — otherwise homepage search and the property-page concierge are
 *  indistinguishable here and can't be configured separately. Older clients that
 *  send only `voice` still resolve correctly. */
function resolveSurface(raw: unknown, voice: boolean): AiSurface {
  if (raw === "search" || raw === "voice" || raw === "concierge") return raw;
  return voice ? "voice" : "concierge";
}

// Streaming conversational concierge. Retrieval-first: only public listings go
// to the model. Re-emits OpenAI's token deltas as plain text so the client can
// type the reply live; recommended listing ids ride along on a trailing
// "STAYS:" line.
export async function POST(req: NextRequest) {
  let messages: Msg[] = [];
  let context = "";
  let voice = false;
  let surfaceRaw: unknown;
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
    context = typeof body?.context === "string" ? body.context : "";
    voice = body?.voice === true;
    surfaceRaw = body?.surface;
  } catch {
    /* ignore */
  }

  // Kill switch (CRM → Esker Intelligence → Website AI). Enforced HERE as well as
  // in the UI, so a cached page or a direct call can't reach a disabled surface.
  const surface = resolveSurface(surfaceRaw, voice);
  const cfg = await getAiSurface(surface);
  if (!cfg.enabled) {
    return new Response("Our AI assistant is taking a short break — the team is on hand and happy to help.\nSTAYS:", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const [listings, busy] = await Promise.all([getListings(), getBusyByProperty()]);

  if (!apiKey) {
    return new Response("The concierge isn't configured yet.\nSTAYS:", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const base = voice ? VOICE_SYSTEM : CONCIERGE_SYSTEM;
  // The founder's prompt is LAYERED ON TOP — house rules, the retrieval-only
  // contract and the STAYS: output format above it always win.
  const system =
    `${base}\n\nToday is ${todayPK()} (Pakistan time).\n\nAvailable listings:\n${catalog(listings, busy)}` +
    `${context ? `\n\nContext: ${context}` : ""}` +
    `${cfg.prompt ? `\n\nAdditional house style (never override the rules above):\n${cfg.prompt}` : ""}`;

  const oa = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: cfg.model || MODEL,
      temperature: 0.5,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages.slice(-12)],
    }),
  });

  if (!oa.ok || !oa.body) {
    return new Response("Sorry — I had trouble just now. Please try again.\nSTAYS:", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = oa.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const data = t.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              /* skip partial json frames */
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
