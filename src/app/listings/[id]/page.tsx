export const dynamic = "force-dynamic";

import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import RentalRequestForm from "@/components/RentalRequestForm";

export default async function ListingPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const id = params.id;

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, description, city, state, price_per_day, is_published, created_at")
    .eq("id", id)
    .single();

  const { data: approvedRentals } = await supabase
    .from("rentals")
    .select("start_date, end_date, buffer_days, status")
    .eq("listing_id", id)
    .eq("status", "approved");

  if (!listing) {
    return (
      <>
        <ServerHeader />
        <main className="mx-auto max-w-5xl px-6 py-10">
          <h1 className="text-2xl font-semibold">Listing not found</h1>
        </main>
      </>
    );
  }

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">{listing.title}</h1>
        <p className="mt-2 text-slate-600">
          ${Number(listing.price_per_day).toFixed(2)}/day
          {listing.city || listing.state
            ? ` • ${[listing.city, listing.state].filter(Boolean).join(", ")}`
            : ""}
        </p>

        {listing.description && (
          <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm text-slate-700">
            {listing.description}
          </div>
        )}

        <div className="mt-10">
          {listing.is_published ? (
            <RentalRequestForm listingId={id} blocked={approvedRentals ?? []} />
          ) : (
            <p className="text-slate-600">This listing is not published.</p>
          )}
        </div>
      </main>
    </>
  );
}
