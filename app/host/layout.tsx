import { AccountShell } from "@/components/account/AccountShell";

// Host workspace shell — same shared nav + Guest⇄Hosting switch as the guest side,
// so identity/messages/profile never fork.
export default function HostLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell mode="host">{children}</AccountShell>;
}
