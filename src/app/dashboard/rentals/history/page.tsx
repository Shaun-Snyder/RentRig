export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import RenterRentalsClient from "@/components/RenterRentalsClient";

export default async function RenterHistoryPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) redirect("/login");
  const user = data.user;

  // Today as YYYY-MM-DD (server time)
  const today = new Date().toISOString().slice(0, 10);

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
    .lt("end_date", today) // only rentals that have ended
    .order("end_date", { ascending: false });

  if (rentalsError) {
    console.error("RenterHistoryPage rentalsError:", rentalsError);
  }

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title="Past rentals"
          subtitle="Completed rentals and their history."
        />

        <div className="mt-2 mb-4">
          <a href="/dashboard/rentals" className="rr-btn rr-btn-secondary rr-btn-sm">
            ← Back to current rentals
          </a>
        </div>

        <RenterRentalsClient rentals={(rentals ?? []) as any} />
      </main>
    </>
  );
}
