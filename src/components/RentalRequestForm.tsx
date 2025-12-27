"use client";

import { useState, useTransition } from "react";
import { requestRental } from "@/app/rentals/actions";

export default function RentalRequestForm({ listingId }: { listingId: string }) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="rounded-xl border bg-white p-5 shadow-sm grid gap-3 max-w-xl"
      action={(fd) => {
        setMsg("");
        startTransition(async () => {
          const res = await requestRental(fd);
          setMsg(res.message);
        });
      }}
    >
      <h2 className="text-lg font-semibold">Request this listing</h2>

      <input type="hidden" name="listing_id" value={listingId} />

      <label className="grid gap-1">
        <span className="text-sm text-slate-600">Start date</span>
        <input name="start_date" type="date" className="border rounded-lg p-2" />
      </label>

      <label className="grid gap-1">
        <span className="text-sm text-slate-600">End date</span>
        <input name="end_date" type="date" className="border rounded-lg p-2" />
      </label>
<label className="grid gap-1">
  <span className="text-sm text-slate-600">Message to owner (optional)</span>
  <textarea
    name="message"
    className="border rounded-lg p-2"
    placeholder="Pickup time, experience, questions, anything helpful..."
  />
</label>

      <button className="rounded-lg border px-4 py-2 w-fit" disabled={isPending}>
        {isPending ? "Sending..." : "Request rental"}
      </button>

      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
