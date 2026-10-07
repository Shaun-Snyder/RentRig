export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";

type RentalRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  buffer_days: number | null;
  message: string | null;
  created_at: string;
  renter_id: string;
  rental_agreement_url: string | null;
  listing: {
    id: string;
    title: string;
  } | null;
};

type InspectionWithPhotos = {
  id: string;
  role: "owner" | "renter";
  phase: "checkin" | "checkout";
  odometer: number | null;
  hours_used: number | null;
  fuel_percent: number | null;
  notes: string | null;
  damages: string | null;
  created_at: string | null;
  photos: {
    id: string;
    url: string;
    created_at: string | null;
  }[];
};

export default async function RenterInspectionPage({
  params,
}: {
  params: { rentalId: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const rentalId = params.rentalId;

  // Load rental; make sure this user is the renter
  const { data: rental, error } = await supabase
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
      renter_id,
      rental_agreement_url,
      listing:listings ( id, title )
    `,
    )
    .eq("id", rentalId)
    .single();

  if (error || !rental) {
    console.error("RenterInspectionPage rental load error:", error?.message);
    redirect("/dashboard/rentals");
  }

  if (rental.renter_id !== user.id) {
    redirect("/dashboard/rentals");
  }

  const listing = Array.isArray(rental.listing)
    ? (rental.listing[0] ?? null)
    : rental.listing;

  const typedRental: RentalRow = {
    id: rental.id,
    start_date: rental.start_date,
    end_date: rental.end_date,
    status: rental.status,
    buffer_days: rental.buffer_days,
    message: rental.message,
    created_at: rental.created_at,
    renter_id: rental.renter_id,
    rental_agreement_url: rental.rental_agreement_url ?? null,
    listing: listing
      ? {
          id: listing.id,
          title: listing.title,
        }
      : null,
  };

  // ---- Load inspections for this rental (both owner + renter) ----
  const { data: inspectionsRaw, error: inspectionsError } = await supabase
    .from("rental_inspections")
    .select(
      `
      id,
      role,
      phase,
      odometer,
      hours_used,
      fuel_percent,
      notes,
      damages,
      created_at
    `,
    )
    .eq("rental_id", rentalId)
    .order("created_at", { ascending: false }); // NEWEST FIRST

  if (inspectionsError) {
    console.error(
      "RenterInspectionPage inspections load error:",
      inspectionsError.message,
    );
  }

  let inspections: InspectionWithPhotos[] = [];

  if (inspectionsRaw && inspectionsRaw.length > 0) {
    const ids = inspectionsRaw.map((i) => i.id as string);

    let photosByInspection: Record<string, InspectionWithPhotos["photos"]> = {};

    if (ids.length > 0) {
      const { data: photosRaw, error: photosError } = await supabase
        .from("rental_inspection_photos")
        .select("id, inspection_id, url, created_at")
        .in("inspection_id", ids);

      if (photosError) {
        console.error(
          "RenterInspectionPage inspection photos load error:",
          photosError.message,
        );
      }

      if (photosRaw) {
        photosByInspection = photosRaw.reduce(
          (acc, p) => {
            const key = p.inspection_id as string;
            if (!acc[key]) acc[key] = [];
            acc[key].push({
              id: p.id as string,
              url: p.url as string,
              created_at: (p as any).created_at ?? null,
            });
            return acc;
          },
          {} as Record<string, InspectionWithPhotos["photos"]>,
        );
      }
    }

    inspections = inspectionsRaw.map((row) => ({
      id: row.id as string,
      role: row.role as "owner" | "renter",
      phase: row.phase as "checkin" | "checkout",
      odometer: (row as any).odometer ?? null,
      hours_used: (row as any).hours_used ?? null,
      fuel_percent: (row as any).fuel_percent ?? null,
      notes: (row as any).notes ?? null,
      damages: (row as any).damages ?? null,
      created_at: (row as any).created_at ?? null,
      photos: photosByInspection[row.id as string] ?? [],
    }));
  }

  const ownerPreRentalInspection = inspections.find(
    (inspection) =>
      inspection.role === "owner" && inspection.phase === "checkin",
  );

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="rr-card p-4 mb-4">
          <PageHeader
            title="Pre-Rental Condition"
            subtitle="Review the owner's recorded condition of the equipment before pickup."
          />
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <a href="/dashboard/rentals" className="rr-btn rr-btn-secondary">
            ← Back to my rentals
          </a>
        </div>

        {/* Rental agreement – only if owner uploaded one */}
        {typedRental.rental_agreement_url && (
          <section className="mb-6">
            <div className="rr-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* LEFT TEXT */}
              <div>
                <h2 className="text-sm font-semibold">Rental agreement</h2>
                <p className="mt-1 text-xs text-slate-600 max-w-md">
                  Your owner attached a rental agreement for this booking. Open
                  it to review or sign (for example via DocuSign).
                </p>
              </div>

              {/* RIGHT BUTTON */}
              <a
                href={typedRental.rental_agreement_url}
                target="_blank"
                rel="noreferrer"
                className="rr-btn rr-btn-secondary rr-btn-sm whitespace-nowrap"
              >
                View rental agreement
              </a>
            </div>
          </section>
        )}

        {/* Existing renter form (unchanged) */}
        <div className="rr-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pre-Rental Condition
          </div>

          <div className="mt-2 text-sm text-slate-600">
            Review the owner&apos;s pre-rental condition report below before
            pickup.
          </div>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold text-slate-800">
            Owner Pre-Rental Condition
          </h2>

          {!ownerPreRentalInspection ? (
            <div className="rr-card p-4 text-sm text-slate-600">
              The owner has not recorded the pre-rental condition yet.
            </div>
          ) : (
            <div className="rr-card space-y-4 p-4 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold text-green-700">
                  ✓ Pre-rental condition recorded
                </div>

                {ownerPreRentalInspection.created_at ? (
                  <div className="text-xs text-slate-500">
                    {new Date(
                      ownerPreRentalInspection.created_at,
                    ).toLocaleString()}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {ownerPreRentalInspection.odometer != null ? (
                  <div>
                    <span className="font-semibold">Odometer:</span>{" "}
                    {ownerPreRentalInspection.odometer} mi
                  </div>
                ) : null}

                {ownerPreRentalInspection.hours_used != null ? (
                  <div>
                    <span className="font-semibold">Hours:</span>{" "}
                    {ownerPreRentalInspection.hours_used}
                  </div>
                ) : null}

                {ownerPreRentalInspection.fuel_percent != null ? (
                  <div>
                    <span className="font-semibold">Fuel:</span>{" "}
                    {ownerPreRentalInspection.fuel_percent}%
                  </div>
                ) : null}
              </div>

              {ownerPreRentalInspection.damages ? (
                <div>
                  <div className="font-semibold text-rose-700">
                    Existing Damage
                  </div>
                  <div className="mt-1 text-rose-700">
                    {ownerPreRentalInspection.damages}
                  </div>
                </div>
              ) : null}

              {ownerPreRentalInspection.notes ? (
                <div>
                  <div className="font-semibold">Notes</div>
                  <div className="mt-1">{ownerPreRentalInspection.notes}</div>
                </div>
              ) : null}

              {ownerPreRentalInspection.photos.length > 0 ? (
                <div>
                  <div className="mb-2 font-semibold">Photos</div>

                  <div className="flex flex-wrap gap-2">
                    {ownerPreRentalInspection.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={photo.url}
                          alt="Pre-rental condition"
                          className="h-20 w-28 rounded border object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
