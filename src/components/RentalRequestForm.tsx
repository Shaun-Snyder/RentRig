"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { requestRental } from "@/app/rentals/actions";

type BlockedRange = {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  buffer_days?: number | null;
};

function isValidISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Parse YYYY-MM-DD as UTC midnight (prevents timezone shift bugs)
function parseISODate(value: string) {
  const [y, m, d] = value.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUTC(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Overlap check for half-open ranges: [aStart, aEnd) overlaps [bStart, bEnd)
function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export default function RentalRequestForm({
  listingId,
  blocked,
}: {
  listingId: string;
  blocked?: BlockedRange[];
}) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  // form state (so we can validate/disable visually)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // load availability from API (works even if page doesn’t pass blocked)
  const [apiBlocked, setApiBlocked] = useState<BlockedRange[]>([]);
  const [apiErr, setApiErr] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setApiErr("");
      try {
        const res = await fetch(`/api/availability?listing_id=${encodeURIComponent(listingId)}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load availability");
        }

        if (!cancelled) {
          setApiBlocked(Array.isArray(json?.blocked) ? json.blocked : []);
        }
      } catch (e: any) {
        if (!cancelled) setApiErr(e?.message || "Failed to load availability");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const effectiveBlocked = useMemo(() => {
    // if the page passes blocked, prefer it; otherwise use API data
    if (blocked && blocked.length) return blocked;
    return apiBlocked;
  }, [blocked, apiBlocked]);

  const overlapError = useMemo(() => {
    if (!isValidISODate(startDate) || !isValidISODate(endDate)) return "";
    const reqStart = parseISODate(startDate);
    const reqEnd = parseISODate(endDate);

    // user must pick end AFTER start
    if (!(reqStart < reqEnd)) return "End date must be after start date.";

    for (const r of effectiveBlocked) {
      if (!isValidISODate(r.start_date) || !isValidISODate(r.end_date)) continue;

      const rStart = parseISODate(r.start_date);
      const buffer = Number(r.buffer_days ?? 0);
      const rEnd = addDaysUTC(parseISODate(r.end_date), buffer);

      if (rangesOverlap(reqStart, reqEnd, rStart, rEnd)) {
        return "Those dates overlap an existing approved rental (including buffer days). Please choose different dates.";
      }
    }
    return "";
  }, [startDate, endDate, effectiveBlocked]);

  const disableSubmit = !!overlapError || isPending;

  return (
    <form
      className="rounded-xl border bg-white p-5 shadow-sm grid gap-3 max-w-xl"
      action={(fd) => {
        setMsg("");

        // client-side block (visual + prevents submit)
        if (overlapError) {
          setMsg(overlapError);
          return;
        }

        startTransition(async () => {
          const res = await requestRental(fd);
          setMsg(res.message);
        });
      }}
    >
      <h2 className="text-lg font-semibold">Request this listing</h2>

      {/* we keep listing_id in the form for the server action */}
      <input type="hidden" name="listing_id" value={listingId} />

      <label className="grid gap-1">
        <span className="text-sm text-slate-600">Start date</span>
        <input
          name="start_date"
          type="date"
          className="border rounded-lg p-2"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm text-slate-600">End date (checkout)</span>
        <input
          name="end_date"
          type="date"
          className="border rounded-lg p-2"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm text-slate-600">Message to owner (optional)</span>
        <textarea
          name="message"
          className="border rounded-lg p-2"
          placeholder="Pickup time, experience, questions, anything helpful..."
          rows={4}
        />
      </label>

      {/* Availability status / visual info */}
      <div className="text-sm text-slate-600">
        {apiErr ? (
          <div className="rounded-lg border bg-white p-3 text-sm">
            <div className="font-semibold text-slate-800">Availability check not ready</div>
            <div className="mt-1">
              {apiErr}
              <div className="mt-2 text-xs text-slate-500">
                If you see env var messages, add the required Vercel env vars and redeploy.
              </div>
            </div>
          </div>
        ) : effectiveBlocked.length ? (
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-500">Unavailable ranges (approved + buffer)</div>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {effectiveBlocked.map((r, idx) => (
                <li key={idx}>
                  {r.start_date} → {r.end_date}
                  {Number(r.buffer_days ?? 0) ? ` (+${Number(r.buffer_days ?? 0)} buffer)` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-xs text-slate-500">No approved rentals blocking dates yet.</div>
        )}
      </div>

      {(msg || overlapError) && (
        <div className="rounded-lg border bg-white p-3 text-sm">
          {overlapError ? overlapError : msg}
        </div>
      )}

      <button className="rounded-lg border px-4 py-2 w-fit" disabled={disableSubmit}>
        {isPending ? "Sending..." : "Request rental"}
      </button>
    </form>
  );
}

