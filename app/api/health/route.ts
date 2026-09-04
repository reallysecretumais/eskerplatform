export const dynamic = "force-dynamic";

/**
 * Public health check — mirrors the CRM's, so a Safepay cutover can be verified
 * on BOTH deployments from outside. The website mints checkouts too, so it needs
 * the same environment and the same two keys; it has no webhook route, so no
 * webhook secret is expected here.
 *
 * Booleans and the environment word only — never a value, length or prefix.
 */
export async function GET() {
  return Response.json({
    ok: true,
    service: "esker-platform",
    time: new Date().toISOString(),
    safepay: {
      env: process.env.SAFEPAY_ENV === "production" ? "production" : "sandbox",
      apiKeySet: Boolean(process.env.SAFEPAY_API_KEY),
      secretKeySet: Boolean(process.env.SAFEPAY_SECRET_KEY),
    },
  });
}
