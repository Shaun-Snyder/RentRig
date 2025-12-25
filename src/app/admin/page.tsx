export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <p className="mt-2 text-slate-600">
          You are an admin. This page is protected.
        </p>

        <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">User ID</div>
          <div className="mt-2 font-mono text-sm break-all">{user.id}</div>

          <div className="mt-4 text-sm text-slate-500">Role</div>
          <div className="mt-2 font-medium">{profile.role}</div>
        </div>
      </main>
    </>
  );
}

