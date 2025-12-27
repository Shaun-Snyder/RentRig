"use client";

import { useState, useTransition } from "react";
import { cancelRental } from "@/app/rentals/actions";

type Listing = {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  price_per_day: number;
};

type RentalRow = {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  listing: Listing | null;
};

export default function RenterRentalsClient({ rentals }: { rentals: RentalRow[] }) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-8 grid gap-3">
      {rentals.length === 0 ? (
        <p className="text-slate-600">No rentals yet.</p>
      ) : (
        rentals.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white p-5 shadow-sm grid gap-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">
                  {r.listing?.title ?? "Listing"}
                </div>
                <div className="text-sm text-slate-600">
                  {r.start_date} → {r.end_date} • <span className="font-medium">{r.status}</span>
                </div>
                {r.listing && (
                  <div className="text-sm text-slate-600">
                    ${Number(r.listing.price_per_day).toFixed(2)}/day
                    {r.listing.city || r.listing.state
                      ? ` • ${[r.listing.city, r.listing.state].filter(Boolean).join(", ")}`
                      : ""}
                  </div>
                )}
              </div>

              {r.status === "pending" && (
                <button
                  className="rounded-lg border px-3 py-2"
                  disabled={isPending}
                  onClick={() => {
                    setMsg("");
                    startTransition(async () => {
                      const res = await cancelRental(r.id);
                      setMsg(res.message);
                    });
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 break-all">Rental ID: {r.id}</div>
          </div>
        ))
      )}

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
