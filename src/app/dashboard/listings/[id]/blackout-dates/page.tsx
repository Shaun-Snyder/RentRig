export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import BlackoutDatesEditor from "@/components/BlackoutDatesEditor";

export default async function BlackoutDatesPage({
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
    .select("id, title, owner_id")
    .eq("id", params.id)
    .single();

  if (listingError || !listing) {
    notFound();
  }

  if (listing.owner_id !== user.id) {
    redirect("/dashboard/listings");
  }

  const { data: blackoutDates, error: blackoutError } = await supabase
    .from("listing_blackout_dates")
    .select("id, blackout_date")
    .eq("listing_id", listing.id)
    .order("blackout_date", { ascending: true });

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
            Blackout Dates
          </div>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {listing.title}
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Mark dates when this listing is unavailable for rental.
          </p>
        </div>

        <div className="rr-card mt-4 p-5">
          <div className="text-lg font-semibold text-slate-900">
            Unavailable Dates
          </div>

          {blackoutError ? (
            <div className="mt-4 text-sm text-red-600">
              Failed to load blackout dates: {blackoutError.message}
            </div>
          ) : (
            <BlackoutDatesEditor
              listingId={listing.id}
              initialBlackoutDates={blackoutDates ?? []}
            />
          )}
        </div>
      </main>
    </>
  );
}
