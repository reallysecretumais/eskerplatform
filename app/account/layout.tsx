import { AccountShell } from "@/components/account/AccountShell";

// Shared account shell wraps every /account/* page — profile, security,
// preferences, trips and booking detail all live in one cohesive space.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell mode="guest">{children}</AccountShell>;
}
