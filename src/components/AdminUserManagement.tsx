"use client";

import { useMemo, useState } from "react";

type AdminUser = {
  id: string;
  role?: string | null;
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
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
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

      return searchable.includes(query);
    });
  }, [search, users]);

  return (
    <div>
      <div className="mb-4">
        <label className="grid max-w-md gap-1">
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
                <th className="py-2 pr-4">Actions</th>
                <th className="py-2 pr-4">Role</th>
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
