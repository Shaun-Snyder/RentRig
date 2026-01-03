
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { createClient } from "@/lib/supabase/client";

type Listing = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  price_per_day: number;
  created_at: string;
};

type SortMode = "newest" | "price_asc" | "price_desc";

const CATEGORIES = [
  { key: "heavy_equipment", label: "Heavy Equipment" },
  { key: "lifts", label: "Lifts" },
  { key: "trailers", label: "Trailers" },
  { key: "vans_covered", label: "Vans / Covered" },
  { key: "trucks", label: "Trucks" },
  { key: "other", label: "Other" },
] as const;

function catLabel(key: unknown) {
  const k = String(key ?? "");
  return CATEGORIES.find((c) => c.key === k)?.label ?? (k || "Other");
}

type BlockedRange = {
  start: string; // YYYY-MM-DD inclusive
  end_exclusive: string; // YYYY-MM-DD exclusive
};

function parseISODateUTC(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUTC(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function toISODateUTC(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ListingsClient({ listings }: { listings: Listing[] }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const supabase = createClient();

  type ListingPhoto = {
    id: string;
    listing_id: string;
    path: string;
    sort_order: number | null;
    created_at?: string;
  };

  function storageUrl(path: string) {
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  const [thumbById, setThumbById] = useState<Record<string, string>>({});

  // ---------- Price sliders ----------
  const priceBounds = useMemo(() => {
    if (listings.length === 0) return { min: 0, max: 0 };
    const prices = listings
      .map((l) => Number(l.price_per_day))
      .filter((n) => Number.isFinite(n));
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [listings]);

  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);

  useEffect(() => {
    setMinPrice(priceBounds.min);
    setMaxPrice(priceBounds.max);
  }, [priceBounds.min, priceBounds.max]);
  // ---------------------------------

  // ---------- Availability (range picker + auto-check) ----------
  const [availEnabled, setAvailEnabled] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [availError, setAvailError] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [checkedRange, setCheckedRange] = useState<{ from: string; to: string } | null>(null);

  const [blockedByListing, setBlockedByListing] = useState<Record<string, BlockedRange[]>>({});
  const [availabilityStatus, setAvailabilityStatus] = useState<Record<string, "available" | "booked">>(
    {}
  );

  const lastAutoKey = useRef<string | null>(null);

  const availableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, st] of Object.entries(availabilityStatus)) {
      if (st === "available") ids.add(id);
    }
    return ids;
  }, [availabilityStatus]);
  // -----------------------------------------------

  const filteredSorted = useMemo(() => {
    const query = q.trim().toLowerCase();
    const cityQ = city.trim().toLowerCase();
    const stateQ = state.trim().toLowerCase();

    let out = listings;

    if (query) {
      out = out.filter((l) => {
        const haystack = [l.title, l.city ?? "", l.state ?? "", l.description ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    if (cityQ) out = out.filter((l) => (l.city ?? "").toLowerCase().includes(cityQ));
    if (stateQ) out = out.filter((l) => (l.state ?? "").toLowerCase().includes(stateQ));

    out = out.filter((l) => {
      const p = Number(l.price_per_day);
      return p >= minPrice && p <= maxPrice;
    });

    if (availEnabled && checked) {
      out = out.filter((l) => availableIds.has(l.id));
    }

    const sorted = [...out].sort((a, b) => {
      if (sort === "price_asc") return Number(a.price_per_day) - Number(b.price_per_day);
      if (sort === "price_desc") return Number(b.price_per_day) - Number(a.price_per_day);

      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return tb - ta;
    });

    return sorted;
  }, [
    q,
    city,
    state,
    sort,
    listings,
    minPrice,
    maxPrice,
    availEnabled,
    checked,
    availableIds,
  ]);

  async function checkAvailabilityWithRange(fromLocal: Date, toLocal: Date) {
    setAvailError(null);

    // Normalize to UTC dates (strip time)
    const from = new Date(Date.UTC(fromLocal.getFullYear(), fromLocal.getMonth(), fromLocal.getDate()));
    const to = new Date(Date.UTC(toLocal.getFullYear(), toLocal.getMonth(), toLocal.getDate()));

    if (to < from) {
      setAvailError("End date must be on or after start date.");
      return;
    }

    // inclusive selection -> [start, end+1)
    const reqStart = from;
    const reqEndExclusive = addDaysUTC(to, 1);

    const autoKey = `${toISODateUTC(reqStart)}_${toISODateUTC(to)}`;
    lastAutoKey.current = autoKey;

    setChecking(true);
    try {
      // Fetch availability only for listings we haven't fetched yet
      const idsToFetch = listings
        .map((l) => l.id)
        .filter((id) => blockedByListing[id] === undefined);

      if (idsToFetch.length > 0) {
        const results = await Promise.all(
          idsToFetch.map(async (id) => {
            const res = await fetch(`/api/availability?listing_id=${encodeURIComponent(id)}`, {
              cache: "no-store",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Failed to load availability");
            return [id, (json.blocked ?? []) as BlockedRange[]] as const;
          })
        );

        setBlockedByListing((prev) => {
          const next = { ...prev };
          for (const [id, ranges] of results) next[id] = ranges;
          return next;
        });
      }

      // Build status using current blockedByListing + any newly fetched (we’ll re-read from state snapshot)
      const status: Record<string, "available" | "booked"> = {};
      for (const l of listings) {
        const ranges = blockedByListing[l.id] ?? [];
        let overlaps = false;
        for (const r of ranges) {
          const bStart = parseISODateUTC(r.start);
          const bEnd = parseISODateUTC(r.end_exclusive);
          if (rangesOverlap(reqStart, reqEndExclusive, bStart, bEnd)) {
            overlaps = true;
            break;
          }
        }
        status[l.id] = overlaps ? "booked" : "available";
      }

      setAvailabilityStatus(status);
      setChecked(true);
      setCheckedRange({ from: toISODateUTC(reqStart), to: toISODateUTC(to) });
    } catch (e: any) {
      setAvailError(e?.message || "Failed to check availability.");
      setChecked(false);
      setCheckedRange(null);
      setAvailabilityStatus({});
    } finally {
      setChecking(false);
    }
  }

  // ✅ AUTO CHECK: when both dates selected (only if enabled)
  useEffect(() => {
    if (!availEnabled) return;
    if (!range?.from || !range?.to) return;

    const from = range.from;
    const to = range.to;

    const key = `${toISODateUTC(new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())))}_${toISODateUTC(
      new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()))
    )}`;

    if (lastAutoKey.current === key) return;

    checkAvailabilityWithRange(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to, availEnabled]);

  return (
    <div className="mt-8 grid gap-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm grid gap-4">
        {/* Search + location */}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm text-slate-600">Search</span>
            <input
              className="border rounded-lg p-2"
              placeholder='Try "ford", "Orlando", "FL"...'
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-slate-600">City (optional)</span>
            <input
              className="border rounded-lg p-2"
              placeholder="Orlando"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-slate-600">State (optional)</span>
            <input
              className="border rounded-lg p-2"
              placeholder="FL"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </label>
        </div>

        {/* Price sliders + Sort + Clear */}
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-sm text-slate-600">
              Min $/day: <span className="font-medium">{minPrice}</span>
            </span>
            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              step={1}
              value={minPrice}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMinPrice(v);
                if (v > maxPrice) setMaxPrice(v);
              }}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-slate-600">
              Max $/day: <span className="font-medium">{maxPrice}</span>
            </span>
            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              step={1}
              value={maxPrice}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaxPrice(v);
                if (v < minPrice) setMinPrice(v);
              }}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-slate-600">Sort</span>
            <select
              className="border rounded-lg p-2"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 w-full"
              onClick={() => {
                setQ("");
                setCity("");
                setState("");
                setSort("newest");
                setMinPrice(priceBounds.min);
                setMaxPrice(priceBounds.max);

                setAvailEnabled(false);
                setRange(undefined);
                setAvailError(null);
                setChecked(false);
                setCheckedRange(null);
                setAvailabilityStatus({});
                lastAutoKey.current = null;
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Availability */}
        <div className="rounded-lg border p-3 grid gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={availEnabled}
              onChange={(e) => {
                setAvailEnabled(e.target.checked);
                setChecked(false);
                setCheckedRange(null);
                setAvailError(null);
                setAvailabilityStatus({});
                lastAutoKey.current = null;
              }}
            />
            Only show listings available for my dates
          </label>

          {availEnabled && (
            <div className="rounded-lg border bg-white p-3">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setRange(r);
                  setChecked(false);
                  setCheckedRange(null);
                  setAvailError(null);
                  lastAutoKey.current = null;
                }}
                numberOfMonths={2}
                showOutsideDays
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border px-4 py-2"
              disabled={!availEnabled || checking || !range?.from || !range?.to}
              onClick={() => {
                if (range?.from && range?.to) checkAvailabilityWithRange(range.from, range.to);
              }}
            >
              {checking ? "Checking..." : "Re-check"}
            </button>

            {checkedRange ? (
              <p className="text-sm text-slate-500">
                Availability checked for:{" "}
                <span className="font-medium">
                  {checkedRange.from} → {checkedRange.to}
                </span>
                {checking ? " (updating…)" : ""}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Select a start + end date (auto-check will run).
              </p>
            )}
          </div>

          {availError && <p className="text-sm text-red-600">{availError}</p>}
        </div>

        <div className="text-sm text-slate-500">
          Showing <span className="font-medium">{filteredSorted.length}</span> of{" "}
          <span className="font-medium">{listings.length}</span>
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <p className="text-slate-600">No matching listings.</p>
      ) : (
        <div className="grid gap-4">
          {filteredSorted.map((l) => {
  const st = checked ? availabilityStatus[l.id] : null;
  const thumb = (l as any).thumb_url || "";

  return (
    <div
      key={l.id}
      className="rounded-xl border bg-white p-4 shadow-sm hover:shadow transition grid gap-3"
    >
      {/* Thumbnail */}
      <a
  href={`/listings/${l.id}`}
  className="block w-24 h-24 rounded-lg border bg-slate-50 overflow-hidden flex-shrink-0"
>
  {thumb ? (
    <img
      src={thumb}
      alt="Listing thumbnail"
      className="h-full w-full object-contain"
    />
  ) : (
    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
      No photo
    </div>
  )}
</a>

      {/* Info */}
      <div className="grid gap-1">
        <a className="font-semibold text-lg underline" href={`/listings/${l.id}`}>
          {l.title}
        </a>

        <div className="text-sm text-slate-600">
          ${Number(l.price_per_day).toFixed(2)}/day
          {l.city || l.state ? ` • ${[l.city, l.state].filter(Boolean).join(", ")}` : ""}

          {st === "available" && (
            <span className="ml-2 rounded-full border px-2 py-0.5 text-xs text-emerald-700">
              Available
            </span>
          )}

          {st === "booked" && (
            <span className="ml-2 rounded-full border px-2 py-0.5 text-xs text-rose-700">
              Booked
            </span>
          )}
        </div>

        {l.category && (
          <div className="text-xs text-slate-500">Category: {catLabel(l.category)}</div>
        )}

        {l.license_required ? (
          <div className="text-xs text-amber-700">
            License required{l.license_type ? `: ${l.license_type}` : ""}
          </div>
        ) : null}

        {l.description && (
          <div className="mt-1 text-sm text-slate-700">{l.description}</div>
        )}
      </div>
    </div>
  );
})}

        </div>
      )}
    </div>
  );
}
