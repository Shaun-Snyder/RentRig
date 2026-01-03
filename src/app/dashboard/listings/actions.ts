
"use server";

import { createClient } from "@/lib/supabase/server";

function toStr(v: FormDataEntryValue | null) {
  return (typeof v === "string" ? v : "").trim();
}
function toBool(v: FormDataEntryValue | null) {
  const s = toStr(v).toLowerCase();
  return s === "true" || s === "on" || s === "1" || s === "yes";
}
function toNum(v: FormDataEntryValue | null) {
  const s = toStr(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Allows calling a server action as:
 *   fn(fd)
 * OR:
 *   fn(prevState, fd)
 */
function normalizeFormData(arg1: any, arg2?: any): FormData {
  if (arg1 instanceof FormData) return arg1;
  if (arg2 instanceof FormData) return arg2;
  throw new Error("FormData not provided to action.");
}

const DELIVERY_MODES = ["pickup_only", "delivery_only", "pickup_or_delivery"] as const;
type DeliveryMode = (typeof DELIVERY_MODES)[number];

function normalizeDeliveryMode(raw: string): DeliveryMode {
  const v = raw.trim();
  if ((DELIVERY_MODES as readonly string[]).includes(v)) return v as DeliveryMode;
  // safe default that satisfies NOT NULL + CHECK constraint
  return "pickup_only";
}

export async function createListing(arg1: any, arg2?: any) {
  const fd = normalizeFormData(arg1, arg2);

  const title = toStr(fd.get("title"));
  const category = toStr(fd.get("category"));
  const description = toStr(fd.get("description")) || null;

  const price_per_day = toNum(fd.get("price_per_day"));
  const security_deposit = toNum(fd.get("security_deposit"));

  const city = toStr(fd.get("city")) || null;
  const state = toStr(fd.get("state")) || null;

  const cancellation_policy = toStr(fd.get("cancellation_policy")) || null;

  const license_required = toBool(fd.get("license_required"));
  const license_type = toStr(fd.get("license_type")) || null;

  const delivery_mode = normalizeDeliveryMode(toStr(fd.get("delivery_mode")) || "pickup_only");
  const delivery_fee = toNum(fd.get("delivery_fee")) ?? 0;

  const delivery_service_discount_enabled = toBool(fd.get("delivery_service_discount_enabled"));
  const delivery_service_discount_amount = toNum(fd.get("delivery_service_discount_amount")) ?? 0;

  const operator_enabled = toBool(fd.get("operator_enabled"));
  const operator_rate = toNum(fd.get("operator_rate"));
  const operator_rate_unit = toStr(fd.get("operator_rate_unit")) || "day";
  const operator_max_hours = toNum(fd.get("operator_max_hours"));

  const driver_enabled = toBool(fd.get("driver_enabled"));
  const driver_daily_enabled = toBool(fd.get("driver_daily_enabled"));
  const driver_hourly_enabled = toBool(fd.get("driver_hourly_enabled"));
  const driver_day_rate = toNum(fd.get("driver_day_rate"));
  const driver_hour_rate = toNum(fd.get("driver_hour_rate"));
  const driver_max_hours = toNum(fd.get("driver_max_hours"));

  const driver_labor_enabled = toBool(fd.get("driver_labor_enabled"));
  const driver_labor_daily_enabled = toBool(fd.get("driver_labor_daily_enabled"));
  const driver_labor_hourly_enabled = toBool(fd.get("driver_labor_hourly_enabled"));
  const driver_labor_day_rate = toNum(fd.get("driver_labor_day_rate"));
  const driver_labor_hour_rate = toNum(fd.get("driver_labor_hour_rate"));
  const driver_labor_max_hours = toNum(fd.get("driver_labor_max_hours"));

  const turnaround_days = toNum(fd.get("turnaround_days")) ?? 0;
  const min_rental_days = toNum(fd.get("min_rental_days")) ?? 1;
  const max_rental_days = toNum(fd.get("max_rental_days"));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, message: "Not signed in." };

  const payload: any = {
    owner_id: userId,
    title,
    category,
    description,

    price_per_day,
    security_deposit,

    city,
    state,

    cancellation_policy,

    license_required,
    license_type,

    delivery_mode,
    delivery_fee,
    delivery_service_discount_enabled,
    delivery_service_discount_amount,

    operator_enabled,
    operator_rate,
    operator_rate_unit,
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
    driver_labor_max_hours,

    turnaround_days,
    min_rental_days,
    max_rental_days: Number.isFinite(max_rental_days as any) ? max_rental_days : null,

    is_published: false,
  };

  const { data, error } = await supabase
    .from("listings")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  const listingId = (data as any)?.id as string | undefined;
  if (!listingId) return { ok: false, message: "Created listing but missing id." };

  // ✅ This is the contract Create Photos relies on:
  return { ok: true, message: "Created.", listingId };
}

export async function updateListing(arg1: any, arg2?: any) {
  const fd = normalizeFormData(arg1, arg2);

  const id = toStr(fd.get("id"));
  if (!id) return { ok: false, message: "Missing listing id." };

  const title = toStr(fd.get("title"));
  const category = toStr(fd.get("category"));
  const description = toStr(fd.get("description")) || null;

  const price_per_day = toNum(fd.get("price_per_day"));
  const security_deposit = toNum(fd.get("security_deposit"));

  const city = toStr(fd.get("city")) || null;
  const state = toStr(fd.get("state")) || null;

  const cancellation_policy = toStr(fd.get("cancellation_policy")) || null;

  // Only update publish status if explicitly sent
const has_is_published = fd.has("is_published");
const is_published = has_is_published
  ? toBool(fd.get("is_published"))
  : undefined;

  const license_required = toBool(fd.get("license_required"));
  const license_type = toStr(fd.get("license_type")) || null;

  const delivery_mode = normalizeDeliveryMode(toStr(fd.get("delivery_mode") || "pickup_only"));
  const delivery_fee = toNum(fd.get("delivery_fee")) ?? 0;

  const delivery_service_discount_enabled = toBool(fd.get("delivery_service_discount_enabled"));
  const delivery_service_discount_amount = toNum(fd.get("delivery_service_discount_amount")) ?? 0;

  const operator_enabled = toBool(fd.get("operator_enabled"));
  const operator_rate = toNum(fd.get("operator_rate"));
  const operator_rate_unit = toStr(fd.get("operator_rate_unit")) || "day";
  const operator_max_hours = toNum(fd.get("operator_max_hours"));

  const driver_enabled = toBool(fd.get("driver_enabled"));
  const driver_daily_enabled = toBool(fd.get("driver_daily_enabled"));
  const driver_hourly_enabled = toBool(fd.get("driver_hourly_enabled"));
  const driver_day_rate = toNum(fd.get("driver_day_rate"));
  const driver_hour_rate = toNum(fd.get("driver_hour_rate"));
  const driver_max_hours = toNum(fd.get("driver_max_hours"));

  const driver_labor_enabled = toBool(fd.get("driver_labor_enabled"));
  const driver_labor_daily_enabled = toBool(fd.get("driver_labor_daily_enabled"));
  const driver_labor_hourly_enabled = toBool(fd.get("driver_labor_hourly_enabled"));
  const driver_labor_day_rate = toNum(fd.get("driver_labor_day_rate"));
  const driver_labor_hour_rate = toNum(fd.get("driver_labor_hour_rate"));
  const driver_labor_max_hours = toNum(fd.get("driver_labor_max_hours"));

  const turnaround_days = toNum(fd.get("turnaround_days"));
  const min_rental_days = toNum(fd.get("min_rental_days"));
  const max_rental_days = toNum(fd.get("max_rental_days"));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase
    .from("listings")
    .update({
      title: title || undefined,
      category: category || undefined,
      description,

      license_required: fd.get("license_required") ? true : false,
      license_type: String(fd.get("license_type") ?? "") || null,

      price_per_day,
      security_deposit,

      city,
      state,

      cancellation_policy,

      is_published,

      delivery_mode,
      delivery_fee,

      delivery_service_discount_enabled,
      delivery_service_discount_amount,

      operator_enabled,
      operator_rate,
      operator_rate_unit,
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
      driver_labor_max_hours,

      turnaround_days,
      min_rental_days,
      max_rental_days,
    })
    .eq("id", id)
    .eq("owner_id", userId);

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Saved." };
}

export async function deleteListing(arg1: any, arg2?: any) {
  const fd = normalizeFormData(arg1, arg2);
  const id = toStr(fd.get("id"));
  if (!id) return { ok: false, message: "Missing listing id." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase.from("listings").delete().eq("id", id).eq("owner_id", userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Deleted." };
}

export async function togglePublish(listingId: string, nextPublished: boolean) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase
    .from("listings")
    .update({ is_published: nextPublished })
    .eq("id", listingId)
    .eq("owner_id", userId);

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: nextPublished ? "Published." : "Unpublished." };
}
