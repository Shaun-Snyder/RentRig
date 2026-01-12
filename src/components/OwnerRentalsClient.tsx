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
  <div
    key={r.id}
    className="
      rr-card
      border border-slate-300
      rounded-none
      px-4 py-4
      grid gap-3
      shadow-[0_18px_40px_rgba(15,23,42,0.18)]
      bg-white
    "
  >
    {/* TOP ROW: big thumbnail + summary + actions */}
    <div className="flex items-start justify-between gap-4">
      {/* LEFT: Large thumbnail and main text */}
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {thumb ? (
            <img
              src={thumb}
              alt=""
              className="
                w-40 md:w-56
                aspect-[16/9]
                object-cover
                border border-slate-300
                rounded-none
              "
            />
          ) : (
            <div
              className="
                w-40 md:w-56
                aspect-[16/9]
                border border-dashed border-slate-300
                bg-slate-50
                grid place-items-center
                text-xs text-slate-500
                rounded-none
              "
            >
              No photo
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-2xl md:text-xl font-extrabold text-slate-900">
            {r.listing?.title ?? "Listing"}
          </div>

          <div className="text-sm text-slate-700">
            <span className="font-semibold">Dates:</span>{" "}
            <span className="font-medium">
              {r.start_date} → {r.end_date}
            </span>
          </div>

          <div className="text-sm text-slate-700">
            <span className="font-semibold">Status:</span>{" "}
            <span className="capitalize">{r.status}</span>
          </div>

          {r.message && (
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Message:</span>{" "}
              {r.message}
            </div>
          )}

          {/* Optional quick hourly/operator info so it feels like the listings summary rows */}
          {r.operator_selected && (
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Operator:</span>{" "}
              {r.operator_rate != null
                ? `${r.operator_rate} / ${r.operator_rate_unit ?? "hour"}`
                : "Selected"}
              {r.hourly_is_estimate && !r.hourly_finalized_at ? (
                <span className="text-amber-600 font-semibold ml-1">
                  (Estimate – needs finalize)
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: button stack aligns like My Listings actions */}
      <div className="flex flex-col items-end gap-2">
       <div className="flex flex-wrap justify-end gap-2">
  {/* Invoice – secondary button style */}
  <a
    href={`/api/invoice?rental_id=${r.id}`}
    target="_blank"
    rel="noreferrer"
    className="rr-btn rr-btn-secondary"
  >
    Invoice
  </a>

  {/* Approve – same base as listings, with green override when approved */}
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

  {/* Reject – same danger style as Delete on listings */}
  <button
    onClick={() => onReject(r.id)}
    disabled={isPending || isFinal}
    className="rr-btn rr-btn-danger"
  >
    Reject
  </button>
</div>

<a
  href={`/dashboard/owner-rentals/${encodeURIComponent(r.id)}/inspection`}
  className="rr-btn rr-btn-secondary"
>
  Record / view condition
</a>

      </div>
    </div>

    {/* Finalize hourly operator if needed (unchanged logic) */}
    {showFinalize ? (
      <div className="mt-4 border-t pt-3">
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
