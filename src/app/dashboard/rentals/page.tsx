export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import RenterRentalsClient from "@/components/RenterRentalsClient";

export default async function RenterRentalsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) redirect("/login");
  const user = data.user;

  const { data: rentals } = await supabase
    .from("rentals")
    .select("id, listing_id, renter_id, start_date, end_date, status, buffer_days, message, created_at")
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });

  const listingIds = Array.from(new Set((rentals ?? []).map((r) => r.listing_id)));

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, city, state, price_per_day")
    .in("id", listingIds.length ? listingIds : ["00000000-0000-0000-0000-000000000000"]);

  const listingMap = new Map((listings ?? []).map((l) => [l.id, l]));

  const enriched = (rentals ?? []).map((r) => ({
    ...r,
    listing: listingMap.get(r.listing_id) ?? null,
  }));

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">My Rentals</h1>
        <p className="mt-2 text-slate-600">Your rental requests and their status.</p>

        <RenterRentalsClient rentals={enriched} />
      </main>
    </>
  );
}
