"use client";

import React, { useTransition } from "react";
import { approveRentalAndEmail, rejectRental } from "@/app/dashboard/owner-rentals/actions";
import FinalizeHourlyService from "@/components/FinalizeHourlyService";

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

  // ✅ Step 3.3 fields (from page.tsx select)
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

export default function OwnerRentalsClient({ rentals }: { rentals: RentalRow[] }) {
  const [isPending, startTransition] = useTransition();

  async function onApprove(rentalId: string) {
    startTransition(async () => {
      const res = await approveRentalAndEmail(rentalId);
      if (!res.ok) alert(res.error);
      else if (res.ok && "emailed" in res && !res.emailed && res.error) alert(res.error);
    });
  }

  async function onReject(rentalId: string) {
    startTransition(async () => {
      const res = await rejectRental(rentalId);
      if (!res.ok) alert(res.error);
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

        // ✅ show finalize UI only when:
        // - approved
        // - operator selected
        // - hourly operator
        // - marked as estimate
        // - not finalized yet
        const showFinalize =
          r.status === "approved" &&
          Boolean(r.operator_selected) &&
          String(r.operator_rate_unit) === "hour" &&
          Boolean(r.hourly_is_estimate) &&
          !r.hourly_finalized_at;

        return (
          <div key={r.id} className="rr-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">{r.listing?.title ?? "Listing"}</div>

                <div className="mt-1 text-sm text-slate-600">
                  {r.start_date} → {r.end_date}
                </div>

                <div className="mt-1 text-sm">
                  <span className="font-medium">Status:</span>{" "}
                  <span className="capitalize">{r.status}</span>
                </div>

                {r.message ? (
                  <div className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">Message:</span> {r.message}
                  </div>
                ) : null}

                {/* Hourly estimate vs finalized info */}
                {Boolean(r.operator_selected) && String(r.operator_rate_unit) === "hour" ? (
                  <div className="mt-3 text-sm text-slate-700">
                    <span className="font-medium">Hourly service:</span>{" "}
                    {r.hourly_finalized_at ? (
                      <>
                        Finalized —{" "}
                        <span className="font-semibold">{r.hourly_final_hours ?? r.operator_hours ?? "—"}</span> hrs
                      </>
                    ) : (
                      <>
                        Estimate —{" "}
                        <span className="font-semibold">
                          {r.hourly_estimated_hours ?? r.operator_hours ?? "—"}
                        </span>{" "}
                        hrs
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col items-end gap-2">
                {/* Invoice (already works for owners) */}
                <a
                  href={`/api/invoice?rental_id=${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rr-btn rr-btn-primary"
                >
                  Invoice
                </a>

                <div className="flex gap-2">
                  <button
                    onClick={() => onApprove(r.id)}
                    disabled={isPending || isFinal}
                    className="rr-btn rr-btn-primary"
                  >
                    Approve & Email
                  </button>

                  <button
                    onClick={() => onReject(r.id)}
                    disabled={isPending || isFinal}
                    className="rr-btn rr-btn-danger"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>

            {/* ✅ Step 3.3 Finalize component */}
            {showFinalize ? (
              <div className="mt-4">
                <FinalizeHourlyService
                  rentalId={r.id}
                  defaultHours={Math.max(1, Number(r.hourly_estimated_hours ?? r.operator_hours ?? 1))}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
