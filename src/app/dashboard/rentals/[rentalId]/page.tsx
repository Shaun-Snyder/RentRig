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
        message,
        created_at,
        listing:listings (
          id,
          title,
          city,
          state,
          price_per_day
        )
      `
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-4">
          <Link
            href="/dashboard/rentals"
            className="rr-btn rr-btn-secondary rr-btn-sm"
          >
            ← Back to My Rentals
          </Link>
        </div>

        <PageHeader
          title="Rental Details"
          subtitle="View the full details for this rental."
        />

        <div className="mt-6 grid gap-6">
          <div className="rr-card p-5">
            <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-lg border border-black/60 bg-slate-50 shadow-sm aspect-square">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={rental.listing?.title ?? "Listing photo"}
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
                    {rental.listing?.title ?? "Listing"}
                  </div>

                  {(rental.listing?.city || rental.listing?.state) && (
                    <div className="mt-1 text-sm text-slate-600">
                      {[rental.listing?.city, rental.listing?.state]
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
                  <a
                    href={`/api/invoice?rental_id=${encodeURIComponent(rental.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rr-btn rr-btn-primary"
                  >
                    Download Invoice
                  </a>

                  <Link
                    href={`/dashboard/rentals/${encodeURIComponent(
                      rental.id
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
                Pricing
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-700">Day rate</div>
                  <div className="text-slate-600">
                    {typeof rental.listing?.price_per_day === "number"
                      ? `$${rental.listing.price_per_day}`
                      : "—"}
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="rr-card p-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Message Sent With Request
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {rental.message?.trim() ? rental.message : "No message was included."}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}