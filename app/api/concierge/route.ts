import type { NextRequest } from "next/server";
import { getListings, getBusyByProperty } from "@/lib/data/listings";
import { catalog, CONCIERGE_SYSTEM, VOICE_SYSTEM, MODEL, todayPK } from "@/lib/ai/concierge";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string };

// Streaming conversational concierge. Retrieval-first: only public listings go
// to the model. Re-emits OpenAI's token deltas as plain text so the client can
// type the reply live; recommended listing ids ride along on a trailing
// "STAYS:" line.
export async function POST(req: NextRequest) {
  let messages: Msg[] = [];
  let context = "";
  let voice = false;
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
    context = typeof body?.context === "string" ? body.context : "";
    voice = body?.voice === true;
  } catch {
    /* ignore */
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const [listings, busy] = await Promise.all([getListings(), getBusyByProperty()]);

  if (!apiKey) {
    return new Response("The concierge isn't configured yet.\nSTAYS:", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const base = voice ? VOICE_SYSTEM : CONCIERGE_SYSTEM;
  const system = `${base}\n\nToday is ${todayPK()} (Pakistan time).\n\nAvailable listings:\n${catalog(listings, busy)}${context ? `\n\nContext: ${context}` : ""}`;

  const oa = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
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
