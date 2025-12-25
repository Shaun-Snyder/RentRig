export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", user.id)
    .single();

  const email = profile?.email || user.email || "(no email)";
  const fullName = profile?.full_name || "(no name set)";
  const role = profile?.role || "user";

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-slate-600">Welcome back.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ProfileForm initialFullName={profile?.full_name || ""} />

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Email</div>
            <div className="mt-2 font-medium">{email}</div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Role</div>
            <div className="mt-2 font-medium">{role}</div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">User ID</div>
            <div className="mt-2 font-mono text-sm break-all">{user.id}</div>
          </div>
        </div>
      </main>
    </>
  );
}


