export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";

export default async function AdminUserListingsPage({
  params,
}: {
  params: { userId: string };
}) {
  const supabase = await createClient();

  // Make sure current user is logged in
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    redirect("/login");
  }

  // Make sure current user is an admin
  const { data: adminProfile, error: adminError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (adminError || !adminProfile || adminProfile.role !== "admin") {
    redirect("/dashboard");
  }

  // Load the user whose listings we're viewing
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, city, state")
    .eq("id", params.userId)
    .maybeSingle();

  // Load this user's listings
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select(
      "id, title, city, state, price_per_day, security_deposit, is_published, created_at",
    )
    .eq("owner_id", params.userId)
    .order("created_at", { ascending: false });

  const listingList = listings ?? [];

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="rr-btn rr-btn-secondary rr-btn-sm">
            ← Back to Admin
          </Link>

          {profile ? (
            <Link
              href={`/profile/${profile.id}`}
              className="rr-btn rr-btn-secondary rr-btn-sm"
            >
              View Profile
            </Link>
          ) : null}
        </div>

        <div className="rr-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Admin · User Listings
          </div>

          <h1 className="mt-2 text-2xl font-bold">
            {profile?.full_name || "Unnamed user"}
          </h1>

          <div className="mt-1 text-sm text-slate-600">
            {profile?.company_name || "No company"}
            {(profile?.city || profile?.state) && (
              <>
                {" · "}
                {[profile?.city, profile?.state].filter(Boolean).join(", ")}
              </>
            )}
          </div>

          <div className="mt-2 text-sm text-slate-500">
            {listingList.length}{" "}
            {listingList.length === 1 ? "listing" : "listings"}
          </div>
        </div>

        {listingsError ? (
          <div className="rr-card mt-4 p-5 text-red-600">
            Failed to load listings: {listingsError.message}
          </div>
        ) : listingList.length === 0 ? (
          <div className="rr-card mt-4 p-5 text-slate-600">
            This user has no listings.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {listingList.map((listing) => (
              <div key={listing.id} className="rr-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-bold text-slate-900">
                      {listing.title}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {[listing.city, listing.state]
                        .filter(Boolean)
                        .join(", ") || "Location not provided"}
                    </div>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      listing.is_published
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {listing.is_published ? "Published" : "Draft"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-slate-500">Daily Rate</div>
                    <div className="font-semibold">
                      ${Number(listing.price_per_day ?? 0).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">Security Deposit</div>
                    <div className="font-semibold">
                      ${Number(listing.security_deposit ?? 0).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">Created</div>
                    <div className="font-semibold">
                      {listing.created_at
                        ? new Date(listing.created_at).toLocaleDateString()
                        : "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <Link
                    href={`/listings/${listing.id}`}
                    className="rr-btn rr-btn-secondary rr-btn-sm"
                  >
                    View Listing
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
