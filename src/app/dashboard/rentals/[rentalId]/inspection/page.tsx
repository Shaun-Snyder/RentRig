export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import RenterInspectionForm from "@/components/RenterInspectionForm";

type RentalRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  buffer_days: number | null;
  message: string | null;
  created_at: string;
  renter_id: string;
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
      listing:listings ( id, title )
    `
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

  const typedRental: RentalRow = {
    id: rental.id,
    start_date: rental.start_date,
    end_date: rental.end_date,
    status: rental.status,
    buffer_days: rental.buffer_days,
    message: rental.message,
    created_at: rental.created_at,
    renter_id: rental.renter_id,
    listing: rental.listing
      ? {
          id: rental.listing.id,
          title: rental.listing.title,
        }
      : null,
  };

  // ---- Load inspections for this rental (both owner + renter) ----
  const { data: inspectionsRaw, error: inspectionsError } = await supabase
    .from("rental_inspections")
    .select(
      "id, role, phase, odometer, hours_used, fuel_percent, notes, created_at"
    )
    .eq("rental_id", rentalId)
    .order("created_at", { ascending: false }); // NEWEST FIRST

  if (inspectionsError) {
    console.error(
      "RenterInspectionPage inspections load error:",
      inspectionsError.message
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
          photosError.message
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
          {} as Record<string, InspectionWithPhotos["photos"]>
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
      created_at: (row as any).created_at ?? null,
      photos: photosByInspection[row.id as string] ?? [],
    }));
  }

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title="Rental condition (renter)"
          subtitle="Record check-in / check-out condition for this rental."
        />

        <div className="mt-2 mb-6 flex items-center justify-between gap-3">
          <a href="/dashboard/rentals" className="rr-btn rr-btn-secondary">
            ← Back to my rentals
          </a>
        </div>

        {/* Existing renter form (unchanged) */}
        <RenterInspectionForm rental={typedRental} />

        {/* Inspections list (owner + renter) */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold mb-3">Existing inspections</h2>

          {inspections.length === 0 ? (
            <p className="text-sm text-slate-600">
              No inspections recorded yet. Save a check-in or check-out above to
              see them here.
            </p>
          ) : (
            <div className="grid gap-3">
              {inspections.map((insp) => (
                <div
                  key={insp.id}
                  className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-700 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">
                      {insp.role === "owner" ? "Owner" : "Renter"} •{" "}
                      {insp.phase === "checkin" ? "Check-in" : "Check-out"}
                    </div>
                    {insp.created_at && (
                      <div className="text-[11px] text-slate-500">
                        {new Date(insp.created_at).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 text-[11px]">
                    {insp.odometer != null && (
                      <span>Odometer: {insp.odometer} mi</span>
                    )}
                    {insp.hours_used != null && (
                      <span>Hours: {insp.hours_used}</span>
                    )}
                    {insp.fuel_percent != null && (
                      <span>Fuel: {insp.fuel_percent}%</span>
                    )}
                  </div>

                  {insp.notes && (
                    <div className="text-[11px]">
                      <span className="font-medium">Notes:</span>{" "}
                      {insp.notes}
                    </div>
                  )}

                  {insp.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {insp.photos.map((p) => (
                        <a
                          key={p.id}
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block"
                        >
                          <img
                            src={p.url}
                            alt=""
                            className="h-16 w-24 rounded border object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
