
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import RenterRentalsClient from "@/components/RenterRentalsClient";
import PageHeader from "@/components/PageHeader";

export default async function MyRentalsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) redirect("/login");
  const user = data.user;

  // Load rentals for this renter
      const { data: rentals, error: rentalsError } = await supabase
    .from("rentals")
    .select(
      `
            id,
      start_date,
      end_date,
      status,
      renter_returned,
      renter_rejection_acknowledged,
      buffer_days,
      message,
      created_at,
      inspections:rental_inspections!left(id, role),
      listing:listings ( id, title )
    `
    )
    .eq("renter_id", user.id)
    .eq("renter_returned", false)
    .order("created_at", { ascending: false });

  if (rentalsError) {
    console.error("MyRentalsPage rentalsError:", rentalsError);
  }

  const rentalsRaw = rentals ?? [];

  // ---------- Build thumbnails per listing ----------
  // Collect listing IDs used in these rentals
  const listingIds = Array.from(
    new Set(
      rentalsRaw
        .map((r: any) => r.listing?.id)
        .filter((id: string | undefined): id is string => Boolean(id))
    )
  );

  const thumbPathByListingId: Record<string, string> = {};

  if (listingIds.length > 0) {
    const { data: photos, error: photosError } = await supabase
      .from("listing_photos")
      .select("listing_id, path, sort_order, created_at")
      .in("listing_id", listingIds);

    if (photosError) {
      console.error("MyRentalsPage photosError:", photosError.message);
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

  // Enrich rentals with listing.thumb_url for the client component
      const rentalsWithThumb = rentalsRaw
    .filter((r: any) => !(r.status === "rejected" && r.renter_rejection_acknowledged))
    .map((r: any) => {
    const listingId = r.listing?.id as string | undefined;
    const thumb_url =
      listingId && thumbPathByListingId[listingId]
        ? thumbPathByListingId[listingId]
        : null;

    const renter_condition_recorded = Array.isArray(r.inspections)
      ? r.inspections.some((ins: any) => ins.role === "renter")
      : false;

    return {
      ...r,
      renter_condition_recorded,
      listing: r.listing
        ? {
            ...r.listing,
            thumb_url,
          }
        : null,
    };
  });
  // --------------------------------------------------

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="rr-card p-4 mb-4">
  <PageHeader
    title="My Rentals"
    subtitle="Your rental requests and their status."
  />
</div>

        <div className="mt-2 mb-4 flex justify-end">
          <a
            href="/dashboard/rentals/history"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            View past rentals →
          </a>
        </div>

        <RenterRentalsClient rentals={rentalsWithThumb as any} />
      </main>
    </>
  );
}
