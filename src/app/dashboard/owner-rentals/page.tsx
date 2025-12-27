export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import OwnerRentalsClient from "@/components/OwnerRentalsClient";

export default async function OwnerRentalsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) redirect("/login");
  const user = data.user;

  // Get all rentals where the listing is owned by this user
  const { data: rentals } = await supabase
    .from("rentals")
    .select("id, listing_id, renter_id, start_date, end_date, status, message, created_at")
    .order("created_at", { ascending: false });

  // Filter server-side using listings ownership (since RLS already prevents non-owner from seeing)
  // But Supabase will still only return allowed rows due to RLS.
  const listingIds = Array.from(new Set((rentals ?? []).map((r) => r.listing_id)));

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title")
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
        <h1 className="text-3xl font-semibold">Owner Requests</h1>
        <p className="mt-2 text-slate-600">Approve or reject rental requests for your listings.</p>

        <OwnerRentalsClient rentals={enriched} />
      </main>
    </>
  );
}
