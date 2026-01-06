
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyListingsClient from "@/components/MyListingsClient";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function DashboardListingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // IMPORTANT: select("*") so operator/driver fields make it to the client
  const { data: listings, error } = await supabase
  .from("listings")
  .select("*")
  .eq("owner_id", user.id)
  .eq("is_published", true)
  .order("created_at", { ascending: false });

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>My Listings</h1>
        <p style={{ marginTop: 12, color: "crimson" }}>Load failed: {error.message}</p>
      </div>
    );
  }

  return (
  <div>
    <ServerHeader />

    <div style={{ padding: 24 }}>
      <PageHeader
  title="My Listings"
  subtitle="Create, publish, and manage your equipment/rig listings."
/>

      <MyListingsClient listings={(listings ?? []) as any} showCreate={false} />
        </div>
  </div>
);
}

