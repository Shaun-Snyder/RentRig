"use client";

import { useMemo, useState, useTransition } from "react";
import { requestRental } from "@/app/rentals/actions";

type BlockedRow = {
  start_date: string;
  end_date: string;
  buffer_days: number | null;
  status?: string;
};

function parseISODate(value: string) {
  // value is YYYY-MM-DD
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
}

function addDaysUTC(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// inclusive overlap: [aStart, aEnd] overlaps [bStart, bEnd]
function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

function formatRange(r: BlockedRow) {
  const buf = Number(r.buffer_days ?? 0);
  return `${r.start_date} → ${r.end_date}${buf ? ` (buffer +${buf}d)` : ""}`;
}

export default function RentalRequestForm({
  listingId,
  blocked,
}: {
  listingId: string;
  blocked: BlockedRow[];
}) {
  const [msg, setMsg] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isPending, startTransition] = useTransition();

  const blockedRanges = useMemo(() => {
    // convert to Date ranges including buffer days on the end
    return (blocked ?? []).map((r) => {
      const bStart = parseISODate(r.start_date);
      const bEnd = addDaysUTC(parseISODate(r.end_date), Number(r.buffer_days ?? 0));
      return { raw: r, bStart, bEnd };
    });
  }, [blocked]);

  const overlapError = useMemo(() => {
    if (!start || !end) return "";

    // quick sanity: end must be >= start
    const reqStart = parseISODate(start);
    const reqEnd = parseISODate(end);
    if (reqEnd < reqStart) return "End date must be the same or after start date.";

    for (const r of blockedRanges) {
      if (rangesOverlap(reqStart, reqEnd, r.bStart, r.bEnd)) {
        return `Not available: overlaps an approved booking (${formatRange(r.raw)}).`;
      }
    }
    return "";
  }, [start, end, blockedRanges]);

  const canSubmit = !overlapError && start && end;

  return (
    <form
      className="rounded-xl border bg-white p-5 shadow-sm grid gap-3 max-w-xl"
      action={(fd) => {
        setMsg("");

        // client-side guard (server will also enforce)
        if (!canSubmit) {
          setMsg(overlapError || "Please choose start and end dates.");
          return;
        }

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
        <input
          name="start_date"
          type="date"
          className="border rounded-lg p-2"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm text-slate-600">End date</span>
        <input
          name="end_date"
          type="date"
          className="border rounded-lg p-2"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm text-slate-600">Message to owner (optional)</span>
        <textarea
          name="message"
          className="border rounded-lg p-2"
          placeholder="Pickup time, experience, questions, anything helpful..."
        />
      </label>

      {overlapError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {overlapError}
        </div>
      )}

      <button
        className="rounded-lg border px-4 py-2 w-fit"
        disabled={isPending || !canSubmit}
      >
        {isPending ? "Sending..." : "Request rental"}
      </button>

      {msg && <p className="text-sm">{msg}</p>}

      {blocked?.length > 0 && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <div className="text-xs font-semibold text-slate-500">Unavailable (approved)</div>
          <ul className="mt-1 list-disc pl-5">
            {blocked.map((r, i) => (
              <li key={i}>{formatRange(r)}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

