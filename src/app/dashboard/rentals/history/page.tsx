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

  const { data: rentals, error: rentalsError } = await supabase
    .from("rentals")
    .select(
      `
      id,
      start_date,
      end_date,
      status,
      renter_returned,
      renter_rejection_acknowledged,
      buffer_days,
      message,
      created_at,
      inspections:rental_inspections!left(id, role),
      listing:listings ( id, title )
    `,
    )
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });

  if (rentalsError) {
    console.error("RenterHistoryPage rentalsError:", rentalsError);
  }

  const rentalsWithCondition = (rentals ?? [])
    .filter(
      (r: any) =>
        r.renter_returned === true ||
        (r.status === "rejected" && r.renter_rejection_acknowledged === true),
    )
    .map((r: any) => ({
      ...r,
      renter_condition_recorded: Array.isArray(r.inspections)
        ? r.inspections.some((ins: any) => ins.role === "renter")
        : false,
    }));

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="rr-card p-4 mb-4">
          <PageHeader
            title="Past Rentals"
            subtitle="Returned rentals and rental history."
          />
        </div>
        <div className="mt-2 mb-4">
          <a
            href="/dashboard/rentals"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            ← Back to current rentals
          </a>
        </div>

        <RenterRentalsClient rentals={rentalsWithCondition as any} />
      </main>
    </>
  );
}
