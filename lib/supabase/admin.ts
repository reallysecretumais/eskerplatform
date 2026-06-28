import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — BYPASSES RLS. Server-only. Used solely by the booking
// action to write a validated, awaiting-verification booking + proof into the
// shared DB (the same elevated pattern the CRM uses for proof uploads).
// NEVER import this from client ("use client") code.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
