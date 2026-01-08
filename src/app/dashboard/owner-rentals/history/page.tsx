export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import OwnerRentalsClient from "@/components/OwnerRentalsClient";
import PageHeader from "@/components/PageHeader";

export default async function OwnerRentalsHistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) redirect("/login");
  const user = data.user;

  // Today as YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10);

  // Get rentals for this owner's listings that have already ended
  const { data: rentals, error: rentalsError } = await supabase
    .from("rentals")
    .select(
      [
        "id",
        "listing_id",
        "renter_id",
        "start_date",
        "end_date",
        "status",
        "message",
        "created_at",

        "hourly_is_estimate",
        "hourly_estimated_hours",
        "hourly_final_hours",
        "hourly_final_total",
        "hourly_finalized_at",

        "operator_selected",
        "operator_rate_unit",
        "operator_rate",
        "operator_hours",
        "operator_total",

        "inspections:rental_inspections(id, role, phase, odometer, hours_used, fuel_percent, notes, created_at, photos:rental_inspection_photos(id, url))",
      ].join(", ")
    )
    .lt("end_date", today)
    .order("end_date", { ascending: false });

  if (rentalsError) {
    console.error("OwnerRentalsHistoryPage rentalsError:", rentalsError);
  }

  // Same enrichment as main owner page: attach listings the user owns
  const listingIds = Array.from(new Set((rentals ?? []).map((r) => r.listing_id)));

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, owner_id")
    .in(
      "id",
      listingIds.length
        ? listingIds
        : ["00000000-0000-0000-0000-000000000000"]
    );

  const ownedListings = (listings ?? []).filter((l) => l.owner_id === user.id);
  const listingMap = new Map(ownedListings.map((l) => [l.id, l]));

  const enriched = (rentals ?? [])
    .filter((r) => listingMap.has(r.listing_id))
    .map((r) => ({
      ...r,
      listing: listingMap.get(r.listing_id) ?? null,
    }));

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title="Owner History"
          subtitle="Past rentals for your listings, including inspections and invoices."
        />

        <div className="mt-2 mb-4">
          <a
            href="/dashboard/owner-rentals"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            ← Back to owner requests
          </a>
        </div>

        <OwnerRentalsClient rentals={enriched as any} />
      </main>
    </>
  );
}
