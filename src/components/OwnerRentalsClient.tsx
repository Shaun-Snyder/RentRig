"use client";

import { useState, useTransition } from "react";
import { ownerSetRentalStatus } from "@/app/rentals/actions";

type RentalRow = {
  id: string;
  listing_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  listing: { id: string; title: string } | null;
  message?: string | null;
};

export default function OwnerRentalsClient({ rentals }: { rentals: RentalRow[] }) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-8 grid gap-3">
      {rentals.length === 0 ? (
        <p className="text-slate-600">No requests yet.</p>
      ) : (
        rentals.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white p-5 shadow-sm grid gap-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{r.listing?.title ?? "Listing"}</div>
                <div className="text-sm text-slate-600">
                  {r.start_date} → {r.end_date} • <span className="font-medium">{r.status}</span>
                   {r.message && (
  <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
    <div className="text-xs font-semibold text-slate-500">Message</div>
    <div className="mt-1 whitespace-pre-wrap">{r.message}</div>
  </div>
)}

                </div>
                <div className="text-xs text-slate-500 break-all">Renter: {r.renter_id}</div>
              </div>

              {r.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border px-3 py-2"
                    disabled={isPending}
                    onClick={() => {
                      setMsg("");
                      startTransition(async () => {
                        const res = await ownerSetRentalStatus(r.id, "approved");
                        setMsg(res.message);
                      });
                    }}
                  >
                    Approve
                  </button>

                  <button
                    className="rounded-lg border px-3 py-2"
                    disabled={isPending}
                    onClick={() => {
                      setMsg("");
                      startTransition(async () => {
                        const res = await ownerSetRentalStatus(r.id, "rejected");
                        setMsg(res.message);
                      });
                    }}
                  >
                    Reject
                  </button>
                </div>
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
