
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import RentalRequestForm from "@/components/RentalRequestForm";
import { createClient } from "@/lib/supabase/server";

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
    <div style={{ padding: 24 }}>
      <ServerHeader />

      {/* Back buttons */}
      <div style={{ marginTop: 12, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/listings"
          style={{
            display: "inline-block",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            textDecoration: "none",
          }}
        >
          ← All listings
        </Link>

        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            textDecoration: "none",
          }}
        >
          Dashboard
        </Link>
      </div>

      <div style={{ marginTop: 4 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          {listing.title ?? "Listing"}
        </h1>

        <div style={{ opacity: 0.8, marginBottom: 16 }}>
          Category: {listing.category ?? "n/a"}
        </div>

        {/* Listing details */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
            background: "#fff",
            maxWidth: 900,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Daily rate</div>
              <div>${pricePerDay.toFixed(2)} / day</div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Deposit</div>
              <div>${securityDeposit.toFixed(2)}</div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Min / Max days</div>
              <div>
                {minRentalDays ?? "—"} / {maxRentalDays ?? "—"}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Delivery</div>
              <div>
                {deliveryMode}
                {deliveryMode !== "pickup_only" ? ` ($${deliveryFee.toFixed(2)})` : ""}
              </div>
            </div>

            {/* REQUIRED LICENSE (this is what you asked for) */}
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Required license</div>
              <div>
                {licenseRequired ? "Yes" : "No"}
                {licenseRequired && licenseType ? ` — ${licenseType}` : ""}
              </div>
            </div>
          </div>
        </div>

        {photos?.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {photos.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(p.path)}
                  alt="Listing photo"
                  style={{ width: "100%", height: 180, objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        ) : null}

        {listing.description ? (
          <p style={{ marginBottom: 18, maxWidth: 900 }}>{listing.description}</p>
        ) : null}

        {/* Rental form */}
        <div style={{ marginTop: 12 }}>
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
      </div>
    </div>
  );
}
