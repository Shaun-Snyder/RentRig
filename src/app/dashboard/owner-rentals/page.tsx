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

        // Step 3.3 fields (hourly estimate -> finalize)
        "hourly_is_estimate",
        "hourly_estimated_hours",
        "hourly_final_hours",
        "hourly_final_total",
        "hourly_finalized_at",

        // Operator snapshot (needed for finalize UI + display)
        "operator_selected",
        "operator_rate_unit",
        "operator_rate",
        "operator_hours",
        "operator_total",

        // Inspections + photos nested under each rental
        "inspections:rental_inspections(id, role, phase, odometer, hours_used, fuel_percent, notes, created_at, photos:rental_inspection_photos(id, url))",
      ].join(", ")
    )
    .order("created_at", { ascending: false });

  if (rentalsError) {
    console.error("OwnerRentalsPage rentalsError:", rentalsError);
  }

  const rentalsRaw = rentals ?? [];

  // Distinct listing IDs from these rentals
  const listingIds = Array.from(
    new Set(rentalsRaw.map((r: any) => r.listing_id).filter(Boolean))
  );

  // Load listing records
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, owner_id")
    .in(
      "id",
      listingIds.length
        ? listingIds
        : ["00000000-0000-0000-0000-000000000000"]
    );

  if (listingsError) {
    console.error("OwnerRentalsPage listingsError:", listingsError.message);
  }

  // Keep only listings owned by this user
  const ownedListings = (listings ?? []).filter((l) => l.owner_id === user.id);
  const ownedListingIds = ownedListings.map((l) => l.id);

  // ---------- Build thumbnails per owned listing ----------
  const thumbPathByListingId: Record<string, string> = {};

  if (ownedListingIds.length > 0) {
    const { data: photos, error: photosError } = await supabase
      .from("listing_photos")
      .select("listing_id, path, sort_order, created_at")
      .in(
        "listing_id",
        ownedListingIds.length
          ? ownedListingIds
          : ["00000000-0000-0000-0000-000000000000"]
      );

    if (photosError) {
      console.error("OwnerRentalsPage photosError:", photosError.message);
    }

    if (photos && photos.length > 0) {
      type PhotoRow = {
        listing_id: string;
        path: string;
        sort_order: number | null;
        created_at: string | null;
      };

      const bestByListing = new Map<string, PhotoRow>();

      for (const p of photos as any[]) {
        const key = p.listing_id as string;
        const existing = bestByListing.get(key);
        const currentSort = (p.sort_order as number | null) ?? 9999;

        if (!existing) {
          bestByListing.set(key, {
            listing_id: key,
            path: p.path as string,
            sort_order: p.sort_order ?? null,
            created_at: (p.created_at as string) ?? null,
          });
        } else {
          const existingSort = (existing.sort_order as number | null) ?? 9999;
          if (currentSort < existingSort) {
            bestByListing.set(key, {
              listing_id: key,
              path: p.path as string,
              sort_order: p.sort_order ?? null,
              created_at: (p.created_at as string) ?? null,
            });
          }
        }
      }

      const storage = supabase.storage.from("listing-photos");
      for (const [listingId, info] of bestByListing.entries()) {
        const { data: pub } = storage.getPublicUrl(info.path);
        thumbPathByListingId[listingId] = pub.publicUrl;
      }
    }
  }

  // Attach thumb_url to owned listings
  const ownedListingsWithThumb = ownedListings.map((l: any) => {
    const thumb_url = thumbPathByListingId[l.id] ?? null;
    return { ...l, thumb_url };
  });

  const listingMap = new Map(
    ownedListingsWithThumb.map((l: any) => [l.id, l])
  );

  // Final enriched rentals: only those whose listing is owned by this user
  const enriched = rentalsRaw
    .filter((r: any) => listingMap.has(r.listing_id))
    .map((r: any) => ({
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

        <div className="mt-2 mb-4 flex justify-end">
          <a
            href="/dashboard/owner-rentals/history"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            View past rentals →
          </a>
        </div>

        <OwnerRentalsClient rentals={enriched as any} />
      </main>
    </>
  );
}
