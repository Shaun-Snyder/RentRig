
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

type SortMode = "newest" | "price_asc" | "price_desc" | "distance";

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

export default function ListingsClient({
  listings,
  initialQ = "",
}: {
  listings: Listing[];
  initialQ?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
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
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
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
  const [checkedRange, setCheckedRange] = useState<{ from: string; to: string } | null>(
    null
  );

  const [blockedByListing, setBlockedByListing] = useState<Record<string, BlockedRange[]>>(
    {}
  );
  const [availabilityStatus, setAvailabilityStatus] = useState<
    Record<string, "available" | "booked">
  >({});

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
    const zipQ = zip.trim();

    let out = listings;

    // Text search (title, description, city, state)
    if (query) {
      out = out.filter((l) => {
        const haystack = [l.title, l.city ?? "", l.state ?? "", l.description ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    // City filter
    if (cityQ) {
      out = out.filter((l) => (l.city ?? "").toLowerCase().includes(cityQ));
    }

    // State filter
    if (stateQ) {
      out = out.filter((l) => (l.state ?? "").toLowerCase().includes(stateQ));
    }

    // ZIP filter (match beginning of zip: "3280" matches "32801")
    if (zipQ) {
      out = out.filter((l) => {
        const ll: any = l;
        const listingZip = String(
          ll.zip ?? ll.zip_code ?? ll.postal_code ?? ""
        ).trim();
        if (!listingZip) return false;
        return listingZip.startsWith(zipQ);
      });
    }

    // Price range filter (using only max slider in UI but keeping min guard)
    out = out.filter((l) => {
      const p = Number(l.price_per_day);
      return p >= minPrice && p <= maxPrice;
    });

    // Availability filter
    if (availEnabled && checked) {
      out = out.filter((l) => availableIds.has(l.id));
    }

    // Sorting
    const sorted = [...out];

    // Distance sort (based on ZIP numeric closeness)
    if (sort === "distance") {
      const zipNum = parseInt(zipQ, 10);
      if (!zipQ || Number.isNaN(zipNum)) {
        // If no valid ZIP entered, fall back to newest
        sorted.sort((a, b) => {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          return tb - ta;
        });
        return sorted;
      }

      sorted.sort((a, b) => {
        const la: any = a;
        const lb: any = b;

        const azStr = String(
          la.zip ?? la.zip_code ?? la.postal_code ?? ""
        ).trim();
        const bzStr = String(
          lb.zip ?? lb.zip_code ?? lb.postal_code ?? ""
        ).trim();

        const az = parseInt(azStr, 10);
        const bz = parseInt(bzStr, 10);

        const aDist = Number.isNaN(az) ? Number.POSITIVE_INFINITY : Math.abs(az - zipNum);
        const bDist = Number.isNaN(bz) ? Number.POSITIVE_INFINITY : Math.abs(bz - zipNum);

        if (aDist === bDist) {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          return tb - ta;
        }

        return aDist - bDist;
      });

      return sorted;
    }

    if (sort === "price_asc") {
      sorted.sort(
        (a, b) => Number(a.price_per_day) - Number(b.price_per_day)
      );
      return sorted;
    }

    if (sort === "price_desc") {
      sorted.sort(
        (a, b) => Number(b.price_per_day) - Number(a.price_per_day)
      );
      return sorted;
    }

    // Default: newest first
    sorted.sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return tb - ta;
    });

    return sorted;
  }, [
    q,
    city,
    state,
    zip,
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
    const from = new Date(
      Date.UTC(fromLocal.getFullYear(), fromLocal.getMonth(), fromLocal.getDate())
    );
    const to = new Date(
      Date.UTC(toLocal.getFullYear(), toLocal.getMonth(), toLocal.getDate())
    );

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
            const res = await fetch(
              `/api/availability?listing_id=${encodeURIComponent(id)}`,
              {
                cache: "no-store",
              }
            );
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

    const key = `${toISODateUTC(
      new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()))
    )}_${toISODateUTC(
      new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()))
    )}`;

    if (lastAutoKey.current === key) return;

    checkAvailabilityWithRange(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to, availEnabled]);

  return (
    <div className="mt-8 grid gap-4">
      <div className="rr-card p-6 grid gap-4">
        {/* Search + location + ZIP */}
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-sm text-slate-600">Search</span>
            <input
              className="w-full rr-input"
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

          <label className="grid gap-2">
            <span className="text-sm text-slate-600">ZIP (optional)</span>
            <input
              className="border rounded-lg p-2"
              placeholder="32801"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </label>
        </div>

        {/* Price sliders + Sort + Clear */}
        <div className="grid gap-3 md:grid-cols-4">
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
      <option value="distance">Distance: closest first</option>
    </select>
  </label>

  <div className="flex items-end">
    <button
      type="button"
      className="rr-btn rr-btn-primary rr-btn-sm w-full"
      // Filtering already reacts as you type, so this is mainly UX.
      onClick={() => {
        // No-op: state `q`, `city`, `state`, `zip` already drives filters.
        // Kept for user expectation of a "Search" action.
        setQ((current) => current.trim());
      }}
    >
      Search
    </button>
  </div>

  <div className="flex items-end">
    <button
      type="button"
      className="rr-btn rr-btn-secondary rr-btn-sm w-full"
      onClick={() => {
        setQ(initialQ || "");
        setCity("");
        setState("");
        setZip("");
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
        <div className="rr-card rr-card-sm p-4 grid gap-3">
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
            <div className="rounded-lg border border-black/20 bg-white/60 p-3">
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
              className="rr-btn rr-btn-secondary rr-btn-sm"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSorted.map((l) => {
            const st = checked ? availabilityStatus[l.id] : null;
            const thumb = (l as any).thumb_url || "";
            const ll: any = l;

            // Category label
            const categoryText =
              ll.category != null ? catLabel(ll.category) : null;

            // Location
            const locationParts = [l.city, l.state].filter(Boolean);
            const locationText =
              locationParts.length > 0 ? locationParts.join(", ") : null;

            // Price + deposit
            const hasDayPrice = Number.isFinite(Number(l.price_per_day));
            const perDayText = hasDayPrice
              ? `$${Number(l.price_per_day).toFixed(2)}/day`
              : null;

            const hourlyRaw = ll.price_per_hour ?? ll.hourly_rate ?? null;
            const hasHourlyPrice = Number.isFinite(Number(hourlyRaw));
            const perHourText = hasHourlyPrice
              ? `$${Number(hourlyRaw).toFixed(2)}/hour`
              : null;

            const depositRaw =
              ll.deposit ?? ll.deposit_amount ?? ll.security_deposit ?? null;
            const hasDeposit = Number.isFinite(Number(depositRaw));
            const depositText = hasDeposit
              ? `$${Number(depositRaw).toFixed(2)}`
              : null;

            let priceLine: string | null = null;
            if (perDayText || perHourText || depositText) {
              const pieces: string[] = [];
              if (perDayText) pieces.push(perDayText);
              if (perHourText) pieces.push(perHourText);
              let base = `Price: ${pieces.join(" • ") || ""}`.trim();
              if (depositText) {
                base += `${pieces.length ? " • " : ""}Deposit: ${depositText}`;
              }
              priceLine = base;
            }

            // Operator line (based on operator_enabled)
            let operatorLine: string | null = null;
            if (typeof ll.operator_enabled === "boolean") {
              operatorLine = ll.operator_enabled
                ? "Operator: Available"
                : "Operator: Not included";
            }

            // Driver line (based on license_required / license_type)
            let driverLine: string | null = null;
            if (typeof ll.license_required === "boolean") {
              if (ll.license_required) {
                driverLine = `Driver: Must have ${ll.license_type || "CDL"}`;
              } else {
                driverLine = "Driver: No CDL required";
              }
            }

            return (
              <div
                key={l.id}
                className="rr-card overflow-hidden flex flex-col bg-white"
              >
                {/* Thumbnail: full card width at the top */}
                <a
                  href={`/listings/${l.id}`}
                  className="block w-full aspect-[4/3] border-b bg-slate-50 overflow-hidden"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt="Listing thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                      No photo
                    </div>
                  )}
                </a>

                {/* Details under the photo */}
                <div className="p-4 flex flex-col gap-1 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <a
                      className="font-semibold text-base sm:text-lg hover:underline"
                      href={`/listings/${l.id}`}
                    >
                      {l.title}
                    </a>

                    {st === "available" && (
                      <span className="ml-2 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        Available
                      </span>
                    )}

                    {st === "booked" && (
                      <span className="ml-2 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                        Booked
                      </span>
                    )}
                  </div>

                  {categoryText && (
                    <div className="text-sm text-slate-700">
                      <span className="font-medium">Category:</span>{" "}
                      <span className="text-slate-700">{categoryText}</span>
                    </div>
                  )}

                  {locationText && (
                    <div className="text-sm text-slate-700">
                      <span className="font-medium">Location:</span>{" "}
                      <span className="text-slate-700">{locationText}</span>
                    </div>
                  )}

                  {priceLine && (
                    <div className="text-sm text-slate-700">{priceLine}</div>
                  )}

                  {operatorLine && (
                    <div className="text-sm text-slate-700">
                      {operatorLine}
                    </div>
                  )}

                  {driverLine && (
                    <div className="text-sm text-slate-700">{driverLine}</div>
                  )}

                  {l.description && (
                    <p className="mt-1 text-sm text-slate-700">
                      {l.description}
                    </p>
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
