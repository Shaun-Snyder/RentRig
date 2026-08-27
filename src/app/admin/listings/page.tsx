export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import AdminListingsManagement from "@/components/AdminListingsManagement";

export default async function AdminListingsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    redirect("/login");
  }

  const { data: adminProfile, error: adminError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (adminError || !adminProfile || adminProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      owner_id,
      city,
      state,
      price_per_day,
      security_deposit,
      is_published,
      created_at,
      owner:profiles!listings_owner_id_fkey (
        id,
        full_name,
        company_name
      )
    `,
    )
    .order("created_at", { ascending: false });

  const listingList = (listings ?? []).map((listing) => ({
    ...listing,
    owner: Array.isArray(listing.owner)
      ? (listing.owner[0] ?? null)
      : listing.owner,
  }));

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4">
          <Link href="/admin" className="rr-btn rr-btn-secondary rr-btn-sm">
            ← Back to Admin
          </Link>
        </div>

        <div className="rr-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Admin · Listings
          </div>

          <h1 className="mt-2 text-2xl font-bold">Marketplace Listings</h1>

          <div className="mt-2 text-sm text-slate-500">
            {listingList.length}{" "}
            {listingList.length === 1 ? "listing" : "listings"}
          </div>
          <div className="mt-4">
            {listingsError ? (
              <div className="mt-4 text-sm text-red-600">
                Failed to load listings: {listingsError.message}
              </div>
            ) : null}
            <AdminListingsManagement listings={listingList} />
          </div>
        </div>
      </main>
    </>
  );
}
