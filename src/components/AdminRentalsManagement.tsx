"use client";

import { useMemo, useState } from "react";

type AdminRental = {
  id: string;
  listing_id?: string | null;
  renter_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  created_at?: string | null;
  deposit_status?: string | null;
  deposit_refund_amount?: number | null;
  listingTitle?: string | null;
  ownerName?: string | null;
  renterName?: string | null;
};

type Props = {
  rentals: AdminRental[];
};

export default function AdminRentalsManagement({ rentals }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredRentals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rentals.filter((rental) => {
      const matchesStatus =
        statusFilter === "all" || rental.status === statusFilter;

      const searchable = [
        rental.listingTitle,
        rental.ownerName,
        rental.renterName,
        rental.id,
        rental.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [rentals, search, statusFilter]);

  const statuses = Array.from(
    new Set(
      rentals
        .map((rental) => rental.status)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort();

  return (
    <div>
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-slate-700">
            Search rentals
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Equipment, owner, renter, rental ID..."
            className="rr-input"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold text-slate-700">
            Rental status
          </span>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rr-input"
          >
            <option value="all">All rentals</option>

            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-sm text-slate-500">
        Showing {filteredRentals.length} of {rentals.length} rentals
      </div>

      {filteredRentals.length === 0 ? (
        <div className="rr-card mt-4 p-5 text-slate-600">
          No rentals match your search or filter.
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {filteredRentals.map((rental) => (
            <div key={rental.id} className="rr-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-bold text-slate-900">
                    {rental.listingTitle || "Unknown listing"}
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    {rental.start_date} → {rental.end_date}
                  </div>
                </div>

                <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold capitalize">
                  {String(rental.status ?? "unknown").replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <div className="text-slate-500">Owner</div>
                  <div className="font-semibold">
                    {rental.ownerName || "Unknown owner"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Renter</div>
                  <div className="font-semibold">
                    {rental.renterName || "Unknown renter"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Created</div>
                  <div className="font-semibold">
                    {rental.created_at
                      ? new Date(rental.created_at).toLocaleDateString()
                      : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="break-all font-mono text-[10px] text-slate-400">
                  Rental ID: {rental.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
