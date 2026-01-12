import Header from "./Header";
import { createClient } from "@/lib/supabase/server";

type OwnerRequestRow = {
  id: string;
  listing_id: string;
  status: string | null;
  created_at: string;
};

type ListingRow = {
  id: string;
  owner_id: string;
};

export default async function ServerHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged out: no role, no pending badge
  if (!user) {
    return <Header role={undefined} pendingCount={0} />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "user";

  // ---------- Owner Requests pending count ----------
  let pendingCount = 0;

  try {
    // Step 1: get rentals visible for this user (RLS should already limit by listing owner)
    const { data: rentalsRaw, error: rentalsError } = await supabase
      .from("rentals")
      .select("id, listing_id, status, created_at")
      .order("created_at", { ascending: false });

    if (!rentalsError && rentalsRaw) {
      const rentals: OwnerRequestRow[] = rentalsRaw as OwnerRequestRow[];

      // Step 2: collect listing_ids and load listings with their owner_id
      const listingIds = Array.from(new Set(rentals.map((r) => r.listing_id)));

      const { data: listingsRaw, error: listingsError } = await supabase
        .from("listings")
        .select("id, owner_id")
        .in(
          "id",
          listingIds.length
            ? listingIds
            : ["00000000-0000-0000-0000-000000000000"]
        );

      if (!listingsError && listingsRaw) {
        const listings: ListingRow[] = listingsRaw as ListingRow[];

        // Step 3: ensure listing belongs to current owner
        const ownedListings = listings.filter((l) => l.owner_id === user.id);
        const listingMap = new Map(ownedListings.map((l) => [l.id, l]));

        const ownerRequests: OwnerRequestRow[] = rentals.filter((r) =>
          listingMap.has(r.listing_id)
        );

        // Step 4: statuses that mean "needs owner action"
        const ATTENTION_STATUSES = ["pending", "requested", "owner_pending"];

        pendingCount = ownerRequests.filter(
          (r) => r.status && ATTENTION_STATUSES.includes(r.status)
        ).length;
      }
    }
  } catch {
    // If anything fails, leave pendingCount = 0 (no badge)
  }
  // ---------------------------------------------------

  return <Header role={role} pendingCount={pendingCount} />;
}
