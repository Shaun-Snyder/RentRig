export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

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
    .select(
      "role, full_name, company_name, city, state, occupation, phone, avatar_url, profile_summary, created_at",
    )
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "user";
  const email = user.email ?? "(no email)";

  const { count: activeListingsCount, error: activeListingsError } =
    await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("is_published", true);

  if (activeListingsError) {
    console.warn("Active listings count failed:", activeListingsError.message);
  }

  // -------- Owner Requests count (reuse OwnerRentals logic) --------

  // Step 1: get rentals visible for this user (RLS should already limit by listing owner)
  const { data: rentalsRaw, error: rentalsError } = await supabase
    .from("rentals")
    .select("id, listing_id, status, created_at")
    .order("created_at", { ascending: false });

  if (rentalsError) {
    console.warn(
      "Owner rentals load failed on dashboard:",
      rentalsError.message,
    );
  }

  const rentals: OwnerRequestRow[] = rentalsRaw ?? [];

  // Step 2: collect listing_ids and load listings with their owner_id
  const listingIds = Array.from(new Set(rentals.map((r) => r.listing_id)));

  const { data: listingsRaw, error: listingsError } = await supabase
    .from("listings")
    .select("id, owner_id")
    .in(
      "id",
      listingIds.length ? listingIds : ["00000000-0000-0000-0000-000000000000"],
    );

  if (listingsError) {
    console.warn("Listings load failed on dashboard:", listingsError.message);
  }

  const listings: ListingRow[] = listingsRaw ?? [];

  // Step 3: ensure listing belongs to current owner (same as OwnerRentalsPage)
  const ownedListings = listings.filter((l) => l.owner_id === user.id);
  const listingMap = new Map(ownedListings.map((l) => [l.id, l]));

  const ownerRequests: OwnerRequestRow[] = rentals.filter((r) =>
    listingMap.has(r.listing_id),
  );

  // Step 4: statuses that mean "needs owner action"
  const ATTENTION_STATUSES = ["pending", "requested", "owner_pending"];

  const pendingCount = ownerRequests.filter(
    (r) => r.status && ATTENTION_STATUSES.includes(r.status),
  ).length;

  // ---------------------------------------------------------------

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-2">
        <div className="mb-4 rr-card p-4">
          <h1
            className="
      text-4xl font-extrabold text-black
      [text-shadow:_2px_2px_0_#fff,_-2px_2px_0_#fff,_2px_-2px_0_#fff,_-2px_-2px_0_#fff]
    "
          >
            Dashboard
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Manage your profile, listings, rentals, messages, and account
            settings.
          </p>
        </div>

        {/* Popup-style alert when there are owner requests needing action */}
        {pendingCount > 0 && (
          <div className="mt-2 rounded-none border p-4 rr-card shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-semibold text-slate-500 tracking-wide">
                  Rental Requests
                </div>
                <p className="mt-2 text-sm text-slate-800">
                  You have <span className="font-semibold">{pendingCount}</span>{" "}
                  rental {pendingCount === 1 ? "request" : "requests"} waiting
                  for your review.
                </p>
              </div>

              <a
                href="/dashboard/owner-rentals"
                className="rr-btn rr-btn-secondary"
              >
                Rental Requests ({pendingCount})
              </a>
            </div>
          </div>
        )}

        {/* PROFILE BUBBLE AT TOP */}
        <div className="mt-4">
          <ProfileForm
            initialFullName={profile?.full_name ?? ""}
            initialCompanyName={profile?.company_name ?? ""}
            initialCity={profile?.city ?? ""}
            initialState={profile?.state ?? ""}
            initialOccupation={profile?.occupation ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialAvatarUrl={profile?.avatar_url ?? ""}
            initialSummary={profile?.profile_summary ?? ""}
            initialMemberSince={profile?.created_at ?? ""}
            initialActiveListings={activeListingsCount ?? 0}
          />
        </div>

        {/* INFO BUBBLES UNDER PROFILE */}
        <div className="mt-4 space-y-2">
          <div className="rounded-none border p-4 rr-card shadow-sm">
            <div className="text-xs font-semibold text-slate-500 tracking-wide">
              Account Info
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="mt-1 font-medium break-all">{email}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Role</div>
                <div className="mt-1 font-medium">{role}</div>
              </div>

              <div className="sm:col-span-2">
                <div className="text-xs text-slate-500">Account ID</div>
                <div className="mt-1 font-mono text-xs break-all opacity-60">
                  {user.id}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-none border p-4 rr-card shadow-sm">
            <div className="text-xs font-semibold text-slate-500 tracking-wide">
              Help & Info
            </div>

            <div className="mt-2 flex gap-2 flex-wrap">
              <a href="/faq" className="rr-btn rr-btn-secondary">
                FAQ
              </a>

              <a href="/legal" className="rr-btn rr-btn-secondary">
                Legal
              </a>

              <a href="/contact" className="rr-btn rr-btn-secondary">
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
