"use client";

import { useState, useTransition } from "react";
import { ownerFinalizeHourly } from "@/app/rentals/actions";

export default function FinalizeHourlyService({
  rentalId,
  defaultHours = 1,
}: {
  rentalId: string;
  defaultHours?: number;
}) {
  const [hours, setHours] = useState<number>(defaultHours);
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border bg-white p-3 text-sm grid gap-2">
      <div className="font-semibold">Finalize hourly service</div>

      <label className="grid gap-1">
        <span className="text-slate-600">Final hours</span>
        <input
          type="number"
          min="1"
          step="1"
          value={hours}
          onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))}
          className="border rounded-lg p-2"
        />
      </label>

      <button
        type="button"
        className="rounded-lg border px-3 py-2 w-fit"
        disabled={isPending}
        onClick={() => {
          setMsg("");
          startTransition(async () => {
            const res = await ownerFinalizeHourly(rentalId, hours);
            setMsg(res.message);
          });
        }}
      >
        {isPending ? "Finalizing..." : "Finalize hours"}
      </button>

      {msg && <div>{msg}</div>}
    </div>
  );
}
