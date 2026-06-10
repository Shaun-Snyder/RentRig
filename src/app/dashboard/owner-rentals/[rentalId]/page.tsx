export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerRentalDetailsPage({
  params,
}: {
  params: { rentalId: string };
}) {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) redirect("/login");
  const user = authData.user;

  const { data: rental, error } = await supabase
    .from("rentals")
    .select(
      `
        id,
        listing_id,
        renter_id,
        start_date,
        end_date,
        status,
        renter_returned,
        message,
        created_at,
        listing:listings ( id, title, owner_id ),
        renter:profiles!rentals_renter_id_fkey (
          id,
          full_name,
          company_name
        )
      `
    )
    .eq("id", params.rentalId)
    .maybeSingle();

  if (error) {
    console.error("OwnerRentalDetailsPage error:", error);
  }

  if (!rental || rental.listing?.owner_id !== user.id) {
    notFound();
  }

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="mb-4">
          <Link
            href="/dashboard/owner-rentals"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            ← Back to Owner Requests
          </Link>
        </div>

        <div className="rr-card p-4 mb-4">
  <PageHeader
    title="Rental Details"
    subtitle="Full rental details for this request."
  />
</div>
<div className="grid gap-4">
  <div className="grid gap-4 md:grid-cols-2">
    <div className="rr-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Rental Information
      </div>

      <div className="mt-3 text-xl font-bold">
        {rental.listing?.title ?? "Listing"}
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-700">
        <div>
          <span className="font-semibold">Dates:</span>{" "}
          {rental.start_date} → {rental.end_date}
        </div>

        <div>
          <span className="font-semibold">Status:</span>{" "}
          <span className="capitalize">{rental.status}</span>
        </div>

        <div>
          <span className="font-semibold">Return:</span>{" "}
          {rental.renter_returned ? "Returned" : "Not returned"}
        </div>
      </div>
    </div>

    <div className="rr-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Renter Information
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-700">
        <div>
          <span className="font-semibold">Name:</span>{" "}
          {rental.renter?.full_name ?? "Renter"}
        </div>

        <div>
          <span className="font-semibold">Company:</span>{" "}
          {rental.renter?.company_name ?? "Not provided"}
        </div>
      </div>
    </div>
  </div>

  {rental.message && (
    <div className="rr-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Request Message
      </div>

      <div className="mt-3 text-sm text-slate-700">
        {rental.message}
      </div>
    </div>
  )}

  <div className="rr-card p-4">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      Actions
    </div>

    <div className="mt-3 flex flex-wrap gap-3">
      <a
        href={`/api/invoice?rental_id=${rental.id}`}
        target="_blank"
        className="rr-btn rr-btn-primary"
      >
        Download Invoice
      </a>

      <Link
        href={`/dashboard/messages/${rental.id}`}
        className="rr-btn rr-btn-secondary"
      >
        Open Messages
      </Link>

      <Link
        href={`/dashboard/owner-rentals/${rental.id}/inspection`}
        className="rr-btn rr-btn-secondary"
      >
        Record / View Condition
      </Link>
    </div>
  </div>
</div>
             </main>
    </>
  );
}