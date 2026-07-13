import { SiteNav } from "@/components/SiteNav";
import { AccountNav } from "@/components/account/AccountNav";
import { requireAccount } from "@/lib/auth";

// The shared account/host chrome — one sticky site nav + the workspace rail (with
// the Guest⇄Hosting switch). Every account-area surface renders inside this so
// Overview / Trips / Messages / Profile / Security / Preferences all feel like one
// place — and you can always navigate back via the rail. `print:hidden` keeps
// receipts clean when printed.
export async function AccountShell({ mode = "guest", children }: { mode?: "guest" | "host" | "partner"; children: React.ReactNode }) {
  const account = await requireAccount();
  const showPartner = account.roles.includes("partner");

  return (
    <main className="min-h-full">
      <div className="print:hidden">
        <SiteNav theme="light" account={account} />
      </div>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
          <aside className="lg:sticky lg:top-24 lg:self-start print:hidden">
            <AccountNav mode={mode} showPartner={showPartner} />
          </aside>
          <div className="mt-6 lg:mt-0">{children}</div>
        </div>
      </div>
    </main>
  );
}
