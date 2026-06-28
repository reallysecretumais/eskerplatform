import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { AuthForm } from "@/components/AuthForm";
import { getAccount } from "@/lib/auth";

export default async function LoginPage() {
  if (await getAccount()) redirect("/account");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-bold tracking-tight text-ink">{brand.name}</Link>
          <h1 className="mt-5 font-display text-xl font-semibold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to manage your stays.</p>
        </div>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
