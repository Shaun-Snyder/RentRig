
"use client";

import React from "react";

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

export default function RenterRentalsClient({ rentals }: { rentals: Rental[] }) {
  if (!rentals || rentals.length === 0) {
    return <p className="text-slate-600">You have no rental requests yet.</p>;
  }

  return (
    <div className="mt-6 space-y-4">
      {rentals.map((r) => (
        <div
          key={r.id}
          className="rr-card grid gap-4 p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* LEFT: Thumbnail + info */}
            <div className="flex gap-4">
              {/* Thumbnail placeholder – we’ll hook up real photo later */}
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-black/60 bg-slate-50 shadow-sm">
                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                  Photo
                </div>
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

            {/* RIGHT: buttons (unchanged) */}
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <a
                href={`/api/invoice?rental_id=${encodeURIComponent(r.id)}`}
                target="_blank"
                rel="noreferrer"
                className="rr-btn rr-btn-primary"
              >
                Download invoice
              </a>

              <a
                href={`/dashboard/rentals/${encodeURIComponent(
                  r.id
                )}/inspection`}
                className="rr-btn rr-btn-secondary text-xs"
              >
                Record / view condition
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
