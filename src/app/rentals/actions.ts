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

  const booking_unit =
    String(formData.get("booking_unit") ?? "day") === "hour" ? "hour" : "day";

  const hourly_start_time = String(
    formData.get("hourly_start_time") ?? "",
  ).trim();

  const hourly_hours = toInt(formData.get("hourly_hours"), 0);

  if (!listing_id) return { ok: false, message: "Missing listing id." };
  if (!isValidISODate(start_date) || !isValidISODate(end_date)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." };
  }

  const rental_days = Math.max(
    1,
    Math.round(
      (parseISODate(end_date).getTime() - parseISODate(start_date).getTime()) /
        86400000,
    ),
  );

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
    String(formData.get("operator_rate_unit") ?? "") === "hour"
      ? "hour"
      : "day";
  const operator_rate = Math.max(
    0,
    Number(formData.get("operator_rate") ?? 0) || 0,
  );
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

      price_per_day,
rental_hour_rate,
security_deposit,

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
      `,
    )
    .eq("id", listing_id)
    .single();

  if (listingErr || !listing)
    return { ok: false, message: "Listing not found." };
  if (!listing.is_published)
    return { ok: false, message: "This listing is not published." };

  if (listing.owner_id === user.id)
    return { ok: false, message: "You cannot request your own listing." };

  const isHeavy = HEAVY_CATEGORIES.has(listing.category);

  // STEP #3 optional rule
  if (OPERATOR_ONLY_HEAVY_LIFTS && service_choice === "operator" && !isHeavy) {
    return {
      ok: false,
      message: "Operator is only available for heavy equipment and lifts.",
    };
  }

  // HARD LICENSE BLOCK:
  // If a heavy-equipment or lift listing requires a license,
  // the renter must either confirm they have it or select
  // an owner-provided licensed service.
  const hasOwnerProvidedLicensedService =
    service_choice === "operator" ||
    service_choice === "driver" ||
    service_choice === "driver_labor";

  if (
    isHeavy &&
    listing.license_required &&
    !renter_has_license &&
    !hasOwnerProvidedLicensedService
  ) {
    return {
      ok: false,
      message:
        "This equipment requires the proper license or an owner-provided driver or operator.",
    };
  }

  // availability (approved + buffer)
  const buffer_days = Number(listing.turnaround_days ?? 0);

  const { data: approved } = await supabase
    .from("rentals")
    .select(
      `
    start_date,
    end_date,
    buffer_days,
    booking_unit,
    hourly_start_time,
    hourly_end_time
  `,
    )
    .eq("listing_id", listing_id)
    .eq("status", "approved");

  if (booking_unit === "day") {
    const reqStart = parseISODate(start_date);
    const reqEnd = addDaysUTC(parseISODate(end_date), 1 + buffer_days);

    for (const r of approved ?? []) {
      // An hourly rental should not automatically block the entire day.
      if (r.booking_unit === "hour") continue;

      const rStart = parseISODate(r.start_date);
      const rEnd = addDaysUTC(
        parseISODate(r.end_date),
        1 + Number(r.buffer_days ?? 0),
      );

      if (rangesOverlap(reqStart, reqEnd, rStart, rEnd)) {
        return {
          ok: false,
          message: "Listing not available for those dates.",
        };
      }
    }
  }

  if (booking_unit === "hour") {
    if (!hourly_start_time || hourly_hours < 1) {
      return {
        ok: false,
        message: "Choose a valid hourly start time and rental length.",
      };
    }

    const [startHour, startMinute] = hourly_start_time.split(":").map(Number);

    const requestStartMinutes = startHour * 60 + startMinute;
    const requestEndMinutes = requestStartMinutes + hourly_hours * 60;

    const requestDate = parseISODate(start_date);
    const weekday = requestDate.getUTCDay();

    const { data: hourlyWindows, error: hourlyWindowsError } = await supabase
      .from("listing_hourly_availability")
      .select("start_time, end_time")
      .eq("listing_id", listing_id)
      .eq("weekday", weekday);

    if (hourlyWindowsError) {
      return {
        ok: false,
        message: hourlyWindowsError.message,
      };
    }

    const fitsOwnerAvailability = (hourlyWindows ?? []).some((window) => {
      const [windowStartHour, windowStartMinute] = String(window.start_time)
        .slice(0, 5)
        .split(":")
        .map(Number);

      const [windowEndHour, windowEndMinute] = String(window.end_time)
        .slice(0, 5)
        .split(":")
        .map(Number);

      const windowStartMinutes = windowStartHour * 60 + windowStartMinute;

      const windowEndMinutes = windowEndHour * 60 + windowEndMinute;

      return (
        requestStartMinutes >= windowStartMinutes &&
        requestEndMinutes <= windowEndMinutes
      );
    });

    if (!fitsOwnerAvailability) {
      return {
        ok: false,
        message: "Requested hours are outside the owner's available hours.",
      };
    }

    for (const r of approved ?? []) {
      // A daily rental still blocks the entire date.
      if (r.booking_unit !== "hour") {
        if (r.start_date === start_date) {
          return {
            ok: false,
            message: "Listing is already booked for that date.",
          };
        }

        continue;
      }

      // Hourly bookings only conflict if they are on the same date.
      if (r.start_date !== start_date) continue;

      if (!r.hourly_start_time || !r.hourly_end_time) continue;

      const [bookedStartHour, bookedStartMinute] = r.hourly_start_time
        .slice(0, 5)
        .split(":")
        .map(Number);

      const [bookedEndHour, bookedEndMinute] = r.hourly_end_time
        .slice(0, 5)
        .split(":")
        .map(Number);

      const bookedStartMinutes = bookedStartHour * 60 + bookedStartMinute;

      const bookedEndMinutes = bookedEndHour * 60 + bookedEndMinute;

      const overlaps =
        requestStartMinutes < bookedEndMinutes &&
        bookedStartMinutes < requestEndMinutes;

      if (overlaps) {
        return {
          ok: false,
          message: "Those hours are already booked.",
        };
      }
    }
  }

  // STEP #2: validate service choice + enforce caps server-side
  const driverHourCap =
    Number(listing.driver_max_hours) > 0
      ? Number(listing.driver_max_hours)
      : DEFAULT_HOURLY_CAP;
  const driverLaborHourCap =
    Number(listing.driver_labor_max_hours) > 0
      ? Number(listing.driver_labor_max_hours)
      : DEFAULT_HOURLY_CAP;
  const operatorHourCap =
    Number(listing.operator_max_hours) > 0
      ? Number(listing.operator_max_hours)
      : DEFAULT_HOURLY_CAP;

  // Keep operator_selected in sync with unified service_choice
  const operatorSelectedFinal =
    service_choice === "operator" ? true : operator_selected;

  if (service_choice === "driver") {
    if (!listing.driver_enabled)
      return { ok: false, message: "Driver not available." };
    if (service_unit === "day") {
      if (!listing.driver_daily_enabled)
        return { ok: false, message: "Driver daily not available." };
      if (!(Number(listing.driver_day_rate) > 0))
        return { ok: false, message: "Driver rate missing." };
    } else {
      if (!listing.driver_hourly_enabled)
        return { ok: false, message: "Driver hourly not available." };
      if (!(Number(listing.driver_hour_rate) > 0))
        return { ok: false, message: "Driver rate missing." };
      if (service_hours < 1 || service_hours > driverHourCap) {
        return {
          ok: false,
          message: `Driver hours must be 1–${driverHourCap}.`,
        };
      }
    }
  }

  if (service_choice === "driver_labor") {
    if (!listing.driver_labor_enabled)
      return { ok: false, message: "Driver + Labor not available." };
    if (service_unit === "day") {
      if (!listing.driver_labor_daily_enabled) {
        return { ok: false, message: "Driver + Labor daily not available." };
      }
      if (!(Number(listing.driver_labor_day_rate) > 0))
        return { ok: false, message: "Driver + Labor rate missing." };
    } else {
      if (!listing.driver_labor_hourly_enabled) {
        return { ok: false, message: "Driver + Labor hourly not available." };
      }
      if (!(Number(listing.driver_labor_hour_rate) > 0))
        return { ok: false, message: "Driver + Labor rate missing." };
      if (service_hours < 1 || service_hours > driverLaborHourCap) {
        return {
          ok: false,
          message: `Driver + Labor hours must be 1–${driverLaborHourCap}.`,
        };
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
        return {
          ok: false,
          message: `Operator hours must be 1–${operatorHourCap}.`,
        };
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
      const discountEnabled = Boolean(
        listing.delivery_service_discount_enabled,
      );
      const discountAmount = Math.max(
        0,
        Number(listing.delivery_service_discount_amount ?? 0) || 0,
      );

      if (
        discountEnabled &&
        service_choice !== "none" &&
        baseDeliveryFee > 0 &&
        discountAmount > 0
      ) {
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

  const operatorUnit = (
    String(listing.operator_rate_unit ?? "day") === "hour" ? "hour" : "day"
  ) as "day" | "hour";
  const operatorRate = Math.max(0, Number(listing.operator_rate ?? 0) || 0);

  if (operatorSelectedFinal) {
    if (operatorUnit === "day") {
      operator_days = rental_days;
      operator_total = operator_days * operatorRate;
    } else {
      const hours =
        service_choice === "operator" ? service_hours : operator_hours;
      hourly_is_estimate = true;
      hourly_estimated_hours = hours;
      operator_total = hours * operatorRate;
    }
  }

  // unified service snapshot
  let service_rate = 0;
  let service_days = 0;
  let service_hours_final = 0;
  let service_total = 0;

  if (service_choice === "operator") {
    service_rate = operatorRate;
    if (operatorUnit === "day") {
      service_days = rental_days;
      service_total = service_rate * service_days;
    } else {
      service_hours_final = service_hours;
      service_total = service_rate * service_hours_final;
    }
  }

  if (service_choice === "driver") {
    if (service_unit === "day") {
      service_rate = Math.max(0, Number(listing.driver_day_rate ?? 0) || 0);
      service_days = rental_days;
      service_total = service_rate * service_days;
    } else {
      service_rate = Math.max(0, Number(listing.driver_hour_rate ?? 0) || 0);
      service_hours_final = service_hours;
      service_total = service_rate * service_hours_final;
    }
  }

  if (service_choice === "driver_labor") {
    if (service_unit === "day") {
      service_rate = Math.max(
        0,
        Number(listing.driver_labor_day_rate ?? 0) || 0,
      );
      service_days = rental_days;
      service_total = service_rate * service_days;
    } else {
      service_rate = Math.max(
        0,
        Number(listing.driver_labor_hour_rate ?? 0) || 0,
      );
      service_hours_final = service_hours;
      service_total = service_rate * service_hours_final;
    }
  }

  const service_unit_final =
    service_choice === "none"
      ? null
      : service_choice === "operator"
        ? operatorUnit
        : service_unit;

  const rental_rate_unit = booking_unit === "hour" ? "hour" : "day";

  const rental_rate =
    booking_unit === "hour"
      ? Math.max(0, Number(listing.rental_hour_rate ?? 0) || 0)
      : Math.max(0, Number(listing.price_per_day ?? 0) || 0);

  const rental_quantity = booking_unit === "hour" ? hourly_hours : rental_days;

  const rental_subtotal = rental_rate * rental_quantity;

  const security_deposit_amount = Math.max(
    0,
    Number(listing.security_deposit ?? 0) || 0,
  );

  const customer_total = Math.max(
    0,
    rental_subtotal + delivery_fee_final + service_total,
  );

  const rentrig_fee_rate = 0.1;

  const rentrig_fee_amount =
    Math.round(customer_total * rentrig_fee_rate * 100) / 100;

  const owner_payout_amount =
    Math.round((customer_total - rentrig_fee_amount) * 100) / 100;

  let hourly_end_time: string | null = null;

  if (booking_unit === "hour" && hourly_start_time && hourly_hours > 0) {
    const [startHour, startMinute] = hourly_start_time.split(":").map(Number);

    const totalMinutes = startHour * 60 + startMinute + hourly_hours * 60;

    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;

    hourly_end_time = `${String(endHour).padStart(2, "0")}:${String(
      endMinute,
    ).padStart(2, "0")}`;
  }

  const rentalInsert = {
    listing_id,
    renter_id: user.id,
    start_date,
    end_date,
    buffer_days,
    message,
    status: "pending",
    is_inquiry: false,

    booking_unit,
    hourly_start_time: booking_unit === "hour" ? hourly_start_time : null,
    hourly_end_time: booking_unit === "hour" ? hourly_end_time : null,

    rental_rate_unit,
    rental_rate,
    rental_quantity,
    rental_subtotal,
    security_deposit_amount,
    rentrig_fee_rate,
    rentrig_fee_amount,
    owner_payout_amount,

    delivery_selected,
    delivery_fee: delivery_fee_final,

    // unified service snapshot
    service_choice,
    service_unit: service_unit_final,
    service_rate,
    service_days,
    service_hours: service_hours_final,
    service_total,

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
    "is_inquiry",

    "booking_unit",
    "hourly_start_time",
    "hourly_end_time",

    "rental_rate_unit",
    "rental_rate",
    "rental_quantity",
    "rental_subtotal",
    "security_deposit_amount",
    "rentrig_fee_rate",
    "rentrig_fee_amount",
    "owner_payout_amount",

    "delivery_selected",
    "delivery_fee",

    "service_choice",
    "service_unit",
    "service_rate",
    "service_days",
    "service_hours",
    "service_total",

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

  const { data: existingInquiry } = await supabase
    .from("rentals")
    .select("id")
    .eq("listing_id", listing_id)
    .eq("renter_id", user.id)
    .eq("is_inquiry", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let rentalId: string | null = null;

  if (existingInquiry?.id) {
    const { error: updateError } = await supabase
      .from("rentals")
      .update({
        ...rentalInsert,
        is_inquiry: false,
      })
      .eq("id", existingInquiry.id);

    if (updateError) return { ok: false, message: updateError.message };

    rentalId = existingInquiry.id;
  } else {
    const { data: createdRental, error: insertError } = await supabase
      .from("rentals")
      .insert({
        ...rentalInsert,
        is_inquiry: false,
      })
      .select("id")
      .single();

    if (insertError) return { ok: false, message: insertError.message };

    rentalId = createdRental?.id ?? null;
  }
  if (rentalId && message) {
    await supabase.from("rental_messages").insert({
      rental_id: rentalId,
      sender_id: user.id,
      body: message,
    });
  }
  revalidatePath(`/listings/${listing_id}`);
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/owner-rentals");

  return { ok: true, message: "Rental request sent.", rentalId };
}

/* ---------------- Step 3.3 finalize hourly (unchanged behavior) ---------------- */

export async function ownerFinalizeHourly(
  rentalId: string,
  finalHoursInput: number,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  const final_hours = toInt(finalHoursInput);
  if (final_hours < 1)
    return { ok: false, message: "Final hours must be at least 1." };

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
      `,
    )
    .eq("id", rentalId)
    .single();

  if (!row) return { ok: false, message: "Rental not found." };
  if ((row as any).listings.owner_id !== user.id)
    return { ok: false, message: "Not allowed." };
  if (row.status !== "approved")
    return { ok: false, message: "Rental not approved." };
  if (!row.operator_selected || row.operator_rate_unit !== "hour") {
    return { ok: false, message: "Not an hourly operator rental." };
  }
  if (row.hourly_finalized_at)
    return { ok: false, message: "Already finalized." };

  const cap =
    Number((row as any).listings.operator_max_hours) > 0
      ? Number((row as any).listings.operator_max_hours)
      : DEFAULT_HOURLY_CAP;

  if (final_hours > cap)
    return { ok: false, message: `Hours cannot exceed ${cap}.` };

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

// ---------- Rental condition inspections (check-in / check-out) ----------

export type CreateRentalInspectionResult = {
  ok: boolean;
  message: string;
};

export async function createRentalInspection(
  formData: FormData,
): Promise<CreateRentalInspectionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Not authenticated" };
  }

  const rentalId = formData.get("rental_id");
  const role = formData.get("role");
  const phase = formData.get("phase");
  const odometerStr = (formData.get("odometer") ?? "").toString().trim();
  const hoursStr = (formData.get("hours_used") ?? "").toString().trim();
  const fuelStr = (formData.get("fuel_percent") ?? "").toString().trim();
  const notes = (formData.get("notes") ?? "").toString().trim();

  // Basic required fields
  if (!rentalId || typeof rentalId !== "string") {
    return { ok: false, message: "Missing rental_id" };
  }

  if (role !== "owner" && role !== "renter") {
    return { ok: false, message: "Invalid role" };
  }

  if (phase !== "checkin" && phase !== "checkout") {
    return { ok: false, message: "Invalid phase" };
  }

  // Optional numeric fields – only set if provided & valid
  let odometer: number | null = null;
  if (odometerStr !== "") {
    const parsed = Number(odometerStr);
    if (!Number.isNaN(parsed)) {
      odometer = parsed;
    }
  }

  let hoursUsed: number | null = null;
  if (hoursStr !== "") {
    const parsed = Number(hoursStr);
    if (!Number.isNaN(parsed)) {
      hoursUsed = parsed;
    }
  }

  let fuelPercent: number | null = null;
  if (fuelStr !== "") {
    const parsed = Number(fuelStr);
    if (!Number.isNaN(parsed)) {
      // Clamp to 0–100 to satisfy the CHECK constraint
      fuelPercent = Math.min(100, Math.max(0, parsed));
    }
  }

  // Insert inspection record
  const { data: inspectionRows, error: insertError } = await supabase
    .from("rental_inspections")
    .insert({
      rental_id: rentalId,
      role,
      phase,
      odometer,
      hours_used: hoursUsed,
      fuel_percent: fuelPercent,
      notes: notes === "" ? null : notes,
    })
    .select("id")
    .limit(1);

  if (insertError || !inspectionRows || inspectionRows.length === 0) {
    console.error("createRentalInspection error:", insertError?.message);
    return {
      ok: false,
      message: "Could not save inspection. Please try again.",
    };
  }

  const inspectionId = inspectionRows[0].id;

  // ---------- Upload any attached photo files ----------
  const photoFilesRaw = formData.getAll("photos");
  const uploadedUrls: string[] = [];

  if (photoFilesRaw.length > 0) {
    for (const value of photoFilesRaw) {
      // Only care about non-empty File objects
      if (!(value instanceof File) || value.size === 0) continue;

      // Build a reasonably safe file path
      const originalName = value.name || "photo";
      const safeBase =
        originalName
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase() || "photo";

      const extMatch = originalName.match(/\.([a-z0-9]{1,5})$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
      const safeExt = ext.match(/^[a-z0-9]{1,5}$/) ? ext : "jpg";

      const path = `${user.id}/${inspectionId}/${Date.now()}-${safeBase}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from("rental-inspection-photos")
        .upload(path, value, {
          upsert: false,
        });

      if (uploadError) {
        console.error("Inspection photo upload error:", uploadError.message);
        continue;
      }

      const { data: publicData } = supabase.storage
        .from("rental-inspection-photos")
        .getPublicUrl(path);

      if (publicData?.publicUrl) {
        uploadedUrls.push(publicData.publicUrl);
      }
    }
  }

  // Also support any pre-provided URLs (if ever used)
  const photoUrlsRaw = formData.getAll("photo_urls");
  const manualUrls = photoUrlsRaw
    .map((v) => v?.toString().trim())
    .filter((v) => !!v) as string[];

  const allUrls = [...uploadedUrls, ...manualUrls];

  if (allUrls.length > 0) {
    const photoInserts = allUrls.map((url) => ({
      inspection_id: inspectionId,
      url,
      uploaded_by: user.id,
    }));

    const { error: photoError } = await supabase
      .from("rental_inspection_photos")
      .insert(photoInserts);

    if (photoError) {
      console.error(
        "createRentalInspection photo insert error:",
        photoError.message,
      );
      // We don't fail the whole action here; the main inspection saved.
    }
  }
  return {
    ok: true,
    message: "Inspection saved.",
  };
}

export async function cancelRental(rentalId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Not authenticated." };
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, renter_id, status")
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) {
    return {
      ok: false,
      message: rentalError?.message || "Rental not found.",
    };
  }

  if (rental.renter_id !== user.id) {
    return { ok: false, message: "You cannot cancel this rental." };
  }

  if (rental.status !== "pending") {
    return {
      ok: false,
      message: "Only pending rental requests can be cancelled.",
    };
  }

  const { error: updateError } = await supabase
    .from("rentals")
    .update({ status: "cancelled" })
    .eq("id", rentalId)
    .eq("renter_id", user.id)
    .eq("status", "pending");

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/owner-rentals");

  return { ok: true, message: "Rental request cancelled." };
}

export async function submitRating(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Not authenticated." };

  const rental_id = String(formData.get("rental_id") ?? "");
  const reviewed_user_id = String(formData.get("reviewed_user_id") ?? "");
  const stars = Number(formData.get("stars") ?? 0);

  if (!rental_id || !reviewed_user_id || stars < 1 || stars > 5) {
    return { ok: false, message: "Invalid rating." };
  }

  const { data: rental } = await supabase
    .from("rentals")
    .select("id, renter_id, listing:listings(owner_id)")
    .eq("id", rental_id)
    .single();

  if (!rental) return { ok: false, message: "Rental not found." };

  const ownerId = (rental as any)?.listing?.owner_id;
  const renterId = rental.renter_id;

  if (user.id !== ownerId && user.id !== renterId) {
    return { ok: false, message: "Not allowed." };
  }

  if (user.id === reviewed_user_id) {
    return { ok: false, message: "Cannot rate yourself." };
  }

  const { error } = await supabase.from("profile_ratings").insert({
    rental_id,
    reviewer_id: user.id,
    reviewed_user_id,
    stars,
  });

  if (error) return { ok: false, message: error.message };

  return { ok: true, message: "Rating submitted." };
}
