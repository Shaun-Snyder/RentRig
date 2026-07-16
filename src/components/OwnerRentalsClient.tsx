"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  approveRentalAndEmail,
  rejectRental,
  markRentalCompleted,
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
  renter_returned?: boolean | null;
  message?: string | null;
  created_at?: string | null;

  delivery_selected?: boolean | null;
  delivery_fee?: number | null;

  owner_discount_amount?: number | null;
  owner_discount_note?: string | null;

  deposit_status?: string | null;
  deposit_refund_amount?: number | null;

  listing?: {
    id: string;
    title: string;
    security_deposit?: number | null;
  } | null;
  renter?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    company_name?: string | null;
  } | null;
  renter_rating?: {
    avg: string | null;
    count: number;
  } | null;

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

  // unified service snapshot
  service_choice?: string | null;
  service_unit?: "day" | "hour" | string | null;
  service_rate?: number | null;
  service_days?: number | null;
  service_hours?: number | null;
  service_total?: number | null;
};

type ListingPhoto = {
  id: string;
  listing_id: string;
  path: string;
  sort_order: number | null;
  created_at?: string;
};

function money(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function serviceLabel(choice?: string | null) {
  if (choice === "operator") return "Operator";
  if (choice === "driver") return "Driver";
  if (choice === "driver_labor") return "Driver + Labor";
  return "None";
}

export default function OwnerRentalsClient({
  rentals,
}: {
  rentals: RentalRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const [photosByListing, setPhotosByListing] = useState<
    Record<string, ListingPhoto[]>
  >({});

  function storageUrl(path: string) {
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
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
              .filter((id): id is string => Boolean(id)),
          ),
        );
        if (!ids.length) return;

        const obj: Record<string, ListingPhoto[]> = {};
        await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(
              `/api/listing-photos?listing_id=${encodeURIComponent(id)}`,
              { cache: "no-store" },
            );
            const j = await res.json().catch(() => ({}));
            if (res.ok) {
              obj[id] = (j.photos ?? []) as ListingPhoto[];
            }
          }),
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
        return;
      }

      if ("emailed" in res && !res.emailed && res.error) {
        alert(res.error);
      }

      router.refresh();
    });
  }

  async function onReject(rentalId: string) {
    startTransition(async () => {
      const res = await rejectRental(rentalId);
      if (!res.ok) {
        alert(res.error);
        return;
      }

      router.refresh();
    });
  }

  async function onComplete(rentalId: string) {
    startTransition(async () => {
      const res = await markRentalCompleted(rentalId);
      if (!res.ok) {
        alert(res.error);
        return;
      }

      router.refresh();
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
        const isRejected = r.status === "rejected";
        const isApproved = r.status === "approved";
        const isNewRequest =
          r.created_at &&
          Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000;
        const showFinalize =
          r.status === "approved" &&
          Boolean(r.operator_selected) &&
          String(r.operator_rate_unit) === "hour" &&
          Boolean(r.hourly_is_estimate) &&
          !r.hourly_finalized_at;

        const thumb = getThumb(r.listing_id);
        const renterName = r.renter?.full_name?.trim() || "Renter";
        const renterAvatar = r.renter?.avatar_url ?? "";
        const renterCompany = r.renter?.company_name?.trim() || "";
        const renterRatingAvg = r.renter_rating?.avg ?? null;
        const renterRatingCount = r.renter_rating?.count ?? 0;

        return (
          <div
            key={r.id}
            className="rr-card border border-slate-300 rounded-none p-3 shadow-sm bg-white"
          >
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="w-32 md:w-40 aspect-[16/9] object-cover border border-slate-300 rounded-none"
                  />
                ) : (
                  <div className="w-32 md:w-40 aspect-[16/9] border border-dashed border-slate-300 bg-slate-50 grid place-items-center text-xs text-slate-500 rounded-none">
                    No photo
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {isNewRequest && (
                  <div className="mb-1 inline-flex w-fit items-center border border-amber-700 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 shadow-sm">
                    New Request
                  </div>
                )}
                <div className="text-lg font-extrabold text-slate-900">
                  {r.listing?.title ?? "Listing"}
                </div>

                <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <span className="font-semibold">Dates:</span> {r.start_date}{" "}
                    → {r.end_date}
                  </div>
                  <div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center border border-slate-400 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                        Deposit: {money(r.listing?.security_deposit)}
                      </span>

                      {r.service_choice && r.service_choice !== "none" ? (
                        <span className="inline-flex items-center border border-blue-700 bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                          {serviceLabel(r.service_choice)} requested
                        </span>
                      ) : null}

                      {r.delivery_selected ? (
                        <span className="inline-flex items-center border border-violet-700 bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-800">
                          Delivery: {money(r.delivery_fee)}
                        </span>
                      ) : null}

                      {r.message?.trim() ? (
                        <span className="inline-flex items-center border border-amber-700 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                          Message included
                        </span>
                      ) : null}

                      {Number(r.owner_discount_amount ?? 0) > 0 ? (
                        <span className="inline-flex items-center border border-emerald-700 bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                          Discount: -{money(r.owner_discount_amount)}
                        </span>
                      ) : null}
                    </div>
                    <span className="font-semibold">Requested:</span>{" "}
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : "Unknown"}
                  </div>
                  <div>
                    <span className="font-semibold">Status:</span>{" "}
                    <span
                      className={`
      inline-flex items-center
      rounded-full border
      px-2 py-0.5
      text-xs font-semibold uppercase
      shadow-sm
      ${
        r.status === "approved"
          ? "border-emerald-700 bg-emerald-100 text-emerald-800"
          : r.status === "rejected"
            ? "border-red-700 bg-red-100 text-red-800"
            : r.status === "completed"
              ? "border-blue-700 bg-blue-100 text-blue-800"
              : "border-amber-700 bg-amber-100 text-amber-800"
      }
    `}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold">Renter:</span>{" "}
                    <a
                      href={`/profile/${encodeURIComponent(r.renter_id)}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {renterName}
                    </a>
                    {renterCompany ? <span> — {renterCompany}</span> : null}
                  </div>

                  <div>
                    <span className="font-semibold">Return:</span>{" "}
                    <span
                      className={`
      inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm
      ${
        r.renter_returned
          ? "border-emerald-700 bg-emerald-100 text-emerald-800"
          : "border-amber-700 bg-amber-100 text-amber-800"
      }
    `}
                    >
                      {r.renter_returned ? "Returned" : "Waiting"}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold">Rating:</span>{" "}
                    <span className="inline-flex items-center rounded-full border border-slate-400 bg-white px-2 py-0.5 text-xs font-semibold shadow-sm">
                      {renterRatingAvg
                        ? `★ ${renterRatingAvg} (${renterRatingCount})`
                        : "No reviews"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {r.message && (
              <div className="mt-3 border-t pt-3 text-sm text-slate-700">
                <span className="font-semibold">Message:</span> {r.message}
              </div>
            )}

            {r.service_choice && r.service_choice !== "none" ? (
              <div className="mt-3 border-t pt-3 text-sm text-slate-700">
                <div>
                  <span className="font-semibold">Service:</span>{" "}
                  {serviceLabel(r.service_choice)}
                </div>

                <div>
                  <span className="font-semibold">Rate:</span>{" "}
                  {money(r.service_rate)} / {r.service_unit ?? "day"}
                </div>

                <div>
                  <span className="font-semibold">
                    {r.service_unit === "hour" ? "Hours:" : "Days:"}
                  </span>{" "}
                  {r.service_unit === "hour"
                    ? (r.service_hours ?? 0)
                    : (r.service_days ?? 0)}
                </div>

                <div>
                  <span className="font-semibold">Service total:</span>{" "}
                  {money(r.service_total)}
                  {r.hourly_is_estimate && !r.hourly_finalized_at ? (
                    <span className="text-amber-600 font-semibold ml-1">
                      (Estimate – needs finalize)
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              <Link
                href={`/dashboard/owner-rentals/${encodeURIComponent(r.id)}`}
                className="rr-btn rr-btn-secondary"
              >
                View Rental
              </Link>

              <a
                href={`/profile/${encodeURIComponent(r.renter_id)}`}
                className="rr-btn rr-btn-secondary"
              >
                View Profile
              </a>

              <a
                href={`/api/invoice?rental_id=${r.id}`}
                target="_blank"
                rel="noreferrer"
                className="rr-btn rr-btn-secondary"
              >
                Invoice
              </a>

              <a
                href={`/dashboard/owner-rentals/${encodeURIComponent(r.id)}/inspection`}
                className="rr-btn rr-btn-secondary"
              >
                Record / view condition
              </a>

              <button
                onClick={() => onApprove(r.id)}
                disabled={isPending || isApproved || isRejected}
                className={`rr-btn rr-btn-primary ${
                  isApproved
                    ? "bg-emerald-600 border-emerald-700 hover:bg-emerald-700"
                    : ""
                }`}
              >
                {isApproved ? "Approved" : "Approve & Email"}
              </button>

              <button
                onClick={() => onComplete(r.id)}
                disabled={
                  isPending || r.status !== "approved" || !r.renter_returned
                }
                className="rr-btn rr-btn-secondary"
              >
                {r.renter_returned ? "Complete" : "Waiting on Return"}
              </button>

              {!isApproved && !isRejected ? (
                <button
                  onClick={() => onReject(r.id)}
                  disabled={isPending}
                  className="rr-btn rr-btn-danger"
                >
                  Reject
                </button>
              ) : null}
            </div>

            {showFinalize ? (
              <div className="mt-4 border-t pt-3">
                <FinalizeHourlyService
                  rentalId={r.id}
                  defaultHours={Math.max(
                    1,
                    Number(r.hourly_estimated_hours ?? r.operator_hours ?? 1),
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
