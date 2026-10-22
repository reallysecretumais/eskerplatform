import { requireAccount } from "@/lib/auth";
import { PasswordForm } from "@/components/account/PasswordForm";
import { signOut } from "@/app/account/actions";

export const metadata = { title: "Security — Esker" };

export default async function SecurityPage() {
  await requireAccount();
  return (
    <div className="max-w-xl">
      <h1 className="headline text-[34px] text-ink">Security</h1>
      <p className="mt-1 text-sm text-muted">Change your password or sign out.</p>

      <div className="mt-6">
        <PasswordForm />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-[22px] border border-line bg-surface p-6">
        <div>
          <div className="text-sm font-medium text-ink">Sign out</div>
          <div className="text-xs text-dim">Sign out of Esker on this device.</div>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-full border border-line-hi px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-2">Sign out</button>
        </form>
      </div>
    </div>
  );
}
