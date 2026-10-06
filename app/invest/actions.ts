"use server";

import { redirect } from "next/navigation";
import { codeMatches, grantAccess } from "./access";

export type GateState = { error: string | null };

/** The access-code form on /invest. */
export async function enterCode(_prev: GateState, formData: FormData): Promise<GateState> {
  const code = String(formData.get("code") ?? "");
  if (!codeMatches(code)) return { error: "That code isn't right. Ask Umais or Hamza for it." };
  await grantAccess();
  redirect("/invest");
}
