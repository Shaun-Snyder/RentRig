

"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Rental = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  buffer_days: number | null;
  message: string | null;
  created_at: string;
  listing: {
    id: string;
    title: string;
  } | null;
};

type ListingPhoto = {
  id: string;
  listing_id: string;
  path: string;
  sort_order: number | null;
  created_at?: string;
};

export default function RenterRentalsClient({ rentals }: { rentals: Rental[] }) {
  const supabase = createClient();

  const [photosByListing, setPhotosByListing] = useState<
    Record<string, ListingPhoto[]>
  >({});

  function storageUrl(path: string) {
    const { data } = supabase.storage
      .from("listing-photos")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  function getThumb(listingId: string | undefined | null): string | null {
    if (!listingId) return null;
    const arr = photosByListing[listingId];
    if (!arr || arr.length === 0) return null;

    const p =
      arr.find((x: any) => x.is_primary === true) ??
      arr.find((x: any) => x.is_primary === "true") ??
      arr[0];

    const path =
      (p as any)?.path ??
      (p as any)?.storage_path ??
      (p as any)?.file_path ??
      (p as any)?.photo_path ??
      null;

    if (!path) return null;
    return storageUrl(path);
  }

  // Preload thumbnails for all listings in these rentals
  useEffect(() => {
    (async () => {
      try {
        const ids = Array.from(
          new Set(
            (rentals ?? [])
              .map((r) => r.listing?.id)
              .filter((id): id is string => Boolean(id))
          )
        );
        if (!ids.length) return;

        const obj: Record<string, ListingPhoto[]> = {};
        await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(
              `/api/listing-photos?listing_id=${encodeURIComponent(id)}`,
              { cache: "no-store" }
            );
            const j = await res.json().catch(() => ({}));
            if (res.ok) {
              obj[id] = (j.photos ?? []) as ListingPhoto[];
            }
          })
        );
        setPhotosByListing((prev) => ({ ...prev, ...obj }));
      } catch {
        // ignore
      }
    })();
  }, [rentals]);

  if (!rentals || rentals.length === 0) {
    return <p className="text-slate-600">You have no rental requests yet.</p>;
  }

  return (
    <div className="mt-6 space-y-4">
      {rentals.map((r) => {
        const thumb = getThumb(r.listing?.id);

        return (
          <div key={r.id} className="rr-card grid gap-4 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* LEFT: Thumbnail + info */}
              <div className="flex gap-4">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-black/60 bg-slate-50 shadow-sm">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                      Photo
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-semibold">
                    {r.listing?.title ?? "Listing"}
                  </div>

                  <div className="text-sm text-slate-600">
                    {r.start_date} → {r.end_date}
                  </div>

                  {/* BUBBLES: black outline + shadow */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className="
                        inline-flex items-center
                        rounded-full border border-black
                        bg-white
                        px-3 py-1
                        text-xs font-semibold uppercase
                        shadow-sm
                      "
                    >
                      {r.status}
                    </span>

                    {typeof r.buffer_days === "number" && (
                      <span
                        className="
                          inline-flex items-center
                          rounded-full border border-black
                          bg-white
                          px-3 py-1
                          text-xs
                          shadow-sm
                        "
                      >
                        Buffer: {r.buffer_days}d
                      </span>
                    )}
                  </div>

                  {r.message && (
                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">Your message:</span>{" "}
                      {r.message}
                    </div>
                  )}
                </div>
              </div>

              {/* BUTTON ROW (moved to bottom) */}
<div className="mt-3 flex flex-wrap gap-3 border-t pt-3">
  <a
    href={`/api/invoice?rental_id=${encodeURIComponent(r.id)}`}
    target="_blank"
    rel="noreferrer"
    className="rr-btn rr-btn-primary"
  >
    Download invoice
  </a>

  <a
    href={`/dashboard/rentals/${encodeURIComponent(r.id)}/inspection`}
    className="rr-btn rr-btn-secondary text-xs"
  >
    Record / view condition
  </a>
</div>

            </div>
          </div>
        );
      })}
    </div>
  );
}
