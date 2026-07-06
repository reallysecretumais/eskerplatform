import { requireAccount } from "@/lib/auth";
import { ProfileForm } from "@/components/account/ProfileForm";
import { AvatarUpload } from "@/components/account/AvatarUpload";
import { PhoneVerifyCard } from "@/components/account/PhoneVerifyCard";

export const metadata = { title: "Profile — Esker" };

export default async function ProfilePage() {
  const account = await requireAccount();
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Profile</h1>
      <p className="mt-1 text-sm text-muted">Your details and how we verify you.</p>

      <div className="mt-6">
        <AvatarUpload name={account.name} src={account.avatarUrl} />
      </div>

      <div className="mt-4">
        <ProfileForm name={account.name ?? ""} phone={account.phone ?? ""} email={account.email ?? ""} />
      </div>

      <div className="mt-4">
        <PhoneVerifyCard verified={account.phoneVerified} phone={account.phone} />
      </div>
    </div>
  );
}
