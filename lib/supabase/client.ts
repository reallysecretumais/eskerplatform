import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for browser ("use client") components.
 *
 * Uses the PUBLIC anon key only. This client can never see anything the
 * database's Row-Level Security wall does not explicitly expose to the public.
 * The master (service-role) key never reaches the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
