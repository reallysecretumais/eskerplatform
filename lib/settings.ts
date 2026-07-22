import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Website AI configuration, owned by the CRM.
//
// Esker OS → "Esker Intelligence" → Website AI writes `app_settings.website_ai`
// (shared DB). Same mechanism as `ai_host_interview_prompt`
// (lib/ai/hostInterview.ts getInterviewStyle).
//
//   { search|voice|concierge: { enabled, prompt, model } }
//
//   enabled=false  → that surface is OFF site-wide. This is the founder's kill
//                    switch for a misbehaving AI feature and must work WITHOUT a
//                    deploy, so we only memoise for TTL_MS.
//   prompt=""      → use our built-in persona. A non-empty value is LAYERED ON
//                    TOP of the system prompt, never replacing it — house rules
//                    and the retrieval-only contract always survive.
//   model=""       → our default model.
//
// The key may be absent on a fresh DB, and a human edits this JSON — so every
// field is coerced and any failure degrades to "all on, our defaults" rather
// than taking the site's AI down.
//
// NOTE `concierge` = the PROPERTY-PAGE Q&A. The website's guest chat
// (/messages, ChatDock) is human-only by design and has no AI to switch off.
// ─────────────────────────────────────────────────────────────────────────────

export type AiSurface = "search" | "voice" | "concierge";
export type SurfaceConfig = { enabled: boolean; prompt: string; model: string };
export type WebsiteAi = Record<AiSurface, SurfaceConfig>;

const SURFACES: AiSurface[] = ["search", "voice", "concierge"];
const defaults = (): WebsiteAi => ({
  search: { enabled: true, prompt: "", model: "" },
  voice: { enabled: true, prompt: "", model: "" },
  concierge: { enabled: true, prompt: "", model: "" },
});

/** Short enough that the kill switch feels immediate; long enough that a busy
 *  page doesn't re-query per token. */
const TTL_MS = 60_000;
let cache: { at: number; value: WebsiteAi } | null = null;

function coerce(raw: unknown): WebsiteAi {
  const out = defaults();
  if (!raw || typeof raw !== "object") return out;
  const root = raw as Record<string, unknown>;
  for (const s of SURFACES) {
    const v = root[s];
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    // Only an explicit `false` disables — a missing/garbled flag stays ON, so a
    // malformed edit can never silently kill a surface.
    out[s] = {
      enabled: o.enabled === false ? false : true,
      prompt: typeof o.prompt === "string" ? o.prompt.trim() : "",
      model: typeof o.model === "string" ? o.model.trim() : "",
    };
  }
  return out;
}

export async function getWebsiteAi(): Promise<WebsiteAi> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_settings").select("value").eq("key", "website_ai").maybeSingle();
    const value = coerce(data?.value);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    // Never take the site's AI down over a settings read.
    const value = cache?.value ?? defaults();
    cache = { at: Date.now(), value };
    return value;
  }
}

export async function getAiSurface(surface: AiSurface): Promise<SurfaceConfig> {
  return (await getWebsiteAi())[surface];
}
