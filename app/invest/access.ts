import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Private access to /invest. The code word lives in the INVEST_ACCESS_CODE env
 * var (Vercel + .env.local). The cookie holds a hash of it, not the word, so
 * changing the env var signs every device out at once. With no code configured
 * the page stays shut — fail closed.
 */
export const INVEST_COOKIE = "esker_invest";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days — the meeting phone stays unlocked

function configuredCode(): string | null {
  return process.env.INVEST_ACCESS_CODE?.trim() || null;
}

function tokenFor(code: string): string {
  return createHash("sha256").update(`esker-invest:${code.toLowerCase()}`).digest("hex").slice(0, 40);
}

export function codeMatches(input: string | null | undefined): boolean {
  const code = configuredCode();
  return !!code && !!input && input.trim().toLowerCase() === code.toLowerCase();
}

export async function hasAccess(): Promise<boolean> {
  const code = configuredCode();
  if (!code) return false;
  return (await cookies()).get(INVEST_COOKIE)?.value === tokenFor(code);
}

/** Only call after codeMatches() — sets the unlock cookie. */
export async function grantAccess(): Promise<void> {
  const code = configuredCode();
  if (!code) return;
  (await cookies()).set(INVEST_COOKIE, tokenFor(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/invest",
    maxAge: MAX_AGE,
  });
}
