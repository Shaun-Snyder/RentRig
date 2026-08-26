export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import HourlyAvailabilityEditor from "@/components/HourlyAvailabilityEditor";

export default async function HourlyAvailabilityPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    redirect("/login");
  }

  const user = authData.user;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      owner_id,
      rental_hourly_enabled,
      rental_hour_rate
    `,
    )
    .eq("id", params.id)
    .single();

  if (listingError || !listing) {
    notFound();
  }

  if (listing.owner_id !== user.id) {
    redirect("/dashboard/listings");
  }

  const { data: availability, error: availabilityError } = await supabase
    .from("listing_hourly_availability")
    .select("id, weekday, start_time, end_time")
    .eq("listing_id", listing.id)
    .order("weekday", { ascending: true });

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-4">
          <Link
            href="/dashboard/listings"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            ← Back to My Listings
          </Link>
        </div>

        <div className="rr-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hourly Availability
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {listing.title}
          </h1>

          <div className="mt-2 text-sm text-slate-600">
            Hourly rental:{" "}
            {listing.rental_hourly_enabled ? "Enabled" : "Disabled"}
          </div>

          <div className="mt-1 text-sm text-slate-600">
            Hourly rate: ${Number(listing.rental_hour_rate ?? 0).toFixed(2)} /
            hour
          </div>
        </div>

        <div className="rr-card mt-4 p-5">
          <div className="text-lg font-semibold text-slate-900">
            Weekly Working Hours
          </div>

          <p className="mt-1 text-sm text-slate-600">
            Set the hours this listing can accept hourly rentals each week.
          </p>

          {availabilityError ? (
            <div className="mt-4 text-sm text-red-600">
              Failed to load hourly availability: {availabilityError.message}
            </div>
          ) : (
            <HourlyAvailabilityEditor
              listingId={listing.id}
              availability={availability ?? []}
            />
          )}
        </div>
      </main>
    </>
  );
}
