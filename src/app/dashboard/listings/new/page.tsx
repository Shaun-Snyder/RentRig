import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyListingsClient from "@/components/MyListingsClient";
import ServerHeader from "@/components/ServerHeader";

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
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Create Listing</h1>
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

      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
     

          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Create Listing
          </h1>
        </div>

        <p style={{ marginTop: 6, color: "#64748b" }}>
          Create a new listing, then publish when ready. Drafts only show here.
        </p>

        <MyListingsClient listings={(listings ?? []) as any} showCreate={true} />
      </div>
    </div>
  );
}
