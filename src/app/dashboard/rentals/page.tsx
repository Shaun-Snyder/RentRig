
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import { createClient } from "@/lib/supabase/server";
import RenterRentalsClient from "@/components/RenterRentalsClient";
import PageHeader from "@/components/PageHeader";

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
    console.error(rentalsError);
  }

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
  title="My Rentals"
  subtitle="Your rental requests and their status."
/>

        <RenterRentalsClient rentals={(rentals ?? []) as any} />
      </main>
    </>
  );
}
