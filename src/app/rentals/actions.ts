"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertAllowedInsertKeys } from "@/lib/db/insertGuard";

/**
 * STEP #3 toggle:
 * - false = Operator can be offered on ANY category (your current direction)
 * - true  = Operator can only be used for heavy_equipment / lifts
 */
const OPERATOR_ONLY_HEAVY_LIFTS = false;

function isValidISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUTC(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function toInt(v: any, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

const HEAVY_CATEGORIES = new Set(["heavy_equipment", "lifts"]);
const DEFAULT_HOURLY_CAP = 24;

export async function requestRental(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  const listing_id = String(formData.get("listing_id") ?? "").trim();
  const start_date = String(formData.get("start_date") ?? "").trim();
  const end_date = String(formData.get("end_date") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim() || null;

  if (!listing_id) return { ok: false, message: "Missing listing id." };
  if (!isValidISODate(start_date) || !isValidISODate(end_date)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." };
  }

  // delivery snapshot (DO NOT TRUST FEE FROM CLIENT)
  const delivery_selected =
    String(formData.get("delivery_selected") ?? "").toLowerCase() === "true";
  // IMPORTANT: ignore client delivery_fee (can be spoofed)
  // const delivery_fee_client = Math.max(0, Number(formData.get("delivery_fee") ?? 0) || 0);

  // unified service snapshot (Driver / Driver+Labor / Operator)
  const service_choice = String(formData.get("service_choice") ?? "none");
  const service_unit =
    String(formData.get("service_unit") ?? "day") === "hour" ? "hour" : "day";
  const service_hours = toInt(formData.get("service_hours"), 0);

  // license confirmation snapshot
  const renter_has_license =
    String(formData.get("renter_has_license") ?? "").toLowerCase() === "true";

  // legacy operator snapshot (kept)
  const operator_selected =
    String(formData.get("operator_selected") ?? "").toLowerCase() === "true";
  const operator_rate_unit =
    String(formData.get("operator_rate_unit") ?? "") === "hour" ? "hour" : "day";
  const operator_rate = Math.max(0, Number(formData.get("operator_rate") ?? 0) || 0);
  const operator_hours = toInt(formData.get("operator_hours"), 0);

  // load listing (includes all caps and service enable flags + delivery discount fields)
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select(
      `
      id,
      owner_id,
      is_published,
      turnaround_days,
      min_rental_days,
      max_rental_days,
      category,
      license_required,

      delivery_mode,
      delivery_fee,
      delivery_service_discount_enabled,
      delivery_service_discount_amount,

      operator_enabled,
      operator_rate_unit,
      operator_rate,
      operator_max_hours,

      driver_enabled,
      driver_daily_enabled,
      driver_hourly_enabled,
      driver_day_rate,
      driver_hour_rate,
      driver_max_hours,

      driver_labor_enabled,
      driver_labor_daily_enabled,
      driver_labor_hourly_enabled,
      driver_labor_day_rate,
      driver_labor_hour_rate,
      driver_labor_max_hours
      `
    )
    .eq("id", listing_id)
    .single();

  if (listingErr || !listing) return { ok: false, message: "Listing not found." };
  if (!listing.is_published) return { ok: false, message: "This listing is not published." };

  const isHeavy = HEAVY_CATEGORIES.has(listing.category);

  // STEP #3 optional rule
  if (OPERATOR_ONLY_HEAVY_LIFTS && service_choice === "operator" && !isHeavy) {
    return { ok: false, message: "Operator is only available for heavy equipment and lifts." };
  }

  // HARD LICENSE BLOCK: heavy/lifts w/ license required -> must confirm license OR choose operator
  if (isHeavy && listing.license_required && !renter_has_license && service_choice !== "operator") {
    return { ok: false, message: "This equipment requires a license or an operator." };
  }

  // date math
  const start = parseISODate(start_date);
  const end = parseISODate(end_date);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return { ok: false, message: "End date must be after start date." };

  const rental_days = diffDays + 1;

  if (listing.min_rental_days && rental_days < listing.min_rental_days) {
    return { ok: false, message: `Minimum rental is ${listing.min_rental_days} days.` };
  }
  if (listing.max_rental_days && rental_days > listing.max_rental_days) {
    return { ok: false, message: `Maximum rental is ${listing.max_rental_days} days.` };
  }

  // availability (approved + buffer)
  const buffer_days = Number(listing.turnaround_days ?? 0);

  const { data: approved } = await supabase
    .from("rentals")
    .select("start_date, end_date, buffer_days")
    .eq("listing_id", listing_id)
    .eq("status", "approved");

  const reqStart = parseISODate(start_date);
  const reqEnd = addDaysUTC(parseISODate(end_date), 1 + buffer_days);

  for (const r of approved ?? []) {
    const rStart = parseISODate(r.start_date);
    const rEnd = addDaysUTC(parseISODate(r.end_date), 1 + Number(r.buffer_days ?? 0));
    if (rangesOverlap(reqStart, reqEnd, rStart, rEnd)) {
      return { ok: false, message: "Listing not available for those dates." };
    }
  }

  // STEP #2: validate service choice + enforce caps server-side
  const driverHourCap =
    Number(listing.driver_max_hours) > 0 ? Number(listing.driver_max_hours) : DEFAULT_HOURLY_CAP;
  const driverLaborHourCap =
    Number(listing.driver_labor_max_hours) > 0
      ? Number(listing.driver_labor_max_hours)
      : DEFAULT_HOURLY_CAP;
  const operatorHourCap =
    Number(listing.operator_max_hours) > 0
      ? Number(listing.operator_max_hours)
      : DEFAULT_HOURLY_CAP;

  // Keep operator_selected in sync with unified service_choice
  const operatorSelectedFinal = service_choice === "operator" ? true : operator_selected;

  if (service_choice === "driver") {
    if (!listing.driver_enabled) return { ok: false, message: "Driver not available." };
    if (service_unit === "day") {
      if (!listing.driver_daily_enabled) return { ok: false, message: "Driver daily not available." };
      if (!(Number(listing.driver_day_rate) > 0)) return { ok: false, message: "Driver rate missing." };
    } else {
      if (!listing.driver_hourly_enabled) return { ok: false, message: "Driver hourly not available." };
      if (!(Number(listing.driver_hour_rate) > 0)) return { ok: false, message: "Driver rate missing." };
      if (service_hours < 1 || service_hours > driverHourCap) {
        return { ok: false, message: `Driver hours must be 1–${driverHourCap}.` };
      }
    }
  }

  if (service_choice === "driver_labor") {
    if (!listing.driver_labor_enabled) return { ok: false, message: "Driver + Labor not available." };
    if (service_unit === "day") {
      if (!listing.driver_labor_daily_enabled) {
        return { ok: false, message: "Driver + Labor daily not available." };
      }
      if (!(Number(listing.driver_labor_day_rate) > 0)) return { ok: false, message: "Driver + Labor rate missing." };
    } else {
      if (!listing.driver_labor_hourly_enabled) {
        return { ok: false, message: "Driver + Labor hourly not available." };
      }
      if (!(Number(listing.driver_labor_hour_rate) > 0)) return { ok: false, message: "Driver + Labor rate missing." };
      if (service_hours < 1 || service_hours > driverLaborHourCap) {
        return { ok: false, message: `Driver + Labor hours must be 1–${driverLaborHourCap}.` };
      }
    }
  }

  if (service_choice === "operator") {
    if (!listing.operator_enabled || !(Number(listing.operator_rate) > 0)) {
      return { ok: false, message: "Operator not available." };
    }
    // operator unit is fixed by listing.operator_rate_unit
    if (String(listing.operator_rate_unit ?? "day") === "hour") {
      const hours = service_hours || operator_hours;
      if (hours < 1 || hours > operatorHourCap) {
        return { ok: false, message: `Operator hours must be 1–${operatorHourCap}.` };
      }
    }
  }

  // ✅ STEP 4.3.3: Server-side delivery fee enforcement + discount
  // - never trust client delivery_fee
  // - apply discount only when delivery_selected AND service_choice !== "none" AND enabled
  let delivery_fee_final = 0;

  if (delivery_selected) {
    const baseDeliveryFee = Math.max(0, Number(listing.delivery_fee ?? 0) || 0);

    // If listing is pickup_only, we still clamp fee to 0 (defensive).
    // (We don't hard-block the request here to avoid breaking existing flows.)
    const mode = String(listing.delivery_mode ?? "pickup_only");
    const deliveryAllowed = mode !== "pickup_only";

    if (!deliveryAllowed) {
      delivery_fee_final = 0;
    } else {
      let discount = 0;
      const discountEnabled = Boolean(listing.delivery_service_discount_enabled);
      const discountAmount = Math.max(0, Number(listing.delivery_service_discount_amount ?? 0) || 0);

      if (discountEnabled && service_choice !== "none" && baseDeliveryFee > 0 && discountAmount > 0) {
        discount = Math.min(baseDeliveryFee, discountAmount);
      }

      delivery_fee_final = Math.max(0, baseDeliveryFee - discount);
    }
  }

  // operator totals (kept for invoice + finalize)
  let operator_days = 0;
  let operator_total = 0;
  let hourly_is_estimate = false;
  let hourly_estimated_hours: number | null = null;

  const operatorUnit = (String(listing.operator_rate_unit ?? "day") === "hour" ? "hour" : "day") as
    | "day"
    | "hour";
  const operatorRate = Math.max(0, Number(listing.operator_rate ?? 0) || 0);

  if (operatorSelectedFinal) {
    if (operatorUnit === "day") {
      operator_days = rental_days;
      operator_total = operator_days * operatorRate;
    } else {
      const hours = service_choice === "operator" ? service_hours : operator_hours;
      hourly_is_estimate = true;
      hourly_estimated_hours = hours;
      operator_total = hours * operatorRate;
    }
  }

  const rentalInsert = {
  listing_id,
  renter_id: user.id,
  start_date,
  end_date,
  buffer_days,
  message,
  status: "pending",

  delivery_selected,
  delivery_fee: delivery_fee_final,

  // operator snapshot (kept for existing invoice + finalize)
  operator_selected: operatorSelectedFinal,
  operator_rate: operatorRate,
  operator_rate_unit: operatorUnit,
  operator_days,
  operator_hours: operatorUnit === "hour" ? operator_hours : 0,
  operator_total,

  // hourly finalize support (existing)
  hourly_is_estimate,
  hourly_estimated_hours,
  hourly_final_hours: null,
  hourly_final_total: null,
  hourly_finalized_at: null,
};

assertAllowedInsertKeys("rentals", rentalInsert, [
  "listing_id",
  "renter_id",
  "start_date",
  "end_date",
  "buffer_days",
  "message",
  "status",

  "delivery_selected",
  "delivery_fee",

  "operator_selected",
  "operator_rate",
  "operator_rate_unit",
  "operator_days",
  "operator_hours",
  "operator_total",

  "hourly_is_estimate",
  "hourly_estimated_hours",
  "hourly_final_hours",
  "hourly_final_total",
  "hourly_finalized_at",
]);

const { error: insertError } = await supabase
  .from("rentals")
  .insert(rentalInsert);

  if (insertError) return { ok: false, message: insertError.message };

  revalidatePath(`/listings/${listing_id}`);
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/owner-rentals");

  return { ok: true, message: "Rental request sent." };
}

/* ---------------- Step 3.3 finalize hourly (unchanged behavior) ---------------- */

export async function ownerFinalizeHourly(rentalId: string, finalHoursInput: number) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  const final_hours = toInt(finalHoursInput);
  if (final_hours < 1) return { ok: false, message: "Final hours must be at least 1." };

  const { data: row } = await supabase
    .from("rentals")
    .select(
      `
      id,
      status,
      operator_selected,
      operator_rate,
      operator_rate_unit,
      hourly_finalized_at,
      listings:listing_id ( owner_id, operator_max_hours )
      `
    )
    .eq("id", rentalId)
    .single();

  if (!row) return { ok: false, message: "Rental not found." };
  if ((row as any).listings.owner_id !== user.id) return { ok: false, message: "Not allowed." };
  if (row.status !== "approved") return { ok: false, message: "Rental not approved." };
  if (!row.operator_selected || row.operator_rate_unit !== "hour") {
    return { ok: false, message: "Not an hourly operator rental." };
  }
  if (row.hourly_finalized_at) return { ok: false, message: "Already finalized." };

  const cap =
    Number((row as any).listings.operator_max_hours) > 0
      ? Number((row as any).listings.operator_max_hours)
      : DEFAULT_HOURLY_CAP;

  if (final_hours > cap) return { ok: false, message: `Hours cannot exceed ${cap}.` };

  const final_total = final_hours * Number(row.operator_rate);

  await supabase
    .from("rentals")
    .update({
      hourly_final_hours: final_hours,
      hourly_final_total: final_total,
      hourly_finalized_at: new Date().toISOString(),
      operator_hours: final_hours,
      operator_total: final_total,
    })
    .eq("id", rentalId);

  revalidatePath("/dashboard/owner-rentals");
  revalidatePath("/dashboard/rentals");

  return { ok: true, message: "Hourly service finalized." };
}
