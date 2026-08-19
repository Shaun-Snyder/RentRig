"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type AdminUser = {
  id: string;
  role?: string | null;
  marketplace_activity?: "owner" | "renter" | "both" | "none";
  full_name?: string | null;
  company_name?: string | null;
  city?: string | null;
  state?: string | null;
  occupation?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

type AdminUserManagementProps = {
  users: AdminUser[];
};

export default function AdminUserManagement({
  users,
}: AdminUserManagementProps) {
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");

  const [roleFilter, setRoleFilter] = useState(() => {
    return searchParams.get("role") === "admin" ? "admin" : "all";
  });
  const [activityFilter, setActivityFilter] = useState("all");

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      const matchesActivity =
        activityFilter === "all" ||
        user.marketplace_activity === activityFilter;

      const searchable = [
        user.full_name,
        user.company_name,
        user.city,
        user.state,
        user.occupation,
        user.role,
        user.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      return matchesRole && matchesActivity && matchesSearch;
    });
  }, [search, roleFilter, activityFilter, users]);

  return (
    <div>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-slate-700">
            Search users
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, company, city, role..."
            className="rr-input"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold text-slate-700">
            Account role
          </span>

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rr-input"
          >
            <option value="all">All accounts</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-semibold text-slate-700">
            Marketplace activity
          </span>

          <select
            value={activityFilter}
            onChange={(event) => setActivityFilter(event.target.value)}
            className="rr-input"
          >
            <option value="all">All activity</option>
            <option value="owner">Owners</option>
            <option value="renter">Renters</option>
            <option value="both">Owner + Renter</option>
            <option value="none">No activity</option>
          </select>
        </label>
      </div>

      <div className="text-sm text-slate-500">
        Showing {filteredUsers.length} of {users.length} users
      </div>

      {filteredUsers.length === 0 ? (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No users match your search.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Details</th>
                <th className="py-2 pr-4">Activity</th>
                <th className="py-2 pr-4">Actions</th>
                <th className="py-2 pr-4">Account</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 align-top">
                    <div className="flex min-w-[260px] items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-slate-300 bg-slate-100">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt={u.full_name || "User"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-semibold text-slate-500">
                            {(u.full_name || "U").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {u.full_name || "Unnamed user"}
                        </div>

                        <div className="text-xs text-slate-600">
                          {u.company_name ||
                            u.occupation ||
                            "No company or occupation"}
                        </div>

                        <div className="mt-1 break-all font-mono text-[10px] text-slate-400">
                          {u.id}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 pr-4 align-top">
                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-[11px] font-semibold">
                      {u.marketplace_activity === "both"
                        ? "Owner + Renter"
                        : u.marketplace_activity === "owner"
                          ? "Owner"
                          : u.marketplace_activity === "renter"
                            ? "Renter"
                            : "No activity"}
                    </span>
                  </td>

                  <td className="py-3 pr-4 align-top text-xs text-slate-600">
                    <div>
                      {[u.city, u.state].filter(Boolean).join(", ") ||
                        "Location not added"}
                    </div>

                    <div className="mt-1">
                      Joined{" "}
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "unknown"}
                    </div>
                  </td>

                  <td className="py-3 pr-4 align-top">
                    <div className="flex flex-col gap-2 text-xs">
                      <a
                        href={`/profile/${u.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View Profile
                      </a>

                      <a
                        href={`/admin/users/${u.id}/listings`}
                        className="text-slate-600 hover:text-black hover:underline"
                      >
                        View Listings
                      </a>

                      <a
                        href={`/admin/users/${u.id}/rentals`}
                        className="text-slate-600 hover:text-black hover:underline"
                      >
                        View Rentals
                      </a>
                    </div>
                  </td>

                  <td className="py-3 pr-4 align-top">
                    <span className="inline-flex items-center rounded-full border border-black bg-white px-3 py-1 text-[11px] font-semibold uppercase shadow-sm">
                      {u.role || "unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
