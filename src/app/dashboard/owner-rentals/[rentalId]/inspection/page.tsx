export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import OwnerInspectionForm from "@/components/OwnerInspectionForm";

type RentalRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  buffer_days: number | null;
  message: string | null;
  created_at: string;
  rental_agreement_url: string | null;
  listing: {
    id: string;
    title: string;
  } | null;
};

type RentalAgreementRow = {
  id: string;
  url: string;
  file_name: string | null;
  created_at: string | null;
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

export default async function OwnerInspectionPage({
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

  // Load the rental + listing so we can:
  // - show header info
  // - confirm this user owns the listing
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
      rental_agreement_url,
      listing:listings ( id, title, owner_id )
    `
    )
    .eq("id", rentalId)
    .single();

  if (error || !rental) {
    console.error("OwnerInspectionPage rental load error:", error?.message);
    redirect("/dashboard/owner-rentals");
  }

  // Only the owner of the listing can view this page
  if (!rental.listing || rental.listing.owner_id !== user.id) {
    redirect("/dashboard/owner-rentals");
  }

  const typedRental: RentalRow = {
    id: rental.id,
    start_date: rental.start_date,
    end_date: rental.end_date,
    status: rental.status,
    buffer_days: rental.buffer_days,
    message: rental.message,
    created_at: rental.created_at,
    rental_agreement_url: rental.rental_agreement_url ?? null,
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
    `
    )
    .eq("rental_id", rentalId)
    .order("created_at", { ascending: false }); // NEWEST FIRST

  if (inspectionsError) {
    console.error(
      "OwnerInspectionPage inspections load error:",
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
          "OwnerInspectionPage inspection photos load error:",
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
      damages: (row as any).damages ?? null,
      created_at: (row as any).created_at ?? null,
      photos: photosByInspection[row.id as string] ?? [],
    }));
  }

  // ---- Load rental agreements for this rental (owner history) ----
  const { data: agreements, error: agreementsError } = await supabase
    .from("rental_agreements")
    .select("id, url, file_name, created_at")
    .eq("rental_id", rentalId)
    .order("created_at", { ascending: false });

  if (agreementsError) {
    console.error(
      "OwnerInspectionPage agreements load error:",
      agreementsError.message
    );
  }

  const agreementList: RentalAgreementRow[] = (agreements ?? []).map((a) => ({
    id: a.id as string,
    url: (a as any).url as string,
    file_name: (a as any).file_name ?? null,
    created_at: (a as any).created_at ?? null,
  }));

  return (
    <>
      <ServerHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title="Rental condition (owner)"
          subtitle="Record check-in / check-out condition and manage the rental agreement."
        />

        <div className="mt-2 mb-6 flex items-center justify-between gap-3">
          <a href="/dashboard/owner-rentals" className="rr-btn rr-btn-secondary">
            ← Back to rental requests
          </a>
        </div>

        {/* Rental agreement upload / view (owner only) */}
        <section className="mb-6 space-y-2">
          <div className="rr-card p-4">
            <h2 className="text-sm font-semibold">Rental agreement</h2>
            <p className="mt-1 text-xs text-slate-600">
              Upload your signed rental agreement (PDF, DocuSign export, etc.).
              This will be stored with this rental so you can reference it
              later.
            </p>

            {(typedRental.rental_agreement_url || agreementList.length > 0) && (
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="
                      inline-flex items-center
                      rounded-full border border-black
                      bg-white
                      px-3 py-1
                      text-[11px] font-semibold uppercase
                      shadow-sm
                    "
                  >
                    Agreement on file
                  </span>

                  {typedRental.rental_agreement_url && (
                    <a
                      href={typedRental.rental_agreement_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-slate-800"
                    >
                      View current agreement
                    </a>
                  )}
                </div>
              </div>
            )}

            <form
              action="/api/rental-agreement"
              method="POST"
              encType="multipart/form-data"
              className="mt-3 space-y-2 text-xs"
            >
              <input type="hidden" name="rental_id" value={typedRental.id} />
              <label className="font-medium">
                Upload / replace rental agreement
              </label>
              <input
                name="agreement"
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="text-xs"
              />
              <p className="text-[10px] text-slate-500">
                Upload a signed PDF, DocuSign download, or clear image of a
                signed paper agreement.
              </p>

              <button
                type="submit"
                className="rr-btn rr-btn-secondary rr-btn-sm mt-1"
              >
                Save agreement
              </button>
            </form>

            {/* Agreement history list */}
            <div className="mt-4 border-t pt-3">
              <h3 className="text-[11px] font-semibold uppercase text-slate-600">
                Agreement history
              </h3>

              {agreementList.length === 0 ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  No rental agreements uploaded yet for this rental.
                </p>
              ) : (
                <div className="mt-2 space-y-2 text-xs text-slate-700">
                  {agreementList.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2"
                    >
                      <div>
                        <div className="font-medium">
                          {a.file_name || "Agreement"}
                        </div>
                        {a.created_at && (
                          <div className="text-[11px] text-slate-500">
                            Uploaded {new Date(a.created_at).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rr-btn rr-btn-secondary text-xs"
                      >
                        View / download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Rental agreement history (owner view only) */}
        {agreementList.length > 0 && (
          <section className="mb-6">
            <div className="rr-card p-4">
              <h2 className="text-sm font-semibold">Agreement history</h2>
              <p className="mt-1 text-xs text-slate-600">
                Previous agreements that were uploaded for this rental.
              </p>

              <div className="mt-3 grid gap-2 text-xs">
                {agreementList.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-1 rounded-lg border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium">
                        {a.file_name || "Agreement file"}
                      </div>
                      {a.created_at && (
                        <div className="text-[11px] text-slate-500">
                          Uploaded {new Date(a.created_at).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rr-btn rr-btn-secondary rr-btn-sm mt-2 sm:mt-0 whitespace-nowrap"
                    >
                      View / download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Owner form */}
        <OwnerInspectionForm rental={typedRental as any} />

        {/* Inspections list (owner + renter) */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">Existing inspections</h2>

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
                  className="rr-card space-y-2 p-3 text-xs text-slate-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Role bubble */}
                      <span
                        className="
                          inline-flex items-center
                          rounded-full border border-black
                          bg-white
                          px-3 py-1
                          text-[11px] font-semibold uppercase
                          shadow-sm
                        "
                      >
                        {insp.role === "owner" ? "Owner" : "Renter"}
                      </span>

                      {/* Phase bubble */}
                      <span
                        className="
                          inline-flex items-center
                          rounded-full border border-black
                          bg-white
                          px-3 py-1
                          text-[11px]
                          shadow-sm
                        "
                      >
                        {insp.phase === "checkin" ? "Check-in" : "Check-out"}
                      </span>
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

                  {insp.damages && (
                    <div className="text-[11px] text-rose-700">
                      <span className="font-medium">Damages:</span>{" "}
                      {insp.damages}
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
