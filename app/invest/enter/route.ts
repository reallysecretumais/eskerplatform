import { NextResponse, type NextRequest } from "next/server";
import { codeMatches, grantAccess } from "../access";

/**
 * GET /invest/enter?k=CODE&area=…  — the one-tap WhatsApp link. A correct code
 * unlocks this device and lands on /invest with the rest of the selection
 * intact; a wrong one lands on the gate. Cookies can't be set while a page
 * renders, which is why the page hands off to this route.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ok = codeMatches(url.searchParams.get("k"));
  url.searchParams.delete("k");
  if (ok) await grantAccess();
  const dest = new URL("/invest", url.origin);
  url.searchParams.forEach((v, key) => dest.searchParams.set(key, v));
  if (!ok) dest.searchParams.set("denied", "1");
  return NextResponse.redirect(dest);
}
