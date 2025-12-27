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
export async function cancelRental(rentalId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  // renter can cancel their own pending rental
  const { data: current } = await supabase
    .from("rentals")
    .select("id, status, renter_id, listing_id")
    .eq("id", rentalId)
    .single();

  if (!current) return { ok: false, message: "Rental not found." };
  if (current.renter_id !== user.id) return { ok: false, message: "Not allowed." };
  if (current.status !== "pending") return { ok: false, message: "Only pending rentals can be cancelled." };

  const { error } = await supabase
    .from("rentals")
    .update({ status: "cancelled" })
    .eq("id", rentalId)
    .eq("renter_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/rentals");
  return { ok: true, message: "Cancelled." };
}

export async function ownerSetRentalStatus(rentalId: string, nextStatus: "approved" | "rejected") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  // Make sure this rental belongs to a listing owned by the current user
  const { data: row } = await supabase
    .from("rentals")
    .select("id, status, listing_id")
    .eq("id", rentalId)
    .single();

  if (!row) return { ok: false, message: "Rental not found." };
  if (row.status !== "pending") return { ok: false, message: "Only pending rentals can be updated." };

  // RLS ensures only the owner of the listing can update this rental row
  const { error } = await supabase
  .from("rentals")
  .update({ status: nextStatus })
  .eq("id", rentalId);

if (error) {
  const msg = (error as any)?.message ? String((error as any).message) : "Update failed.";

  // Friendly message if the overlap constraint is hit
  if (msg.toLowerCase().includes("rentals_no_overlapping_approved")) {
    return {
      ok: false,
      message: "Cannot approve: this listing is already booked for those dates.",
    };
  }

  return { ok: false, message: msg };
}


  revalidatePath("/dashboard/owner-rentals");
  revalidatePath("/dashboard/rentals");
  return { ok: true, message: nextStatus === "approved" ? "Approved." : "Rejected." };
}
