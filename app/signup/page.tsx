import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { EskerLogo } from "@/components/EskerLogo";
import { AuthForm } from "@/components/AuthForm";
import { getAccount } from "@/lib/auth";

export const metadata = { title: "Create your account", robots: { index: false, follow: true } };

export default async function SignupPage() {
  if (await getAccount()) redirect("/account");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" aria-label={brand.name} className="inline-flex justify-center text-ink">
            <EskerLogo />
          </Link>
          <h1 className="headline mt-5 text-[34px] text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-muted">Book stays, or list your place — same account.</p>
        </div>
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
