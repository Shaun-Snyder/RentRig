import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyListingsClient from "@/components/MyListingsClient";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function DashboardNewListingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Show ONLY drafts here (create + publish from this page)
  // IMPORTANT: select("*") so operator/driver fields make it to the client
  const { data: listings, error } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_id", user.id)
    .eq("is_published", false)
    .order("created_at", { ascending: false });

if (error) {
  return (
    <div>
      <ServerHeader />
      <div style={{ padding: 24 }}>
        <PageHeader title="Create Listing" />
        <p style={{ marginTop: 12, color: "crimson" }}>
          Load failed: {error.message}
        </p>
        <div style={{ marginTop: 16 }}>
          <a href="/dashboard" style={{ textDecoration: "underline" }}>
            ← Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

  return (
    <div>
      <ServerHeader />

      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="rr-card p-4 mb-4">
  <PageHeader
    title="Create Listing"
    subtitle="Create and manage your draft listings before publishing."
  />
</div>
        <MyListingsClient listings={(listings ?? []) as any} showCreate={true} />
      </main>
    </div>
  );
}
