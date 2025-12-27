export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import MyRentalsClient from "@/components/MyRentalsClient";

export default async function MyRentalsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) redirect("/login");
  const user = data.user;

  const { data: rentals, error: rentalsError } = await supabase
    .from("rentals")
    .select(
      `
      id,
      listing_id,
      renter_id,
      start_date,
      end_date,
      status,
      buffer_days,
      message,
      created_at,
      listing:listings ( id, title )
    `
    )
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });

  if (rentalsError) {
    // Don’t crash the page; show empty list
    console.error(rentalsError);
  }

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">My Rentals</h1>
        <p className="mt-2 text-slate-600">Your rental requests and their status.</p>

        <MyRentalsClient rentals={(rentals ?? []) as any} />
      </main>
    </>
  );
}
