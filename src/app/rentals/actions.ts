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
  const message = String(formData.get("message") ?? "").trim();

  if (!listing_id) return { ok: false, message: "Missing listing id." };
  if (!isValidISODate(start_date) || !isValidISODate(end_date)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;

  if (error || !user) redirect("/login");

  // Read listing turnaround_days (and ensure listing is published)
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, is_published, turnaround_days")
    .eq("id", listing_id)
    .single();

  if (listingError || !listing) {
    return { ok: false, message: "Listing not found." };
  }

  if (!listing.is_published) {
    return { ok: false, message: "Listing is not published." };
  }

  const buffer_days = Number(listing.turnaround_days ?? 1);

  // Insert rental request
  const { error: insertError } = await supabase.from("rentals").insert({
    listing_id,
    renter_id: user.id,
    start_date,
    end_date, // checkout/return date (not booked)
    buffer_days,
    message: message || null,
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

  const { data: current } = await supabase
    .from("rentals")
    .select("id, status, renter_id")
    .eq("id", rentalId)
    .single();

  if (!current) return { ok: false, message: "Rental not found." };
  if (current.renter_id !== user.id) return { ok: false, message: "Not allowed." };
  if (current.status !== "pending") {
    return { ok: false, message: "Only pending rentals can be cancelled." };
  }

  const { error } = await supabase
    .from("rentals")
    .update({ status: "cancelled" })
    .eq("id", rentalId)
    .eq("renter_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/rentals");
  return { ok: true, message: "Cancelled." };
}

export async function ownerSetRentalStatus(
  rentalId: string,
  nextStatus: "approved" | "rejected"
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  // Make sure rental exists & is pending before owner acts
  const { data: row } = await supabase
    .from("rentals")
    .select("id, status")
    .eq("id", rentalId)
    .single();

  if (!row) return { ok: false, message: "Rental not found." };
  if (row.status !== "pending") {
    return { ok: false, message: "Only pending rentals can be updated." };
  }

  // RLS ensures only listing owner can update this row
  const { error } = await supabase
    .from("rentals")
    .update({ status: nextStatus })
    .eq("id", rentalId);

  if (error) {
    const msg =
      (error as any)?.message ? String((error as any).message) : "Update failed.";

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

