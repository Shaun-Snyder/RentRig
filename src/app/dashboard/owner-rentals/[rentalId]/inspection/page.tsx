export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import OwnerInspectionForm from "@/components/OwnerInspectionForm";
import { updateRentalDeposit } from "@/app/dashboard/owner-rentals/actions";
import SaveButton from "@/components/SaveButton";
import CompleteRentalButton from "@/components/CompleteRentalButton";

type RentalRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  buffer_days: number | null;
  message: string | null;
  created_at: string;
  rental_agreement_url: string | null;
  security_deposit_amount?: number | null;

  deposit_status?: string | null;
  deposit_collected_at?: string | null;
  deposit_damage_deduction?: number | null;
  deposit_cleaning_deduction?: number | null;
  deposit_fuel_deduction?: number | null;
  deposit_late_return_deduction?: number | null;
  deposit_other_deduction?: number | null;
  deposit_other_reason?: string | null;
  deposit_owner_notes?: string | null;
  deposit_renter_explanation?: string | null;
  deposit_refund_amount?: number | null;
  deposit_refunded_at?: string | null;
  deposit_refund_transaction_id?: string | null;
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

security_deposit_amount,

deposit_status,
deposit_collected_at,
deposit_damage_deduction,
deposit_cleaning_deduction,
deposit_fuel_deduction,
deposit_late_return_deduction,
deposit_other_deduction,
deposit_other_reason,
deposit_owner_notes,
deposit_renter_explanation,
deposit_refund_amount,
deposit_refunded_at,
deposit_refund_transaction_id,

      listing:listings ( id, title, owner_id )
    `,
    )
    .eq("id", rentalId)
    .single();

  if (error || !rental) {
    console.error("OwnerInspectionPage rental load error:", error?.message);
    redirect("/dashboard/owner-rentals");
  }

  // Only the owner of the listing can view this page

  const listing = Array.isArray(rental.listing)
    ? (rental.listing[0] ?? null)
    : rental.listing;

  if (!listing || listing.owner_id !== user.id) {
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
    security_deposit_amount: rental.security_deposit_amount ?? null,

    deposit_status: rental.deposit_status ?? null,
    deposit_collected_at: rental.deposit_collected_at ?? null,
    deposit_damage_deduction: rental.deposit_damage_deduction ?? null,
    deposit_cleaning_deduction: rental.deposit_cleaning_deduction ?? null,
    deposit_fuel_deduction: rental.deposit_fuel_deduction ?? null,
    deposit_late_return_deduction: rental.deposit_late_return_deduction ?? null,
    deposit_other_deduction: rental.deposit_other_deduction ?? null,
    deposit_other_reason: rental.deposit_other_reason ?? null,
    deposit_owner_notes: rental.deposit_owner_notes ?? null,
    deposit_renter_explanation: rental.deposit_renter_explanation ?? null,
    deposit_refund_amount: rental.deposit_refund_amount ?? null,
    deposit_refunded_at: rental.deposit_refunded_at ?? null,
    deposit_refund_transaction_id: rental.deposit_refund_transaction_id ?? null,
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
      "OwnerInspectionPage inspections load error:",
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
          "OwnerInspectionPage inspection photos load error:",
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

  // ---- Load rental agreements for this rental (owner history) ----
  const { data: agreements, error: agreementsError } = await supabase
    .from("rental_agreements")
    .select("id, url, file_name, created_at")
    .eq("rental_id", rentalId)
    .order("created_at", { ascending: false });

  if (agreementsError) {
    console.error(
      "OwnerInspectionPage agreements load error:",
      agreementsError.message,
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
      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="rr-card p-4 mb-4">
          <PageHeader
            title="Rental Condition"
            subtitle="Record check-in / check-out condition and manage the rental agreement."
          />
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <a
            href="/dashboard/owner-rentals"
            className="rr-btn rr-btn-secondary"
          >
            ← Back to rental requests
          </a>
        </div>

        {/* Rental agreement upload / view (owner only) */}
        <section className="mb-6 space-y-2">
          <div className="rr-card p-4">
            <h2 className="text-base font-semibold">Rental Agreement</h2>
            <p className="mt-1 text-sm text-slate-600">
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
              <h3 className="text-sm font-semibold text-slate-700">
                Agreement History
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

        {/* Return deposit handling */}
        <form
          action={async (formData) => {
            "use server";
            await updateRentalDeposit(formData);
          }}
          className="rr-card mt-6 p-4"
        >
          <input type="hidden" name="rental_id" value={rental.id} />

          <div className="border-b border-slate-200 pb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Return Deposit
            </div>

            <div className="mt-1 text-sm text-slate-600">
              Review the returned equipment, record any deductions, and
              calculate the renter&apos;s refund.
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-slate-300 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Deposit Collected
                </div>

                <div className="mt-1 text-2xl font-bold text-slate-900">
                  ${Number(rental.security_deposit_amount ?? 0).toFixed(2)}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Agreed security deposit for this rental
                </div>
              </div>

              <div className="flex min-h-[126px] flex-col justify-center rounded-sm border border-slate-300 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current Status
                </div>

                <div
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${
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
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Damage deduction
                </span>
                <input
                  type="number"
                  name="deposit_damage_deduction"
                  min="0"
                  step="0.01"
                  defaultValue={Number(
                    rental.deposit_damage_deduction ?? 0,
                  ).toFixed(2)}
                  className="rr-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Cleaning deduction
                </span>
                <input
                  type="number"
                  name="deposit_cleaning_deduction"
                  min="0"
                  step="0.01"
                  defaultValue={Number(
                    rental.deposit_cleaning_deduction ?? 0,
                  ).toFixed(2)}
                  className="rr-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Fuel deduction
                </span>
                <input
                  type="number"
                  name="deposit_fuel_deduction"
                  min="0"
                  step="0.01"
                  defaultValue={Number(
                    rental.deposit_fuel_deduction ?? 0,
                  ).toFixed(2)}
                  className="rr-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Late return deduction
                </span>
                <input
                  type="number"
                  name="deposit_late_return_deduction"
                  min="0"
                  step="0.01"
                  defaultValue={Number(
                    rental.deposit_late_return_deduction ?? 0,
                  ).toFixed(2)}
                  className="rr-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Other deduction
                </span>
                <input
                  type="number"
                  name="deposit_other_deduction"
                  min="0"
                  step="0.01"
                  defaultValue={Number(
                    rental.deposit_other_deduction ?? 0,
                  ).toFixed(2)}
                  className="rr-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Other reason
                </span>
                <input
                  type="text"
                  name="deposit_other_reason"
                  defaultValue={rental.deposit_other_reason ?? ""}
                  className="rr-input"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-slate-700">Owner notes</span>
              <textarea
                name="deposit_owner_notes"
                defaultValue={rental.deposit_owner_notes ?? ""}
                rows={3}
                className="rr-input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-slate-700">
                Renter-visible explanation
              </span>
              <textarea
                name="deposit_renter_explanation"
                defaultValue={rental.deposit_renter_explanation ?? ""}
                rows={3}
                className="rr-input"
              />
            </label>

            <div className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
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

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <div className="text-sm text-slate-500">
                Save the final deductions after reviewing the return condition.
              </div>

              <SaveButton
                idleText="Save Deposit Changes"
                pendingText="Saving..."
                size="lg"
              />
            </div>
          </div>
        </form>

        {rental.status === "approved" ? (
          <div className="rr-card mt-6 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Complete Rental
            </div>

            <p className="mt-1 text-sm text-slate-600">
              Complete the rental after the equipment has been returned, the
              check-out inspection has been saved, and the security deposit has
              been reviewed.
            </p>

            <div className="mt-4 flex justify-end">
              <CompleteRentalButton rentalId={rental.id} />
            </div>
          </div>
        ) : rental.status === "completed" ? (
          <div className="rr-card mt-6 p-4">
            <div className="font-semibold text-slate-900">Rental completed</div>
            <div className="mt-1 text-sm text-slate-600">
              The return process for this rental is complete.
            </div>
          </div>
        ) : null}

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
                      <span className="font-medium">Notes:</span> {insp.notes}
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
