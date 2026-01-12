

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import PageHeader from "@/components/PageHeader";

type OwnerRequestRow = {
  id: string;
  listing_id: string;
  status: string | null;
};

type ListingRow = {
  id: string;
  owner_id: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, phone, avatar_url, profile_summary")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "user";
  const email = user.email ?? "(no email)";

  // -------- Owner Requests count (reuse OwnerRentals logic) --------

  // Step 1: get rentals visible for this user (RLS should already limit by listing owner)
  const {
    data: rentalsRaw,
    error: rentalsError,
  } = await supabase
    .from("rentals")
    .select("id, listing_id, status, created_at")
    .order("created_at", { ascending: false });

  if (rentalsError) {
    console.warn("Owner rentals load failed on dashboard:", rentalsError.message);
  }

  const rentals: OwnerRequestRow[] = rentalsRaw ?? [];

  // Step 2: collect listing_ids and load listings with their owner_id
  const listingIds = Array.from(new Set(rentals.map((r) => r.listing_id)));

  const { data: listingsRaw, error: listingsError } = await supabase
    .from("listings")
    .select("id, owner_id")
    .in(
      "id",
      listingIds.length
        ? listingIds
        : ["00000000-0000-0000-0000-000000000000"]
    );

  if (listingsError) {
    console.warn("Listings load failed on dashboard:", listingsError.message);
  }

  const listings: ListingRow[] = listingsRaw ?? [];

  // Step 3: ensure listing belongs to current owner (same as OwnerRentalsPage)
  const ownedListings = listings.filter((l) => l.owner_id === user.id);
  const listingMap = new Map(ownedListings.map((l) => [l.id, l]));

  const ownerRequests: OwnerRequestRow[] = rentals.filter((r) =>
    listingMap.has(r.listing_id)
  );

  // Step 4: statuses that mean "needs owner action"
  const ATTENTION_STATUSES = ["pending", "requested", "owner_pending"];

  const pendingCount = ownerRequests.filter(
    (r) => r.status && ATTENTION_STATUSES.includes(r.status)
  ).length;

  // ---------------------------------------------------------------

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1
          className="
            text-4xl font-extrabold text-black
            [text-shadow:_2px_2px_0_#fff,_-2px_2px_0_#fff,_2px_-2px_0_#fff,_-2px_-2px_0_#fff]
          "
        >
          Dashboard
        </h1>

        {/* Popup-style alert when there are owner requests needing action */}
        {pendingCount > 0 && (
          <div className="mt-6 rr-card border-l-4 border-yellow-400 bg-yellow-50 p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-800">
              You have{" "}
              <span className="font-semibold">{pendingCount}</span>{" "}
              rental {pendingCount === 1 ? "request" : "requests"} waiting for
              your review.
            </p>

            <a
              href="/dashboard/owner-rentals"
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
            >
              Owner Requests
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1">
                {pendingCount}
              </span>
            </a>
          </div>
        )}

        

        {/* PROFILE BUBBLE AT TOP */}
        <div className="mt-8">
          <ProfileForm
            initialFullName={profile?.full_name ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialAvatarUrl={profile?.avatar_url ?? ""}
            initialSummary={profile?.profile_summary ?? ""}
          />
        </div>

        {/* INFO BUBBLES UNDER PROFILE */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-5 rr-card shadow-sm">
            <div className="text-sm text-slate-500">Email</div>
            <div className="mt-2 font-medium">{email}</div>
          </div>

          <div className="rounded-xl border p-5 rr-card shadow-sm">
            <div className="text-sm text-slate-500">Role</div>
            <div className="mt-2 font-medium">{role}</div>
          </div>

          <div className="rounded-xl border p-5 rr-card shadow-sm md:col-span-2">
            <div className="text-sm text-slate-500">User ID</div>
            <div className="mt-2 font-mono text-sm break-all">{user.id}</div>
          </div>
        </div>
      </main>
    </>
  );
}
