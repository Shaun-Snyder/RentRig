"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  const user = data?.user;
  if (userError || !user) {
    return { ok: false, message: "Not authenticated." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return { ok: true, message: "Profile saved." };
}
