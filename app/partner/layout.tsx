import { AccountShell } from "@/components/account/AccountShell";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell mode="partner">{children}</AccountShell>;
}
