export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";

export default async function AdminUserRentalsPage({
  params,
}: {
  params: { userId: string };
}) {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, city, state")
    .eq("id", params.userId)
    .maybeSingle();

  const { data: renterRentals, error: renterError } = await supabase
    .from("rentals")
    .select(
      `
      id,
      listing_id,
      renter_id,
      start_date,
      end_date,
      status,
      created_at,
      listing:listings (
        id,
        title,
        owner_id
      )
    `,
    )
    .eq("renter_id", params.userId)
    .order("created_at", { ascending: false });

  const { data: ownerListings, error: ownerListingsError } = await supabase
    .from("listings")
    .select("id")
    .eq("owner_id", params.userId);

  const ownerListingIds = (ownerListings ?? []).map((l) => l.id);

  const { data: ownerRentals, error: ownerRentalsError } =
    ownerListingIds.length > 0
      ? await supabase
          .from("rentals")
          .select(
            `
            id,
            listing_id,
            renter_id,
            start_date,
            end_date,
            status,
            created_at,
            listing:listings (
              id,
              title,
              owner_id
            ),
            renter:profiles!rentals_renter_id_fkey (
              id,
              full_name
            )
          `,
          )
          .in("listing_id", ownerListingIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

  const combined = [
    ...(renterRentals ?? []).map((r: any) => ({
      ...r,
      relationship: "Renter",
    })),
    ...(ownerRentals ?? []).map((r: any) => ({
      ...r,
      relationship: "Owner",
    })),
  ].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;

    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

    return bTime - aTime;
  });

  const loadError = renterError || ownerListingsError || ownerRentalsError;

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
            Admin · User Rentals
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
            {combined.length}{" "}
            {combined.length === 1 ? "rental record" : "rental records"}
          </div>
        </div>

        {loadError ? (
          <div className="rr-card mt-4 p-5 text-red-600">
            Failed to load rental history.
          </div>
        ) : combined.length === 0 ? (
          <div className="rr-card mt-4 p-5 text-slate-600">
            This user has no rental history.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {combined.map((r: any) => (
              <div key={`${r.relationship}-${r.id}`} className="rr-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-bold text-slate-900">
                      {r.listing?.title || "Listing"}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {r.start_date} → {r.end_date}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      {r.relationship}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        r.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : r.status === "completed"
                            ? "bg-blue-100 text-blue-800"
                            : r.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {String(r.status ?? "unknown").replaceAll("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-slate-500">Rental ID</div>
                    <div className="break-all font-mono text-xs">{r.id}</div>
                  </div>

                  <div>
                    <div className="text-slate-500">Created</div>
                    <div className="font-semibold">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString()
                        : "Unknown"}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">
                      {r.relationship === "Owner" ? "Renter" : "Role"}
                    </div>

                    <div className="font-semibold">
                      {r.relationship === "Owner"
                        ? r.renter?.full_name || "Unnamed renter"
                        : "Renter"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  {r.relationship === "Owner" ? (
                    <Link
                      href={`/dashboard/owner-rentals/${r.id}`}
                      className="rr-btn rr-btn-secondary rr-btn-sm"
                    >
                      View Rental
                    </Link>
                  ) : (
                    <Link
                      href={`/dashboard/rentals/${r.id}`}
                      className="rr-btn rr-btn-secondary rr-btn-sm"
                    >
                      View Rental
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
