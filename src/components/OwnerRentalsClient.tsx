"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  approveRentalAndEmail,
  rejectRental,
} from "@/app/dashboard/owner-rentals/actions";
import FinalizeHourlyService from "@/components/FinalizeHourlyService";
import { createClient } from "@/lib/supabase/client";

type RentalRow = {
  id: string;
  listing_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  status: string;
  message?: string | null;
  created_at?: string | null;
  listing?: { id: string; title: string } | null;

  // Step 3.3 fields (from page.tsx select)
  hourly_is_estimate?: boolean | null;
  hourly_estimated_hours?: number | null;
  hourly_final_hours?: number | null;
  hourly_final_total?: number | null;
  hourly_finalized_at?: string | null;

  // operator snapshot (to decide whether to show finalize UI)
  operator_selected?: boolean | null;
  operator_rate_unit?: "day" | "hour" | string | null;
  operator_rate?: number | null;
  operator_hours?: number | null;
  operator_total?: number | null;
};

type ListingPhoto = {
  id: string;
  listing_id: string;
  path: string;
  sort_order: number | null;
  created_at?: string;
};

export default function OwnerRentalsClient({
  rentals,
}: {
  rentals: RentalRow[];
}) {
  const [isPending, startTransition] = useTransition();
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
      (arr as any[]).find((x) => x.is_primary === true) ??
      (arr as any[]).find((x) => x.is_primary === "true") ??
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

  // Preload thumbnails for all listing_ids in owner rentals
  useEffect(() => {
    (async () => {
      try {
        const ids = Array.from(
          new Set(
            (rentals ?? [])
              .map((r) => r.listing_id)
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

  async function onApprove(rentalId: string) {
    startTransition(async () => {
      const res = await approveRentalAndEmail(rentalId);
      if (!res.ok) {
        alert(res.error);
      } else if ("emailed" in res && !res.emailed && res.error) {
        alert(res.error);
      }
    });
  }

  async function onReject(rentalId: string) {
    startTransition(async () => {
      const res = await rejectRental(rentalId);
      if (!res.ok) {
        alert(res.error);
      }
    });
  }

  if (!rentals || rentals.length === 0) {
    return (
      <div className="mt-6 rounded-lg border bg-white p-6 text-slate-600">
        No rental requests yet.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {rentals.map((r) => {
        const isFinal = r.status === "approved" || r.status === "rejected";
        const isApproved = r.status === "approved";

        const showFinalize =
          r.status === "approved" &&
          Boolean(r.operator_selected) &&
          String(r.operator_rate_unit) === "hour" &&
          Boolean(r.hourly_is_estimate) &&
          !r.hourly_finalized_at;

        const thumb = getThumb(r.listing_id);

        return (
          <div key={r.id} className="rr-card grid gap-4 p-5">
            {/* TOP ROW: thumbnail + main info */}
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
                  <div className="text-lg font-semibold">
                    {r.listing?.title ?? "Listing"}
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    {r.start_date} → {r.end_date}
                  </div>

                  <div className="mt-1 text-sm">
                    <span className="font-medium">Status:</span>{" "}
                    <span className="capitalize">{r.status}</span>
                  </div>

                  {r.message ? (
                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">Message:</span>{" "}
                      {r.message}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* BUTTON ROW (bottom) */}
            <div className="mt-3 flex flex-wrap gap-3 border-t pt-3">
              {/* Invoice */}
              <a
                href={`/api/invoice?rental_id=${r.id}`}
                target="_blank"
                rel="noreferrer"
                className="rr-btn rr-btn-primary"
              >
                Invoice
              </a>

              {/* Approve – turns green after approved */}
              <button
                onClick={() => onApprove(r.id)}
                disabled={isPending || isFinal}
                className={`rr-btn rr-btn-primary ${
                  isApproved
                    ? "bg-emerald-600 border-emerald-700 hover:bg-emerald-700"
                    : ""
                }`}
              >
                {isApproved ? "Approved" : "Approve & Email"}
              </button>

              {/* Reject */}
              <button
                onClick={() => onReject(r.id)}
                disabled={isPending || isFinal}
                className="rr-btn rr-btn-danger"
              >
                Reject
              </button>

              {/* Inspection page link */}
              <a
                href={`/dashboard/owner-rentals/${encodeURIComponent(
                  r.id
                )}/inspection`}
                className="rr-btn rr-btn-secondary text-xs"
              >
                Record / view condition
              </a>
            </div>

            {/* Finalize hourly operator if needed */}
            {showFinalize ? (
              <div className="mt-4">
                <FinalizeHourlyService
                  rentalId={r.id}
                  defaultHours={Math.max(
                    1,
                    Number(r.hourly_estimated_hours ?? r.operator_hours ?? 1)
                  )}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
