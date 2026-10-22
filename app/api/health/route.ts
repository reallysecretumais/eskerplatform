import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Can the public availability window be read right now? The website fails
 *  closed when it can't (lib/data/listings AvailabilityUnavailable), so this is
 *  where an outage shows from the outside instead of as "every night free". */
async function availabilityReadable(): Promise<boolean> {
  try {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await anon.from("public_availability").select("property_id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Public health check — mirrors the CRM's, so a Safepay cutover can be verified
 * on BOTH deployments from outside. The website mints checkouts too, so it needs
 * the same environment and the same two keys; it has no webhook route, so no
 * webhook secret is expected here.
 *
 * Booleans and the environment word only — never a value, length or prefix.
 */
export async function GET() {
  const availability = await availabilityReadable();
  return Response.json({
    ok: availability,
    service: "esker-platform",
    time: new Date().toISOString(),
    safepay: {
      env: process.env.SAFEPAY_ENV === "production" ? "production" : "sandbox",
      apiKeySet: Boolean(process.env.SAFEPAY_API_KEY),
      secretKeySet: Boolean(process.env.SAFEPAY_SECRET_KEY),
    },
    availability: { readable: availability },
  });
}
