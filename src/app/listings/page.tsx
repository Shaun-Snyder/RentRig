export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import ListingsClient from "@/components/ListingsClient";
import PageHeader from "@/components/PageHeader";

type ListingRow = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  price_per_day: number;
  created_at: string;
  category: string | null;
  license_required: boolean | null;
  license_type: string | null;
  // Other fields (delivery / operator / driver / hourly / deposit, etc.)
  // are still present at runtime via select("*") and used in ListingsClient via `any`.
};

type PhotoRow = {
  id: string;
  listing_id: string;
  path: string;
  sort_order: number | null;
  created_at: string;
};

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "trucks", label: "Trucks" },
  { key: "trailers", label: "Trailers" },
  { key: "vans_covered", label: "Vans / Covered" },
  { key: "lifts", label: "Lifts" },
  { key: "heavy_equipment", label: "Heavy Equipment" },
  { key: "agricultural", label: "Agricultural" },
  { key: "other", label: "Other" },
];

function photoUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/listing-photos/${path}`;
}

function catLabel(v: string) {
  const found = CATEGORIES.find((c) => c.key === v);
  return found ? found.label : v;
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  const supabase = await createClient();

  // --- AUTH (login required, but NO profile gate here) ---
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  // --- END AUTH ---

  const selected = (searchParams?.category || "").toString().trim();
  const selectedIsValid = CATEGORIES.some((c) => c.key === selected);

  const q = (searchParams?.q || "").toString().trim();

  // IMPORTANT: select("*") so driver/operator/delivery/hourly fields
  // are available to ListingsClient cards.
  let query = supabase
    .from("listings")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (selectedIsValid) {
    query = query.eq("category", selected);
  }

  if (q) {
    // Search across title, description, city, and state
    // PostgREST OR syntax: field.ilike.%value%
    const safe = q.replace(/,/g, " "); // avoid comma issues
    query = query.or(
      `title.ilike.%${safe}%,description.ilike.%${safe}%,city.ilike.%${safe}%,state.ilike.%${safe}%`
    );
  }

  const { data: listings, error } = await query;

  if (error) {
    return (
      <>
        <ServerHeader />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <PageHeader
            title="Browse Listings"
            subtitle="Something went wrong loading listings."
          />
          <p className="mt-4 text-sm text-red-600">Load failed: {error.message}</p>
        </main>
      </>
    );
  }

  const listingList = (listings ?? []) as ListingRow[];
  const listingIds = listingList.map((l) => l.id);

  // Fetch first photo per listing for thumbnails
  let photos: PhotoRow[] = [];
  if (listingIds.length > 0) {
    const { data: photoRows } = await supabase
      .from("listing_photos")
      .select("id, listing_id, path, sort_order, created_at")
      .in("listing_id", listingIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    photos = (photoRows ?? []) as PhotoRow[];
  }

  const firstPhotoByListing = new Map<string, PhotoRow>();
  for (const p of photos) {
    if (!firstPhotoByListing.has(p.listing_id)) {
      firstPhotoByListing.set(p.listing_id, p);
    }
  }

  // Add thumb_url for ListingsClient cards
  const listingListForClient = listingList.map((l) => {
    const photo = firstPhotoByListing.get(l.id);
    const thumb_url = photo?.path ? photoUrl(photo.path) : "";
    return { ...l, thumb_url };
  });

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
  <div>
    <PageHeader
      title="Browse Listings"
      subtitle={
        selectedIsValid
          ? `Showing: ${catLabel(selected)}`
          : "Showing: All categories"
      }
    />
  </div>
</div>


        <div className="mt-8">
          <ListingsClient listings={listingListForClient as any} initialQ={q} />
        </div>
      </main>
    </>
  );
}
