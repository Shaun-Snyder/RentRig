export const dynamic = "force-dynamic";

import Link from "next/link";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";

type ListingRow = {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  price_per_day: number;
  category: string;
  license_required: boolean;
  license_type: string | null;
};

type PhotoRow = {
  id: string;
  listing_id: string;
  path: string;
  sort_order: number;
  created_at: string;
};

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "heavy_equipment", label: "Heavy Equipment" },
  { key: "lifts", label: "Lifts" },
  { key: "trailers", label: "Trailers" },
  { key: "vans_covered", label: "Vans / Covered" },
  { key: "trucks", label: "Trucks" },
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
  searchParams: { category?: string };
}) {
  const supabase = await createClient();

  const selected = (searchParams?.category || "").trim();
  const selectedIsValid = CATEGORIES.some((c) => c.key === selected);

  let query = supabase
    .from("listings")
    .select("id, title, city, state, price_per_day, category, license_required, license_type")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (selectedIsValid) {
    query = query.eq("category", selected);
  }

  const { data: listings } = await query;

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

          <div className="flex flex-wrap gap-2">
            <Link
              href="/listings"
              className={`rounded-full border px-4 py-2 text-sm ${
                !selectedIsValid ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
              }`}
            >
              All
            </Link>

            {CATEGORIES.map((c) => {
              const active = selected === c.key;
              return (
                <Link
                  key={c.key}
                  href={`/listings?category=${c.key}`}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listingList.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-slate-600">
              No published listings yet{selectedIsValid ? " in this category." : "."}
            </div>
          ) : (
            listingList.map((l) => {
              const photo = firstPhotoByListing.get(l.id);
              const thumb = photo?.path ? photoUrl(photo.path) : "";

              return (
                <Link
                  key={l.id}
                  href={`/listings/${l.id}`}
                  className="rounded-xl border bg-white p-4 shadow-sm hover:shadow transition grid gap-3"
                >
                  <div className="h-44 w-full rounded-lg border bg-slate-50 overflow-hidden">
                    {thumb ? (
                      <img src={thumb} alt="Listing thumbnail" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-sm text-slate-400">
                        No photo
                      </div>
                    )}
                  </div>

                  <div className="grid gap-1">
                    <div className="font-semibold text-lg">{l.title}</div>
                    <div className="text-sm text-slate-600">
                      ${Number(l.price_per_day).toFixed(2)}/day
                      {l.city || l.state ? ` • ${[l.city, l.state].filter(Boolean).join(", ")}` : ""}
                    </div>

                    <div className="text-xs text-slate-500">Category: {catLabel(l.category)}</div>

                    {l.license_required ? (
                      <div className="text-xs text-amber-700">
                        License required{l.license_type ? `: ${l.license_type}` : ""}
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
