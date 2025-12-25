
export const dynamic = "force-dynamic";

import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  // If profile row is missing or query fails, send back
  if (error || !profile) {
    redirect("/dashboard");
  }

  // Admin gate
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <p className="mt-2 text-slate-600">You have admin access. ✅</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Full name</div>
            <div className="mt-2 font-medium">
              {profile.full_name || "(not set)"}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Role</div>
            <div className="mt-2 font-medium">{profile.role}</div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm md:col-span-2">
            <div className="text-sm text-slate-500">User ID</div>
            <div className="mt-2 font-mono text-sm break-all">{user.id}</div>
          </div>
        </div>
      </main>
    </>
  );
}
