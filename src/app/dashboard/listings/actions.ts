"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createListing(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const price_per_day_raw = String(formData.get("price_per_day") ?? "0").trim();

  const price_per_day = Number(price_per_day_raw);
  if (!title) return { ok: false, message: "Title is required." };
  if (!Number.isFinite(price_per_day) || price_per_day < 0) {
    return { ok: false, message: "Price per day must be a valid number." };
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const user = data?.user;

  if (userError || !user) return { ok: false, message: "Not authenticated." };

  const { error } = await supabase.from("listings").insert({
    owner_id: user.id,
    title,
    description: description || null,
    city: city || null,
    state: state || null,
    price_per_day,
    is_published: false,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/listings");
  return { ok: true, message: "Listing created." };
}

export async function togglePublish(listingId: string, nextPublished: boolean) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { ok: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("listings")
    .update({ is_published: nextPublished })
    .eq("id", listingId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/listings");
  revalidatePath("/listings");
  return { ok: true, message: nextPublished ? "Published." : "Unpublished." };
}

export async function deleteListing(listingId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { ok: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/listings");
  revalidatePath("/listings");
  return { ok: true, message: "Deleted." };
}
