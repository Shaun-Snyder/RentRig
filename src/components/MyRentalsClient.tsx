"use client";

import { useState, useTransition } from "react";
import { cancelRental } from "@/app/rentals/actions";

type RentalRow = {
  id: string;
  listing_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  status: string;
  buffer_days?: number | null;
  message?: string | null;
  created_at?: string;
  listing?: { id: string; title: string } | null;
};

export default function MyRentalsClient({ rentals }: { rentals: RentalRow[] }) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-8 grid gap-3">
      {msg && <div className="rounded-lg border bg-white p-3 text-sm">{msg}</div>}

      {rentals.length === 0 ? (
        <p className="text-slate-600">No rentals yet.</p>
      ) : (
        <div className="grid gap-3">
          {rentals.map((r) => (
            <div key={r.id} className="rounded-xl border bg-white p-5 shadow-sm grid gap-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">
                    {r.listing?.title ?? `Listing ${r.listing_id}`}
                  </div>

                  <div className="text-sm text-slate-600 mt-1">
                    <span className="font-medium">Dates:</span> {r.start_date} → {r.end_date}
                    {typeof r.buffer_days === "number" ? ` • Buffer: ${r.buffer_days}d` : ""}
                  </div>

                  <div className="text-sm text-slate-600">
                    <span className="font-medium">Status:</span> {r.status}
                  </div>

                  {r.message && (
                    <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="text-xs font-semibold text-slate-500">Your message</div>
                      <div className="mt-1 whitespace-pre-wrap">{r.message}</div>
                    </div>
                  )}
                </div>

                {r.status === "pending" && (
                  <button
                    type="button"
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
                    {isPending ? "Cancelling..." : "Cancel"}
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-500 break-all">Rental ID: {r.id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
