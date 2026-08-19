export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";

export default async function AdminListingsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData?.user) {
    redirect("/login");
  }

  const { data: adminProfile, error: adminError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (
    adminError ||
    !adminProfile ||
    adminProfile.role !== "admin"
  ) {
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

  const listingList = listings ?? [];

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4">
          <Link
            href="/admin"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            ← Back to Admin
          </Link>
        </div>

        <div className="rr-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Admin · Listings
          </div>

          <h1 className="mt-2 text-2xl font-bold">
            Marketplace Listings
          </h1>

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
            No listings found.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {listingList.map((listing: any) => (
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

                    <div className="mt-1 text-sm text-slate-500">
                      Owner:{" "}
                      {listing.owner?.full_name ||
                        listing.owner?.company_name ||
                        "Unknown owner"}
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
                        ? new Date(
                            listing.created_at,
                          ).toLocaleDateString()
                        : "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  <Link
                    href={`/listings/${listing.id}`}
                    className="rr-btn rr-btn-secondary rr-btn-sm"
                  >
                    View Listing
                  </Link>

                  <Link
                    href={`/profile/${listing.owner_id}`}
                    className="rr-btn rr-btn-secondary rr-btn-sm"
                  >
                    View Owner
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