export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";

export default async function AdminRentalsPage() {
  const supabase = await createClient();

  // Require logged-in admin
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

  // Load all rentals
  const { data: rentals, error: rentalsError } = await supabase
    .from("rentals")
    .select(
      [
        "id",
        "listing_id",
        "renter_id",
        "start_date",
        "end_date",
        "status",
        "renter_returned",
        "created_at",
        "deposit_status",
        "deposit_refund_amount",
        "renter:profiles!rentals_renter_id_fkey(id, full_name, avatar_url, company_name)",
      ].join(", "),
    )
    .order("created_at", { ascending: false });

  const rentalList = rentals ?? [];

  // Load listings so we can show equipment title and owner
  const listingIds = Array.from(
    new Set(rentalList.map((r: any) => r.listing_id).filter(Boolean)),
  );

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, owner_id")
    .in(
      "id",
      listingIds.length ? listingIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const ownerIds = Array.from(
    new Set(
      (listings ?? []).map((listing: any) => listing.owner_id).filter(Boolean),
    ),
  );

  const { data: owners, error: ownersError } = await supabase
    .from("profiles")
    .select("id, full_name, company_name")
    .in(
      "id",
      ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const listingMap = new Map(
    (listings ?? []).map((listing: any) => [listing.id, listing]),
  );

  const ownerMap = new Map(
    (owners ?? []).map((owner: any) => [owner.id, owner]),
  );

  const loadError = rentalsError || listingsError || ownersError;

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
            Admin · Rentals
          </div>

          <h1 className="mt-2 text-2xl font-bold">Marketplace Rentals</h1>

          <div className="mt-2 text-sm text-slate-500">
            {rentalList.length} {rentalList.length === 1 ? "rental" : "rentals"}
          </div>
        </div>

        {loadError ? (
          <div className="rr-card mt-4 p-5 text-red-600">
            Failed to load rental information.
          </div>
        ) : rentalList.length === 0 ? (
          <div className="rr-card mt-4 p-5 text-slate-600">
            No rentals found.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {rentalList.map((rental: any) => {
              const listing = listingMap.get(rental.listing_id);
              const owner = listing ? ownerMap.get(listing.owner_id) : null;

              return (
                <div key={rental.id} className="rr-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-bold text-slate-900">
                        {listing?.title || "Unknown listing"}
                      </div>

                      <div className="mt-1 text-sm text-slate-600">
                        {rental.start_date} → {rental.end_date}
                      </div>
                    </div>

                    <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold capitalize">
                      {String(rental.status ?? "unknown").replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                    <div>
                      <div className="text-slate-500">Owner</div>
                      <div className="font-semibold">
                        {owner?.full_name ||
                          owner?.company_name ||
                          "Unknown owner"}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Renter</div>
                      <div className="font-semibold">
                        {rental.renter?.full_name ||
                          rental.renter?.company_name ||
                          "Unknown renter"}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Created</div>
                      <div className="font-semibold">
                        {rental.created_at
                          ? new Date(rental.created_at).toLocaleDateString()
                          : "Unknown"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="break-all font-mono text-[10px] text-slate-400">
                      Rental ID: {rental.id}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
