
"use client";

import { useState } from "react";

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
  const [msg, setMsg] = useState("");

  if (rentals.length === 0) {
    return <p className="text-slate-600">You have no rental requests yet.</p>;
  }

  return (
    <div className="mt-6 grid gap-4">
      {rentals.map((r) => (
        <div key={r.id} className="rounded-xl border bg-white p-5 shadow-sm grid gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">
                {r.listing?.title ?? "Listing"}
              </div>

              <div className="text-sm text-slate-600">
                {r.start_date} → {r.end_date}
              </div>

              <div className="text-xs text-slate-500 mt-1">
                Status: {r.status}
                {typeof r.buffer_days === "number" ? ` • Buffer: ${r.buffer_days}d` : ""}
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={`/api/invoice?rental_id=${encodeURIComponent(r.id)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
              >
                Download invoice
              </a>
            </div>
          </div>

          {r.message && (
            <div className="text-sm text-slate-700">
              <span className="font-medium">Your message:</span> {r.message}
            </div>
          )}
        </div>
      ))}

      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
