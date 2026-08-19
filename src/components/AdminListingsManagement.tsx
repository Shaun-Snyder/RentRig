"use client";

import { useMemo, useState } from "react";

type AdminListing = {
  id: string;
  title?: string | null;
  owner_id?: string | null;
  city?: string | null;
  state?: string | null;
  price_per_day?: number | null;
  security_deposit?: number | null;
  is_published?: boolean | null;
  created_at?: string | null;
  owner?: {
    id?: string | null;
    full_name?: string | null;
    company_name?: string | null;
  } | null;
};

type Props = {
  listings: AdminListing[];
};

export default function AdminListingsManagement({ listings }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return listings.filter((listing) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" && listing.is_published) ||
        (statusFilter === "draft" && !listing.is_published);

      const searchable = [
        listing.title,
        listing.city,
        listing.state,
        listing.owner?.full_name,
        listing.owner?.company_name,
        listing.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [listings, search, statusFilter]);

  return (
    <div>
      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-slate-700">
            Search listings
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Equipment, owner, city..."
            className="rr-input"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold text-slate-700">
            Listing status
          </span>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rr-input"
          >
            <option value="all">All listings</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>

      <div className="text-sm text-slate-500">
        Showing {filteredListings.length} of {listings.length} listings
      </div>

      {filteredListings.length === 0 ? (
        <div className="rr-card mt-4 p-5 text-slate-600">
          No listings match your search or filter.
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          {filteredListings.map((listing) => (
            <div key={listing.id} className="rr-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-bold text-slate-900">
                    {listing.title}
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    {[listing.city, listing.state].filter(Boolean).join(", ") ||
                      "Location not provided"}
                  </div>

                  <div className="mt-1 text-sm text-slate-500">
                    Owner:{" "}
                    {listing.owner?.full_name ||
                      listing.owner?.company_name ||
                      "Unknown owner"}
                  </div>
                </div>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    listing.is_published
                      ? "bg-green-100 text-green-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {listing.is_published ? "Published" : "Draft"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-slate-500">Daily Rate</div>
                  <div className="font-semibold">
                    ${Number(listing.price_per_day ?? 0).toFixed(2)}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Security Deposit</div>
                  <div className="font-semibold">
                    ${Number(listing.security_deposit ?? 0).toFixed(2)}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Created</div>
                  <div className="font-semibold">
                    {listing.created_at
                      ? new Date(listing.created_at).toLocaleDateString()
                      : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <a
                  href={`/listings/${listing.id}`}
                  className="rr-btn rr-btn-secondary rr-btn-sm"
                >
                  View Listing
                </a>

                {listing.owner_id ? (
                  <a
                    href={`/profile/${listing.owner_id}`}
                    className="rr-btn rr-btn-secondary rr-btn-sm"
                  >
                    View Owner
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
