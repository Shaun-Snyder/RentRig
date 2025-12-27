"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** YYYY-MM-DD */
function isValidISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Parse YYYY-MM-DD as a UTC date at midnight (avoids timezone bugs). */
function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUTC(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/** Half-open overlap: [aStart, aEnd) overlaps [bStart, bEnd) */
function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Creates a rental request.
 * Overlap check is done server-side against APPROVED rentals:
 * booked range = [start_date, end_date + 1 day + buffer_days)
 */
export async function requestRental(formData: FormData) {
  const listing_id = String(formData.get("listing_id") ?? "").trim();
  const start_date = String(formData.get("start_date") ?? "").trim();
  const end_date = String(formData.get("end_date") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim() || null;

  if (!listing_id) return { ok: false, message: "Missing listing id." };
  if (!isValidISODate(start_date) || !isValidISODate(end_date)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) redirect("/login");

  // Get listing turnaround_days (buffer) — default to 0 if null
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, is_published, turnaround_days")
    .eq("id", listing_id)
    .single();

  if (listingErr || !listing) return { ok: false, message: "Listing not found." };
  if (!listing.is_published) return { ok: false, message: "This listing is not published." };

  const buffer_days = Number(listing.turnaround_days ?? 0);

  // Server-side availability check against APPROVED rentals
  const { data: approved, error: approvedErr } = await supabase
    .from("rentals")
    .select("start_date, end_date, buffer_days")
    .eq("listing_id", listing_id)
    .eq("status", "approved");

  if (approvedErr) return { ok: false, message: approvedErr.message };

  const reqStart = parseISODate(start_date);
  // inclusive end_date -> +1 day, then add buffer_days
  const reqEnd = addDaysUTC(parseISODate(end_date), 1 + buffer_days);

  for (const r of approved ?? []) {
    const rStart = parseISODate(r.start_date);
    const rBuf = Number(r.buffer_days ?? 0);
    const rEnd = addDaysUTC(parseISODate(r.end_date), 1 + rBuf);

    if (rangesOverlap(reqStart, reqEnd, rStart, rEnd)) {
      return {
        ok: false,
        message: "This listing is not available for those dates. Please choose different dates.",
      };
    }
  }

  // Insert rental request (RLS should enforce renter_id = auth.uid)
  const { error: insertError } = await supabase.from("rentals").insert({
    listing_id,
    renter_id: user.id,
    start_date,
    end_date,
    buffer_days,
    message,
    status: "pending",
  });

  if (insertError) return { ok: false, message: insertError.message };

  revalidatePath(`/listings/${listing_id}`);
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/owner-rentals");
  return { ok: true, message: "Rental request sent." };
}

export async function cancelRental(rentalId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  const { data: current, error: currentErr } = await supabase
    .from("rentals")
    .select("id, status, renter_id")
    .eq("id", rentalId)
    .single();

  if (currentErr || !current) return { ok: false, message: "Rental not found." };
  if (current.renter_id !== user.id) return { ok: false, message: "Not allowed." };
  if (current.status !== "pending") return { ok: false, message: "Only pending rentals can be cancelled." };

  const { error } = await supabase.from("rentals").update({ status: "cancelled" }).eq("id", rentalId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/owner-rentals");
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

  // Ensure exists and pending. RLS should ensure only owner can update.
  const { data: row, error: rowErr } = await supabase
    .from("rentals")
    .select("id, status")
    .eq("id", rentalId)
    .single();

  if (rowErr || !row) return { ok: false, message: "Rental not found." };
  if (row.status !== "pending") return { ok: false, message: "Only pending rentals can be updated." };

  const { error } = await supabase.from("rentals").update({ status: nextStatus }).eq("id", rentalId);

  if (error) {
    const msg = String((error as any)?.message ?? "Update failed.");
    if (msg.toLowerCase().includes("rentals_no_overlapping_approved")) {
      return { ok: false, message: "Cannot approve: this listing is already booked for those dates." };
    }
    return { ok: false, message: msg };
  }

  revalidatePath("/dashboard/owner-rentals");
  revalidatePath("/dashboard/rentals");
  return { ok: true, message: nextStatus === "approved" ? "Approved." : "Rejected." };
}
