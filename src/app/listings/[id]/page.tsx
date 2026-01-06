

export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import RentalRequestForm from "@/components/RentalRequestForm";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";

export default async function ListingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const id = params.id;

  /* =========================
     Listing (current DB schema)
  ========================== */
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      description,
      category,

      price_per_day,
      security_deposit,
      min_rental_days,
      max_rental_days,

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

      license_required,
      license_type,

      created_at
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (listingErr || !listing) notFound();

  /* =========================
     Photos
  ========================== */
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const { data: photos } = await supabase
    .from("listing_photos")
    .select("id, path, sort_order")
    .eq("listing_id", id)
    .order("sort_order", { ascending: true });

  const photoUrl = (path: string) =>
    `${base}/storage/v1/object/public/listing-photos/${path}`;

  /* =========================
     Blocked Dates
  ========================== */
  const { data: approvedRentals } = await supabase
    .from("rentals")
    .select("start_date, end_date, status")
    .eq("listing_id", id)
    .in("status", ["approved", "active"]);

  /* =========================
     Normalize numbers for UI + form
  ========================== */
  const pricePerDay = Number(listing.price_per_day ?? 0);
  const securityDeposit = Number(listing.security_deposit ?? 0);
  const minRentalDays =
    listing.min_rental_days == null ? undefined : Number(listing.min_rental_days);
  const maxRentalDays =
    listing.max_rental_days == null ? undefined : Number(listing.max_rental_days);

  const deliveryMode =
    (listing.delivery_mode as "pickup_only" | "pickup_or_delivery" | "delivery_only") ??
    "pickup_only";
  const deliveryFee = Number(listing.delivery_fee ?? 0);

  const licenseRequired = Boolean(listing.license_required);
  const licenseType = (listing.license_type as string) ?? "";

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Back (ONLY one button) */}
        <div className="mb-4">
          <Link href="/listings" className="rr-btn rr-btn-secondary rr-btn-sm">
            ← All listings
          </Link>
        </div>

        {/* Page header */}
        <PageHeader
          title={listing.title ?? "Listing"}
          subtitle={`Category: ${listing.category ?? "n/a"}`}
        />

        {/* Listing details */}
        <div className="rr-card p-5 mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="font-extrabold rr-outline-section">Daily rate</div>
              <div className="mt-1 font-semibold">${pricePerDay.toFixed(2)} / day</div>
            </div>

            <div>
              <div className="font-extrabold rr-outline-section">Deposit</div>
              <div className="mt-1 font-semibold">${securityDeposit.toFixed(2)}</div>
            </div>

            <div>
              <div className="font-extrabold rr-outline-section">Min / Max days</div>
              <div className="mt-1 font-semibold">
                {minRentalDays ?? "—"} / {maxRentalDays ?? "—"}
              </div>
            </div>

            <div>
              <div className="font-extrabold rr-outline-section">Delivery</div>
              <div className="mt-1 font-semibold">
                {deliveryMode}
                {deliveryMode !== "pickup_only" ? ` ($${deliveryFee.toFixed(2)})` : ""}
              </div>
            </div>

            <div>
              <div className="font-extrabold rr-outline-section">Required license</div>
              <div className="mt-1 font-semibold">
                {licenseRequired ? "Yes" : "No"}
                {licenseRequired && licenseType ? ` — ${licenseType}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Photos */}
        {photos?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {photos.map((p) => (
              <div key={p.id} className="rr-card p-2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(p.path)}
                  alt="Listing photo"
                  className="w-full h-44 object-cover rounded-lg border border-black/20"
                />
              </div>
            ))}
          </div>
        ) : null}

        {/* Description */}
        {listing.description ? (
          <div className="rr-card p-5 mb-6">
            <div className="rr-outline-section text-lg mb-2">Description</div>
            <p className="rr-subtext whitespace-pre-wrap">{listing.description}</p>
          </div>
        ) : null}

        {/* Rental form */}
        <div className="rr-card p-5">
          <RentalRequestForm
            listingId={id}
            blocked={approvedRentals ?? []}
            /* pricing + rules (fixes NaN + missing totals) */
            pricePerDay={pricePerDay}
            securityDeposit={securityDeposit}
            minRentalDays={minRentalDays}
            maxRentalDays={maxRentalDays}
            /* delivery */
            deliveryMode={deliveryMode}
            deliveryFee={deliveryFee}
            deliveryDiscountEnabled={Boolean(listing.delivery_service_discount_enabled)}
            deliveryDiscountAmount={Number(listing.delivery_service_discount_amount ?? 0)}
            /* category/license */
            category={(listing.category as string) ?? ""}
            licenseRequired={licenseRequired}
            licenseType={licenseType || null}
            /* operator */
            operatorEnabled={Boolean(listing.operator_enabled)}
            operatorRate={Number(listing.operator_rate ?? 0)}
            operatorRateUnit={(listing.operator_rate_unit as "day" | "hour") ?? "day"}
            operatorMaxHours={Number(listing.operator_max_hours ?? 0)}
            /* driver */
            driverEnabled={Boolean(listing.driver_enabled)}
            driverDailyEnabled={Boolean(listing.driver_daily_enabled)}
            driverHourlyEnabled={Boolean(listing.driver_hourly_enabled)}
            driverDayRate={Number(listing.driver_day_rate ?? 0)}
            driverHourRate={Number(listing.driver_hour_rate ?? 0)}
            driverMaxHours={Number(listing.driver_max_hours ?? 0)}
            /* driver labor */
            driverLaborEnabled={Boolean(listing.driver_labor_enabled)}
            driverLaborDailyEnabled={Boolean(listing.driver_labor_daily_enabled)}
            driverLaborHourlyEnabled={Boolean(listing.driver_labor_hourly_enabled)}
            driverLaborDayRate={Number(listing.driver_labor_day_rate ?? 0)}
            driverLaborHourRate={Number(listing.driver_labor_hour_rate ?? 0)}
            driverLaborMaxHours={Number(listing.driver_labor_max_hours ?? 0)}
          />
        </div>
      </main>
    </>
  );
}
