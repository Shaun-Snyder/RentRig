
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isValidISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Parse YYYY-MM-DD into a UTC date at midnight (avoids timezone bugs)
function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUTC(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Half-open overlap: [aStart, aEnd) overlaps [bStart, bEnd)
function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Renter requests a rental (pending).
 * We also compute buffer_days from the listing's turnaround_days (default 1).
 * Server-side we prevent requesting dates that overlap any APPROVED rental
 * when considering buffers.
 */
export async function requestRental(formData: FormData) {
  const listing_id = String(formData.get("listing_id") ?? "").trim();
  const start_date = String(formData.get("start_date") ?? "").trim();
  const end_date = String(formData.get("end_date") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!listing_id) return { ok: false, message: "Missing listing id." };
  if (!isValidISODate(start_date) || !isValidISODate(end_date)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." };
  }

  const reqStart = parseISODate(start_date);
  const reqEndBase = parseISODate(end_date);
  if (!(reqStart < addDaysUTC(reqEndBase, 1))) {
    return { ok: false, message: "End date must be on/after start date." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) redirect("/login");

  // get listing turnaround_days => buffer_days (default 1)
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, turnaround_days, is_published")
    .eq("id", listing_id)
    .single();

  if (listingError || !listing) return { ok: false, message: "Listing not found." };
  if (!listing.is_published) return { ok: false, message: "This listing is not published." };

  const buffer_days = Math.max(0, Number(listing.turnaround_days ?? 1));
  const reqEnd = addDaysUTC(reqEndBase, buffer_days);

  // Load approved rentals to prevent overlaps (with buffers)
  const { data: approved, error: approvedError } = await supabase
    .from("rentals")
    .select("start_date, end_date, buffer_days, status")
    .eq("listing_id", listing_id)
    .eq("status", "approved");

  if (approvedError) return { ok: false, message: approvedError.message };

  for (const r of approved ?? []) {
    const rStart = parseISODate(String(r.start_date));
    const rEnd = addDaysUTC(parseISODate(String(r.end_date)), Number((r as any).buffer_days ?? 0));
    if (rangesOverlap(reqStart, reqEnd, rStart, rEnd)) {
      return {
        ok: false,
        message: "This listing is not available for those dates. Please choose different dates.",
      };
    }
  }

  const { error: insertError } = await supabase.from("rentals").insert({
    listing_id,
    renter_id: user.id,
    start_date,
    end_date,
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

/**
 * Owner approves/rejects a pending rental.
 * On approve, prevent overlaps vs other APPROVED rentals (with buffers).
 */
export async function ownerSetRentalStatus(rentalId: string, nextStatus: "approved" | "rejected") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  const { data: row, error: rowError } = await supabase
    .from("rentals")
    .select("id, status, listing_id, start_date, end_date, buffer_days")
    .eq("id", rentalId)
    .single();

  if (rowError || !row) return { ok: false, message: "Rental not found." };
  if (row.status !== "pending") return { ok: false, message: "Only pending rentals can be updated." };

  if (nextStatus === "approved") {
    const reqStart = parseISODate(String(row.start_date));
    const reqEnd = addDaysUTC(parseISODate(String(row.end_date)), Number(row.buffer_days ?? 0));

    const { data: approved, error: approvedError } = await supabase
      .from("rentals")
      .select("id, start_date, end_date, buffer_days, status")
      .eq("listing_id", row.listing_id)
      .eq("status", "approved");

    if (approvedError) return { ok: false, message: approvedError.message };

    for (const r of approved ?? []) {
      if (r.id === rentalId) continue;
      const rStart = parseISODate(String(r.start_date));
      const rEnd = addDaysUTC(parseISODate(String(r.end_date)), Number((r as any).buffer_days ?? 0));
      if (rangesOverlap(reqStart, reqEnd, rStart, rEnd)) {
        return {
          ok: false,
          message: "Cannot approve: this listing is already booked for those dates.",
        };
      }
    }
  }

  // RLS should enforce owner permissions
  const { error } = await supabase.from("rentals").update({ status: nextStatus }).eq("id", rentalId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/owner-rentals");
  revalidatePath("/dashboard/rentals");
  return { ok: true, message: nextStatus === "approved" ? "Approved." : "Rejected." };
}
