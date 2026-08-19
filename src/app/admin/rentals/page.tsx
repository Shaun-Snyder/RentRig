export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import AdminRentalsManagement from "@/components/AdminRentalsManagement";

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

  const rentalsForManagement = rentalList.map((rental: any) => {
    const listing = listingMap.get(rental.listing_id);
    const owner = listing ? ownerMap.get(listing.owner_id) : null;

    return {
      id: rental.id,
      listing_id: rental.listing_id,
      renter_id: rental.renter_id,
      start_date: rental.start_date,
      end_date: rental.end_date,
      status: rental.status,
      created_at: rental.created_at,
      deposit_status: rental.deposit_status,
      deposit_refund_amount: rental.deposit_refund_amount,
      listingTitle: listing?.title ?? "Unknown listing",
      ownerName: owner?.full_name || owner?.company_name || "Unknown owner",
      renterName:
        rental.renter?.full_name ||
        rental.renter?.company_name ||
        "Unknown renter",
    };
  });

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
          <div className="mt-4">
            <AdminRentalsManagement rentals={rentalsForManagement} />
          </div>
        </div>
      </main>
    </>
  );
}
