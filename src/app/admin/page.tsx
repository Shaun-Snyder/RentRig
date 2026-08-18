export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import AdminUserManagement from "@/components/AdminUserManagement";

// Server action to update a user's role
async function updateUserRoleAction(formData: FormData): Promise<void> {
  "use server";

  const supabase = await createClient();

  // Ensure the caller is logged in
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return;
  }

  const user = data.user;

  // Ensure the caller is an admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return;
  }

  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!userId) {
    return;
  }

  if (!["admin", "owner", "renter"].includes(role)) {
    return;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (updateError) {
    console.error("Admin role update failed:", updateError.message);
    return;
  }

  // Refresh this page so the role list updates
  revalidatePath("/admin");
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
              <div className="mt-4">
                <AdminUserManagement users={userList} />
              </div>
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
