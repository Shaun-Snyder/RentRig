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

  // Not logged in → go to login
  if (!user) redirect("/login");

  // ---------- PROFILE COMPLETENESS GATE ----------
  // Enforce this for ANY user based on their own profile row.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, phone, summary, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const hasFullName = !!profile?.full_name?.trim();
  const hasPhone = !!profile?.phone?.trim();
  const hasSummary = !!profile?.summary?.trim();
  const hasPhoto = !!profile?.avatar_url?.trim();

  const isProfileComplete =
    !profileError &&
    !!profile &&
    hasFullName &&
    hasPhone &&
    hasSummary &&
    hasPhoto;

  // If profile is missing OR any required field is empty,
  // send them back to the dashboard profile form.
  if (!isProfileComplete) {
    redirect("/dashboard");
  }
  // ------------------------------------------------

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

      <div style={{ padding: 24 }}>
        <PageHeader
          title="Create Listing"
          subtitle="Create a new listing, then publish when ready. Drafts only show here."
        />
        <MyListingsClient listings={(listings ?? []) as any} showCreate={true} />
      </div>
    </div>
  );
}
