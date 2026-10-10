import "server-only";
import type { Pulse } from "./pulseFormat";

/**
 * The investor page's live line, read from Esker OS:
 * "3,910 guest messages handled in the last 7 days".
 *
 * One aggregate, nothing identifying. Cached for five minutes by Next's data
 * cache so a busy afternoon of investors opening the page costs the CRM one
 * request. Streamed in through <Suspense>, so the eight-second ceiling only
 * ever delays the line itself, never the page. Best-effort: when the CRM is unreachable the section simply omits
 * the line rather than showing a stale or made-up one.
 */
export async function getPulse(): Promise<Pulse | null> {
  const base = (process.env.CRM_URL || "https://os.eskerrentals.com").replace(/\/$/, "");
  const secret = process.env.PLATFORM_API_SECRET || process.env.REVALIDATE_SECRET;
  if (!secret) return null;
  try {
    const res = await fetch(`${base}/api/platform/pulse`, {
      headers: { "x-esker-secret": secret },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[pulse] CRM answered ${res.status}`);
      return null;
    }
    const j = (await res.json()) as { ok?: boolean; inboundMessages7d?: number };
    if (!j.ok) return null;
    return { inboundMessages7d: j.inboundMessages7d ?? 0 };
  } catch (e) {
    // Best-effort, but never silent: the reason lands in the runtime logs.
    console.warn(`[pulse] CRM unreachable: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`);
    return null;
  }
}
