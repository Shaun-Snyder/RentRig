export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Server action to update a user's role
async function updateUserRoleAction(formData: FormData) {
  "use server";

  const supabase = await createClient();

  // Ensure the caller is logged in
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const user = data.user;

  // Ensure the caller is an admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { ok: false, error: "Not authorized" };
  }

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!userId) {
    return { ok: false, error: "Missing user_id" };
  }

  if (!["admin", "owner", "renter"].includes(role)) {
    return { ok: false, error: "Invalid role" };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Refresh this page so the role list updates
  revalidatePath("/admin");
  return { ok: true };
}

export default async function AdminPage() {
  const supabase = await createClient();

  // Current user
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  // Current user's profile/role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  // All profiles for user management (minimal fields to avoid column issues)
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, role, full_name, company_name, city, state, occupation, phone, avatar_url, created_at",
    )
    .order("created_at", { ascending: false });

  // If this fails, we still render the page but show an error message
  const userList = Array.isArray(profiles) ? profiles : [];

  const totalUsers = userList.length;

  const { count: listingsCount } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true });

  const { count: rentalsCount } = await supabase
    .from("rentals")
    .select("*", { count: "exact", head: true });

  const adminCount = userList.filter((p: any) => p.role === "admin").length;

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        {/* Current admin info (existing behavior) */}
        <section>
          <h1 className="text-3xl font-semibold">Admin</h1>
          <p className="mt-2 text-slate-600">
            Monitor users, listings, rentals, and manage marketplace activity.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="text-xs uppercase text-slate-500">
                Total Users
              </div>
              <div className="mt-2 text-3xl font-bold">{totalUsers}</div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="text-xs uppercase text-slate-500">Listings</div>
              <div className="mt-2 text-3xl font-bold">
                {listingsCount ?? 0}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="text-xs uppercase text-slate-500">Rentals</div>
              <div className="mt-2 text-3xl font-bold">{rentalsCount ?? 0}</div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="text-xs uppercase text-slate-500">Admins</div>
              <div className="mt-2 text-3xl font-bold">{adminCount}</div>
            </div>
          </div>
        </section>

        {/* User management section */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">User management</h2>
              <p className="mt-1 text-sm text-slate-600">
                View all profiles and update roles. This uses the same{" "}
                <code className="font-mono text-xs">profiles</code> table that
                powers the rest of the app.
              </p>
            </div>
          </div>

          {profilesError && (
            <p className="mt-3 text-sm text-red-600">
              Failed to load profiles: {profilesError.message}
            </p>
          )}

          {userList.length === 0 && !profilesError ? (
            <p className="mt-3 text-sm text-slate-600">
              No profiles found yet.
            </p>
          ) : null}

          {userList.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Details</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Actions</th>
                    <th className="py-2 pr-4">Change role</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((u: any) => (
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
                            ? new Date(u.created_at).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
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

                      <td className="py-2 pr-4 align-top">
                        <span className="inline-flex items-center rounded-full border border-black bg-white px-3 py-1 text-[11px] font-semibold uppercase shadow-sm">
                          {u.role || "unknown"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <form
                          action={updateUserRoleAction}
                          className="flex flex-wrap items-center gap-2 text-xs"
                        >
                          <input type="hidden" name="user_id" value={u.id} />

                          <select
                            name="role"
                            defaultValue={u.role ?? "renter"}
                            className="rr-input w-32 text-xs"
                          >
                            <option value="renter">Renter</option>
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                          </select>

                          <button
                            type="submit"
                            className="rr-btn rr-btn-secondary rr-btn-sm"
                          >
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-[11px] text-slate-500">
            Note: true &quot;disable account&quot; and in-app error logs will
            require a small schema update (for example, adding a{" "}
            <code className="font-mono">disabled</code> flag or an{" "}
            <code className="font-mono">app_logs</code> table). We can add that
            next without touching your existing flows.
          </p>
        </section>
      </main>
    </>
  );
}
