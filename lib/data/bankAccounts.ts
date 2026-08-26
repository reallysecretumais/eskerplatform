import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseAccounts, type BankAccount } from "@/lib/bankAccounts";
import { FALLBACK_ACCOUNTS, payments } from "@/lib/payments";

/**
 * The accounts a guest may transfer into — read from the CRM's Settings, which
 * is where a founder edits them.
 *
 * They used to be a constant in this repo, which meant opening a new bank
 * account or closing an old one needed a deploy of the public website. Both
 * repos share one database, so the CRM's `app_settings.payment_bank_accounts`
 * is the single source and this is the website's read of it.
 *
 * Cached briefly and NEVER allowed to fail into emptiness. A checkout that
 * renders zero accounts is a guest who came to pay and found nowhere to send
 * the money — silent, and indistinguishable from a page that loaded fine. So a
 * failed read, an unreachable database or an empty list all fall back to the
 * accounts this repo shipped with. The constant stops being data and becomes
 * the floor under it.
 */
const TTL_MS = 60_000;
let cache: { at: number; value: BankAccount[] } | null = null;

/** The shipped constants in the shared shape, for the fallback path. */
function fallback(): BankAccount[] {
  return normaliseAccounts(
    FALLBACK_ACCOUNTS.map((a, i) => ({
      id: `fallback${i + 1}`,
      title: payments.title,
      bank: a.bank,
      iban: a.number,
      primary: a.primary,
    })),
  );
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: BankAccount[];
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_settings").select("value").eq("key", "payment_bank_accounts").maybeSingle();
    const fromDb = normaliseAccounts(data?.value ?? null);
    value = fromDb.length ? fromDb : fallback();
  } catch {
    value = cache?.value ?? fallback();
  }
  cache = { at: Date.now(), value };
  return value;
}

/**
 * The wire shape the consumer app has been reading since launch: `bank`,
 * `number`, `primary`. Installed builds are parsing this today, so the keys
 * stay exactly as they were and `title` is ADDED — an older app ignores a
 * field it doesn't know, but a renamed one would show it a blank account.
 */
export function toWireAccounts(accounts: BankAccount[]): { bank: string; number: string; primary: boolean; title: string }[] {
  return accounts.map((a) => ({ bank: a.bank, number: a.iban, primary: a.primary, title: a.title }));
}

/** The account title to show when one name has to stand for all of them. */
export function primaryTitle(accounts: BankAccount[]): string {
  return accounts.find((a) => a.primary)?.title ?? accounts[0]?.title ?? payments.title;
}
