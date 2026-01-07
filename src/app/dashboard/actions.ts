
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const profile_summary = String(formData.get("profile_summary") ?? "").trim();

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  const user = data?.user;
  if (userError || !user) {
    return { ok: false, message: "Not authenticated." };
  }

  // Start with the existing profile fields
  const updates: {
    full_name: string;
    phone: string;
    profile_summary: string;
    avatar_url?: string;
  } = {
    full_name,
    phone,
    profile_summary,
  };

  // Handle avatar file if provided
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    try {
      const mime = avatar.type || "image/jpeg";
      const fallbackExt = mime.split("/")[1] || "jpg";
      const nameExtMatch = String(avatar.name || "").match(/\.([a-zA-Z0-9]+)$/);
      const ext = (nameExtMatch?.[1] || fallbackExt).toLowerCase();

      const filePath = `${user.id}.${ext}`;

      // Convert File -> Buffer for Node environment
      const bytes = await avatar.arrayBuffer();
      const fileBuffer = Buffer.from(bytes);

      const { error: uploadError } = await supabase.storage
        .from("profile-photos") // <-- change this if your bucket name is different
        .upload(filePath, fileBuffer, {
          upsert: true,
          contentType: mime,
        });

      if (uploadError) {
        console.error("Avatar upload failed:", uploadError);
        return { ok: false, message: `Profile saved, but avatar upload failed: ${uploadError.message}` };
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-photos").getPublicUrl(filePath);

      updates.avatar_url = publicUrl;
    } catch (e: any) {
      console.error("Avatar upload exception:", e);
      return { ok: false, message: "Profile saved, but avatar upload failed (exception)." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return { ok: true, message: "Profile saved." };
}
