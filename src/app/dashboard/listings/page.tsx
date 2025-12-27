export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import MyListingsClient from "@/components/MyListingsClient";

export default async function MyListingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, description, city, state, price_per_day, is_published, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">My Listings</h1>
        <p className="mt-2 text-slate-600">Create, publish, and manage your equipment/rig listings.</p>

        <MyListingsClient listings={listings ?? []} />
      </main>
    </>
  );
}
