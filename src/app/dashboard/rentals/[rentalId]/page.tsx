export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";

export default async function RentalDetailsPage({
  params,
}: {
  params: { rentalId: string };
}) {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) redirect("/login");
  const user = authData.user;

  const { data: rental, error: rentalError } = await supabase
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
        buffer_days,

        deposit_status,
        deposit_damage_deduction,
        deposit_cleaning_deduction,
        deposit_fuel_deduction,
        deposit_late_return_deduction,
        deposit_other_deduction,
        deposit_other_reason,
        deposit_renter_explanation,
        deposit_refund_amount,
        deposit_refunded_at,

        message,
        created_at,
                listing:listings (
          id,
          title,
          city,
          state,
          price_per_day,
          security_deposit
        )
      `,
    )
    .eq("id", params.rentalId)
    .eq("renter_id", user.id)
    .maybeSingle();

  if (rentalError) {
    console.error("RentalDetailsPage rentalError:", rentalError);
  }

  if (!rental) {
    notFound();
  }

  const listing = Array.isArray(rental.listing)
    ? (rental.listing[0] ?? null)
    : rental.listing;

  let thumbUrl: string | null = null;

  if (rental.listing_id) {
    const { data: photos, error: photosError } = await supabase
      .from("listing_photos")
      .select("path, sort_order, created_at")
      .eq("listing_id", rental.listing_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);

    if (photosError) {
      console.error("RentalDetailsPage photosError:", photosError.message);
    }

    const firstPhoto = photos?.[0];
    if (firstPhoto?.path) {
      const { data } = supabase.storage
        .from("listing-photos")
        .getPublicUrl(firstPhoto.path);
      thumbUrl = data.publicUrl;
    }
  }

  return (
    <>
      <ServerHeader />

      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="mb-4">
          <Link
            href="/dashboard/rentals"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            ← Back to My Rentals
          </Link>
        </div>

        <div className="rr-card p-4 mb-4">
          <PageHeader
            title="Rental Details"
            subtitle="View the full details for this rental."
          />
        </div>

        <div className="grid gap-4">
          <div className="rr-card p-4">
            <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-lg border border-black/60 bg-slate-50 shadow-sm aspect-square">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={listing?.title ?? "Listing photo"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                    No photo
                  </div>
                )}
              </div>

              <div className="grid gap-4">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Listing
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {listing?.title ?? "Listing"}
                  </div>

                  {(listing?.city || listing?.state) && (
                    <div className="mt-1 text-sm text-slate-600">
                      {[listing?.city, listing?.state]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-black bg-white px-3 py-1 text-xs font-semibold uppercase shadow-sm">
                    {rental.status}
                  </span>

                  {typeof rental.buffer_days === "number" && (
                    <span className="inline-flex items-center rounded-full border border-black bg-white px-3 py-1 text-xs shadow-sm">
                      Buffer: {rental.buffer_days}d
                    </span>
                  )}

                  <span className="inline-flex items-center rounded-full border border-black bg-white px-3 py-1 text-xs shadow-sm">
                    {rental.renter_returned ? "Returned" : "Not returned yet"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    href={`/dashboard/rentals/${encodeURIComponent(
                      rental.id,
                    )}/inspection`}
                    className="rr-btn rr-btn-secondary"
                  >
                    Record / View Condition
                  </Link>

                  <Link
                    href={`/dashboard/messages/${encodeURIComponent(rental.id)}`}
                    className="rr-btn rr-btn-secondary"
                  >
                    Open Messages
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rr-card p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Rental Info
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-700">Start date</div>
                  <div className="text-slate-600">{rental.start_date}</div>
                </div>

                <div>
                  <div className="font-semibold text-slate-700">End date</div>
                  <div className="text-slate-600">{rental.end_date}</div>
                </div>

                <div>
                  <div className="font-semibold text-slate-700">Created</div>
                  <div className="text-slate-600">
                    {rental.created_at
                      ? new Date(rental.created_at).toLocaleString()
                      : "—"}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-700">Rental ID</div>
                  <div className="break-all text-slate-600">{rental.id}</div>
                </div>
              </div>
            </div>

            <div className="rr-card p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Rental Charges
              </div>

              <div className="mt-4 grid gap-4 text-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
                  <div className="font-semibold text-slate-700">Daily rate</div>
                  <div className="font-bold text-slate-900">
                    {typeof listing?.price_per_day === "number"
                      ? `$${Number(listing?.price_per_day).toFixed(2)}/day`
                      : "—"}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
                  <div className="font-semibold text-slate-700">
                    Security deposit
                  </div>
                  <div className="font-bold text-slate-900">
                    ${Number(listing?.security_deposit ?? 0).toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="font-semibold text-slate-700">
                    Full invoice
                  </div>
                  <a
                    href={`/api/invoice?rental_id=${encodeURIComponent(rental.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rr-btn rr-btn-secondary rr-btn-sm"
                  >
                    Download Invoice
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="rr-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Security Deposit
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  View your deposit, deductions, and expected refund.
                </div>
              </div>

              <div
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${
                  rental.deposit_status === "fully_refunded"
                    ? "bg-green-100 text-green-800"
                    : rental.deposit_status === "partially_refunded"
                      ? "bg-amber-100 text-amber-800"
                      : rental.deposit_status === "retained"
                        ? "bg-red-100 text-red-800"
                        : rental.deposit_status === "collected"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-200 text-slate-700"
                }`}
              >
                {String(rental.deposit_status ?? "pending").replaceAll(
                  "_",
                  " ",
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-sm border border-slate-300 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Original Deposit
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  ${Number(listing?.security_deposit ?? 0).toFixed(2)}
                </div>
              </div>

              <div className="rounded-sm border border-slate-300 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Deductions
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  $
                  {(
                    Number(rental.deposit_damage_deduction ?? 0) +
                    Number(rental.deposit_cleaning_deduction ?? 0) +
                    Number(rental.deposit_fuel_deduction ?? 0) +
                    Number(rental.deposit_late_return_deduction ?? 0) +
                    Number(rental.deposit_other_deduction ?? 0)
                  ).toFixed(2)}
                </div>
              </div>

              <div className="rounded-sm border border-slate-900 bg-slate-900 p-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Refund Amount
                </div>
                <div className="mt-1 text-2xl font-bold">
                  ${Number(rental.deposit_refund_amount ?? 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="text-sm font-semibold text-slate-700">
                Owner Explanation
              </div>

              <div className="mt-2 rounded-sm bg-slate-50 p-4 text-sm text-slate-700">
                {rental.deposit_renter_explanation?.trim()
                  ? rental.deposit_renter_explanation
                  : "No explanation has been provided."}
              </div>
            </div>
          </div>

          <div className="rr-card p-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Message Sent With Request
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {rental.message?.trim()
                ? rental.message
                : "No message was included."}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
