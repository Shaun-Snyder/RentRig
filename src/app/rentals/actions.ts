"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isValidISODate(value: string) {
  // basic YYYY-MM-DD validation
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function requestRental(formData: FormData) {
  const listing_id = String(formData.get("listing_id") ?? "").trim();
  const start_date = String(formData.get("start_date") ?? "").trim();
  const end_date = String(formData.get("end_date") ?? "").trim();

  if (!listing_id) return { ok: false, message: "Missing listing id." };
  if (!isValidISODate(start_date) || !isValidISODate(end_date)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;

  if (error || !user) redirect("/login");

  // insert rental request (RLS enforces published listing + renter_id = auth.uid)
  const { error: insertError } = await supabase.from("rentals").insert({
    listing_id,
    renter_id: user.id,
    start_date,
    end_date,
    status: "pending",
  });

  if (insertError) return { ok: false, message: insertError.message };

  revalidatePath(`/listings/${listing_id}`);
  revalidatePath("/dashboard/rentals");
  return { ok: true, message: "Rental request sent." };
}
