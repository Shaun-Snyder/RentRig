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
    return <Header role={undefined} pendingCount={0} unreadMessageCount={0} />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "user";

  // ---------- Owner Requests pending count ----------
  let pendingCount = 0;
  let unreadMessageCount = 0;
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
  // ---------- Messages unread count ----------
  try {
    const { data: ownedListings } = await supabase
      .from("listings")
      .select("id")
      .eq("owner_id", user.id);

    const ownedListingIds = (ownedListings ?? []).map((l) => l.id);

    const { data: renterRentals } = await supabase
      .from("rentals")
      .select("id, listing_id, renter_id, created_at")
      .eq("renter_id", user.id);

    const { data: ownerRentals } = ownedListingIds.length
      ? await supabase
          .from("rentals")
          .select("id, listing_id, renter_id, created_at")
          .in("listing_id", ownedListingIds)
      : { data: [] };

    const rentalMap = new Map<string, any>();

    for (const r of [...(renterRentals ?? []), ...(ownerRentals ?? [])]) {
      if (r?.id) rentalMap.set(r.id, r);
    }

    const messageRentalIds = Array.from(rentalMap.keys());

    if (messageRentalIds.length > 0) {
      const latestMessageByRental = new Map<
        string,
        { created_at: string; sender_id: string }
      >();

      const { data: msgRows } = await supabase
        .from("rental_messages")
        .select("rental_id, created_at, sender_id")
        .in("rental_id", messageRentalIds)
        .order("created_at", { ascending: false });

      for (const m of msgRows ?? []) {
        if (!latestMessageByRental.has(m.rental_id)) {
          latestMessageByRental.set(m.rental_id, {
            created_at: m.created_at ?? "",
            sender_id: m.sender_id ?? "",
          });
        }
      }

      const lastReadByRental = new Map<string, string>();

      const { data: readRows } = await supabase
        .from("rental_message_reads")
        .select("rental_id, last_read_at")
        .in("rental_id", messageRentalIds)
        .eq("user_id", user.id);

      for (const r of readRows ?? []) {
        if (r?.rental_id) {
          lastReadByRental.set(r.rental_id, r.last_read_at ?? "");
        }
      }

      unreadMessageCount = messageRentalIds.filter((rentalId) => {
        const latest = latestMessageByRental.get(rentalId);
        const lastReadAt = lastReadByRental.get(rentalId) ?? "";

        return (
          !!latest?.created_at &&
          latest.sender_id !== user.id &&
          (!lastReadAt || new Date(latest.created_at) > new Date(lastReadAt))
        );
      }).length;
    }
  } catch {
    // If anything fails, leave unreadMessageCount = 0
  }
  // ------------------------------------------
  // ---------------------------------------------------

  return (
  <Header
    role={role}
    pendingCount={pendingCount}
    unreadMessageCount={unreadMessageCount}
  />
);
}
