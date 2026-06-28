"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Self-grant the 'owner' role (RLS only permits guest/owner for one's own
// account; 'partner' is admin-granted and cannot be self-assigned).
export async function becomeHost() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("account_roles")
    .upsert({ account_id: user.id, role: "owner" }, { onConflict: "account_id,role", ignoreDuplicates: true });

  revalidatePath("/account");
}
