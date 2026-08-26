/**
 * ⚠️ VERBATIM COPY of `Esker OS/lib/payments/bankAccounts.ts` — a sanctioned
 * duplicate, like `feePolicy()`. The two repos share a database but no package,
 * and an account the CRM can send must be an account the website can render:
 * one normaliser, or the two disagree about which account is primary while
 * both look right. Kept byte-identical so `diff` is the whole review — if you
 * change one, copy it across rather than paraphrasing it.
 *
 * The bank accounts a rep can send a guest (founder feature, 26 Aug).
 *
 * Esker collects into more than one account, and which one a guest should use
 * is a decision the rep makes in the moment — so Settings holds a LIST and the
 * chat chooser makes the rep tap one. Nothing here picks silently: a send
 * without a choice uses the account marked primary, which is a stated default
 * rather than an accident of ordering.
 *
 * Why structured rather than the old freeform blob: the `payment_details`
 * template needs the account as three separate parameters (Meta rejects a
 * newline inside a parameter, so one line = one variable), and the terms above
 * the account are policy that belongs frozen in the approved template. Parsing
 * three lines out of a textarea worked for exactly one account and would have
 * quietly sent the wrong bank the moment a second one existed.
 *
 * The legacy textarea is still the source for the TERMS, and still the whole
 * message on an instance that never fills the list in — a client of Rental OS
 * who has one account and no interest in this feature keeps what they had.
 */

export type BankAccount = {
  /** Stable across edits so a rep's tap and the sent message can't disagree. */
  id: string;
  /** Account title — the name the transfer must be made out to. */
  title: string;
  bank: string;
  /** IBAN or account number, exactly as the guest must type it. */
  iban: string;
  /** The default when nobody chooses (exactly one, enforced on save). */
  primary: boolean;
};

/** The marker in the legacy Settings text that separates terms from account. */
const BANK_MARKER = /bank details/i;

/** Everything a guest is told BEFORE the account itself — the terms. Frozen in
 *  the approved template, so this is only used for the in-window plain text
 *  and the rep's preview. */
export function termsOf(freeform: string): string {
  const [head] = freeform.split(BANK_MARKER);
  return (head ?? "").trim();
}

/**
 * The single account a one-account instance already had, recovered from the
 * legacy text: the three lines under "Bank Details" are title, bank, IBAN.
 *
 * EXACTLY three, and that strictness is the point. Fewer is a half-filled
 * account, and a guest transferring against two correct lines and one missing
 * one loses real money. MORE means the instance writes something we cannot
 * represent in three template parameters — a fourth line carrying a plain
 * account number under the IBAN, say, which is exactly how Esker's own
 * approved `soneri` template is written. Taking the first three of those would
 * send a confidently incomplete account, so a block we cannot represent
 * exactly gets no structured account at all and that instance keeps sending
 * its text verbatim and whole, as it did before any of this existed.
 */
export function accountsFromLegacyText(freeform: string): BankAccount[] {
  const tail = freeform.split(BANK_MARKER)[1];
  if (!tail) return [];
  const lines = tail
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length !== 3) return [];
  return [{ id: "legacy", title: lines[0], bank: lines[1], iban: lines[2], primary: true }];
}

/** Accept whatever is in app_settings and hand back accounts we can actually
 *  send. Rows missing any of the three lines are dropped for the reason above. */
export function normaliseAccounts(raw: unknown): BankAccount[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { accounts?: unknown } | null)?.accounts) ? (raw as { accounts: unknown[] }).accounts : [];
  const out: BankAccount[] = [];
  for (const [i, r] of list.entries()) {
    const a = (r ?? {}) as Partial<BankAccount>;
    const title = String(a.title ?? "").replace(/\s+/g, " ").trim();
    const bank = String(a.bank ?? "").replace(/\s+/g, " ").trim();
    const iban = String(a.iban ?? "").replace(/\s+/g, " ").trim();
    if (!title || !bank || !iban) continue;
    out.push({ id: String(a.id ?? "").trim() || `acct${i + 1}`, title, bank, iban, primary: Boolean(a.primary) });
  }
  // Exactly one primary: the marked one, else the first. A list with none (or
  // several) marked must still resolve to one answer, not to an empty send.
  const firstPrimary = out.findIndex((a) => a.primary);
  return out.map((a, i) => ({ ...a, primary: i === (firstPrimary === -1 ? 0 : firstPrimary) }));
}

/** The account a send should use: the rep's tap, else the primary. Null only
 *  when there are genuinely none — the caller then falls back to the legacy text. */
export function pickAccount(accounts: BankAccount[], id?: string | null): BankAccount | null {
  if (!accounts.length) return null;
  if (id) {
    const hit = accounts.find((a) => a.id === id);
    if (hit) return hit;
  }
  return accounts.find((a) => a.primary) ?? accounts[0];
}

/** How the account reads inside a message — the three lines under the marker,
 *  in the same order as the template's {{1}}/{{2}}/{{3}}. */
export function accountBlock(account: BankAccount): string {
  return `Bank Details\n${account.title}\n${account.bank}\n${account.iban}`;
}

/** The whole message a guest receives: the Settings terms, then the account.
 *  Mirrors what the `payment_details` template renders, so a guest reached
 *  in-window reads the same words as one reached by template. */
export function paymentDetailsMessage(freeform: string, account: BankAccount): string {
  const terms = termsOf(freeform);
  return terms ? `${terms}\n\n${accountBlock(account)}` : accountBlock(account);
}

/** One-line label for the rep's chooser — never the full IBAN in a tight row. */
export function accountLabel(account: BankAccount): string {
  const tail = account.iban.length > 6 ? `…${account.iban.slice(-6)}` : account.iban;
  return `${account.bank} · ${tail}`;
}
