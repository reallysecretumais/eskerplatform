import { requireAccount } from "@/lib/auth";
import { PreferencesForm } from "@/components/account/PreferencesForm";

export const metadata = { title: "Preferences — Esker" };

export default async function PreferencesPage() {
  const account = await requireAccount();
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Preferences</h1>
      <p className="mt-1 text-sm text-muted">Notifications and language.</p>

      <div className="mt-6">
        <PreferencesForm notifyEmail={account.notifyEmail} notifyWhatsapp={account.notifyWhatsapp} language={account.language} />
      </div>
    </div>
  );
}
