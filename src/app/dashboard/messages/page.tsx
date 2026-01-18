export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import ThreadsListClient from "@/components/ThreadsListClient";

type RentalRow = {
  id: string;
  listing_id: string;
  renter_id: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  created_at: string;
};

type ListingRow = {
  id: string;
  title: string;
  owner_id: string;
};

type PhotoRow = {
  listing_id: string;
  path: string;
  sort_order: number | null;
  created_at: string;
};

function photoUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/listing-photos/${path}`;
}

export default async function DashboardMessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  /* -------------------------------------------------------
     1) Determine which rentals this user is involved in
     ------------------------------------------------------- */

  // Listings owned by this user
  const { data: ownedListings } = await supabase
    .from("listings")
    .select("id")
    .eq("owner_id", user.id);

  const ownedListingIds = (ownedListings ?? []).map((l) => l.id);

  // Rentals where user is renter
  const { data: renterRentals } = await supabase
    .from("rentals")
    .select("id, listing_id, renter_id, start_date, end_date, status, created_at")
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });

  // Rentals where user is owner
  const { data: ownerRentals } = ownedListingIds.length
    ? await supabase
        .from("rentals")
        .select("id, listing_id, renter_id, start_date, end_date, status, created_at")
        .in("listing_id", ownedListingIds)
        .order("created_at", { ascending: false })
    : { data: [] as RentalRow[] };

  // Merge + de-dupe
  const rentalMap = new Map<string, RentalRow>();
  for (const r of [...(renterRentals ?? []), ...(ownerRentals ?? [])]) {
    if (r?.id) rentalMap.set(r.id, r);
  }

  const rentals = Array.from(rentalMap.values());

  if (rentals.length === 0) {
    return (
      <div>
        <ServerHeader />
        <div style={{ padding: 24 }}>
          <PageHeader title="Messages" subtitle="No conversations yet." />
          <div className="rr-card mt-6 p-6 text-slate-600">
            No message threads yet. Messages appear after a rental request exists.
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     2) Load latest message per rental (PREVIEW)
     ------------------------------------------------------- */

  const rentalIds = rentals.map((r) => r.id);

  const latestMessageByRental = new Map<
    string,
    { body: string; created_at: string }
  >();

  const { data: msgRows } = await supabase
    .from("rental_messages")
    .select("rental_id, body, created_at")
    .in("rental_id", rentalIds)
    .order("created_at", { ascending: false });

  for (const m of msgRows ?? []) {
    if (!latestMessageByRental.has(m.rental_id)) {
      latestMessageByRental.set(m.rental_id, {
        body: m.body ?? "",
        created_at: m.created_at ?? "",
      });
    }
  }

  /* -------------------------------------------------------
     3) Load listings + thumbnails
     ------------------------------------------------------- */

  const listingIds = Array.from(new Set(rentals.map((r) => r.listing_id)));

  const listingMap = new Map<string, ListingRow>();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, owner_id")
    .in("id", listingIds);

  for (const l of listings ?? []) {
    listingMap.set(l.id, l);
  }

  const thumbMap = new Map<string, string>();

  const { data: photos } = await supabase
    .from("listing_photos")
    .select("listing_id, path, sort_order, created_at")
    .in("listing_id", listingIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const firstPhotoByListing = new Map<string, PhotoRow>();

  for (const p of photos ?? []) {
    if (!firstPhotoByListing.has(p.listing_id)) {
      firstPhotoByListing.set(p.listing_id, p);
    }
  }

  for (const [listingId, photo] of firstPhotoByListing.entries()) {
    if (photo?.path) thumbMap.set(listingId, photoUrl(photo.path));
  }

  /* -------------------------------------------------------
     4) FINAL SHAPE — SINGLE SOURCE OF TRUTH
     ------------------------------------------------------- */

  const threads = rentals.map((r) => {
    const listing = listingMap.get(r.listing_id);
    const latest = latestMessageByRental.get(r.id);

    return {
      ...r,
      listing: listing
        ? {
            id: listing.id,
            title: listing.title,
            owner_id: listing.owner_id,
            thumb_url: thumbMap.get(listing.id) ?? "",
          }
        : null,
      latest_message_body: latest?.body ?? "",
      latest_message_at: latest?.created_at ?? "",
    };
  });

  return (
    <div>
      <ServerHeader />

      <div style={{ padding: 24 }}>
        <PageHeader
          title="Messages"
          subtitle="Select a rental to open the conversation."
        />

        <div className="mt-6">
          <ThreadsListClient rentals={threads as any} />
        </div>
      </div>
    </div>
  );
}
