
export const dynamic = "force-dynamic";

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

  // Listing (include all service + license + delivery + discount fields)
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      description,
      category,
      daily_rate,
      hourly_rate,
      deposit,
      min_days,
      max_days,

      delivery_available,
      delivery_fee,
      delivery_service_discount_enabled,
      delivery_service_discount_amount,

      operator_available,
      operator_rate,
      operator_unit,
      operator_max_hours,

      driver_available,
      driver_rate,
      driver_unit,
      driver_max_hours,

      driver_labor_available,
      driver_labor_rate,
      driver_labor_unit,
      driver_labor_max_hours,

      license_required,
      license_note,

      created_at
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (listingErr) {
    // If the id is invalid or not found, show 404
    notFound();
  }
  if (!listing) notFound();

  // Photos (optional render)
  const { data: photos } = await supabase
    .from("listing_photos")
    .select("id, url, sort_order")
    .eq("listing_id", id)
    .order("sort_order", { ascending: true });

  // Blocked dates for the form (approved/active rentals)
  const { data: approvedRentals } = await supabase
    .from("rentals")
    .select("start_date, end_date, status")
    .eq("listing_id", id)
    .in("status", ["approved", "active"]);

  return (
    <div style={{ padding: 24 }}>
      <ServerHeader />

      <div style={{ marginTop: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          {listing.title ?? "Listing"}
        </h1>

        <div style={{ opacity: 0.8, marginBottom: 16 }}>
          Category: {listing.category ?? "n/a"}
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
                  src={p.url}
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
            // Services + license (already wired)
            operatorAvailable={Boolean(listing.operator_available)}
            operatorRate={Number(listing.operator_rate ?? 0)}
            operatorUnit={(listing.operator_unit as "day" | "hour") ?? "day"}
            operatorMaxHours={Number(listing.operator_max_hours ?? 0)}
            driverAvailable={Boolean(listing.driver_available)}
            driverRate={Number(listing.driver_rate ?? 0)}
            driverUnit={(listing.driver_unit as "day" | "hour") ?? "day"}
            driverMaxHours={Number(listing.driver_max_hours ?? 0)}
            driverLaborAvailable={Boolean(listing.driver_labor_available)}
            driverLaborRate={Number(listing.driver_labor_rate ?? 0)}
            driverLaborUnit={(listing.driver_labor_unit as "day" | "hour") ?? "day"}
            driverLaborMaxHours={Number(listing.driver_labor_max_hours ?? 0)}
            licenseRequired={Boolean(listing.license_required)}
            licenseNote={(listing.license_note as string) ?? ""}
            category={(listing.category as string) ?? ""}
            // Delivery
            deliveryAvailable={Boolean(listing.delivery_available)}
            deliveryFee={Number(listing.delivery_fee ?? 0)}
            // NEW: delivery discount wiring (Step 4.3)
            deliveryDiscountEnabled={Boolean(
              listing.delivery_service_discount_enabled
            )}
            deliveryDiscountAmount={Number(
              listing.delivery_service_discount_amount ?? 0
            )}
          />
        </div>
      </div>
    </div>
  );
}
