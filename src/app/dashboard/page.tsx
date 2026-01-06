export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import PageHeader from "@/components/PageHeader";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, phone")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "user";
  const email = user.email ?? "(no email)";

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1
  className="
    text-4xl font-extrabold text-black
    [text-shadow:_2px_2px_0_#fff,_-2px_2px_0_#fff,_2px_-2px_0_#fff,_-2px_-2px_0_#fff]
  "
>
  Dashboard
</h1>


<div className="mt-6 flex flex-wrap gap-3">
  <a
    href="/dashboard/listings"
    className="rounded-lg border rr-card px-4 py-2 shadow-sm hover:bg-slate-50"
  >
    My Listings
  </a>

<a
  href="/dashboard/listings/new"
  className="rounded-lg border rr-card px-4 py-2 shadow-sm hover:bg-slate-50"
>
  Create Listing
</a>

  <a
    href="/dashboard/rentals"
    className="rounded-lg border rr-card px-4 py-2 shadow-sm hover:bg-slate-50"
  >
    My Rentals
  </a>

  <a
    href="/dashboard/owner-rentals"
    className="rounded-lg border rr-card px-4 py-2 shadow-sm hover:bg-slate-50"
  >
    Owner Requests
  </a>

  <a
    href="/listings"
    className="rounded-lg border rr-card px-4 py-2 shadow-sm hover:bg-slate-50"
  >
    Browse Listings
  </a>
</div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-5 rr-card shadow-sm">
            <div className="text-sm text-slate-500">Email</div>
            <div className="mt-2 font-medium">{email}</div>
          </div>

          <div className="rounded-xl border p-5 rr-card shadow-sm">
            <div className="text-sm text-slate-500">Role</div>
            <div className="mt-2 font-medium">{role}</div>
          </div>

          <div className="rounded-xl border p-5 rr-card shadow-sm md:col-span-2">
            <div className="text-sm text-slate-500">User ID</div>
            <div className="mt-2 font-mono text-sm break-all">{user.id}</div>
          </div>
        </div>

        <div className="mt-10">
          <ProfileForm
            initialFullName={profile?.full_name ?? ""}
            initialPhone={profile?.phone ?? ""}
          />
        </div>
      </main>
    </>
  );
}

