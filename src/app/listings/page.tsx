export const dynamic = "force-dynamic";

import Link from "next/link";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import ListingsClient from "@/components/ListingsClient";

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

  const selected = (searchParams?.category || "").toString().trim();
  const selectedIsValid = CATEGORIES.some((c) => c.key === selected);

  const q = (searchParams?.q || "").toString().trim();

  let query = supabase
    .from("listings")
    .select(
      "id, title, description, city, state, price_per_day, created_at, category, license_required, license_type"
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (selectedIsValid) {
    query = query.eq("category", selected);
  }

  if (q) {
    // Keep it simple for now: title match. (zip comes next step)
    query = query.ilike("title", `%${q}%`);
  }

  const { data: listings, error } = await query;

  if (error) {
    return (
      <>
        <ServerHeader />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="text-3xl font-semibold">Browse Listings</h1>
          <p className="mt-4 text-red-600">Load failed: {error.message}</p>
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
    if (!firstPhotoByListing.has(p.listing_id)) firstPhotoByListing.set(p.listing_id, p);
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
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">Browse Listings</h1>
            <p className="mt-2 text-slate-600">
              {selectedIsValid ? `Showing: ${catLabel(selected)}` : "Showing: All categories"}
            </p>
          </div>

          {/* Small server-side search box (keeps URL params). Sliders + availability UI stays in ListingsClient */}
          <form action="/listings" method="get" className="flex flex-wrap items-center gap-2">
            {selectedIsValid ? <input type="hidden" name="category" value={selected} /> : null}

            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name (zip next)..."
              className="w-full max-w-md rounded-lg border px-3 py-2"
            />

            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-white">
              Search
            </button>

            {q ? (
              <a
                href={selectedIsValid ? `/listings?category=${selected}` : "/listings"}
                className="rounded-lg border px-4 py-2"
              >
                Clear
              </a>
            ) : null}
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/listings"
            className={`rounded-full border px-4 py-2 text-sm ${
              !selectedIsValid
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white hover:bg-slate-50"
            }`}
          >
            All
          </Link>

          {CATEGORIES.map((c) => {
            const active = selected === c.key;
            return (
              <Link
                key={c.key}
                href={`/listings?category=${c.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`rounded-full border px-4 py-2 text-sm ${
                  active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          <ListingsClient listings={listingListForClient as any} />
        </div>
      </main>
    </>
  );
}
