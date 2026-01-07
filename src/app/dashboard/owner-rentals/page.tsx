export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import OwnerRentalsClient from "@/components/OwnerRentalsClient";
import PageHeader from "@/components/PageHeader";

export default async function OwnerRentalsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) redirect("/login");
  const user = data.user;

  // Get all rentals where the listing is owned by this user
  // NOTE: RLS should already restrict rows to only the owner's listings.
  const { data: rentals } = await supabase
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

        // Step 3.3 fields (hourly estimate -> finalize)
        "hourly_is_estimate",
        "hourly_estimated_hours",
        "hourly_final_hours",
        "hourly_final_total",
        "hourly_finalized_at",

        // Operator snapshot
        "operator_selected",
        "operator_rate_unit",
        "operator_rate",
        "operator_hours",
        "operator_total",
      ].join(", ")
    )
    .order("created_at", { ascending: false });

  // Filter server-side using listings ownership
  const listingIds = Array.from(new Set((rentals ?? []).map((r) => r.listing_id)));

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, owner_id")
    .in("id", listingIds.length ? listingIds : ["00000000-0000-0000-0000-000000000000"]);

  // Extra safety
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
          title="Owner Requests"
          subtitle="Approve or reject rental requests for your listings."
        />
        <OwnerRentalsClient rentals={enriched} />
      </main>
    </>
  );
}
