export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { updateOwnerDiscount, updateRentalDeposit } from "../actions";

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

    service_choice,
    service_unit,
    service_rate,
    service_days,
    service_hours,
    service_total,

    delivery_selected,
    delivery_fee,

    owner_discount_amount,
    owner_discount_note,

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

    operator_selected,
    operator_rate_unit,
    operator_rate,
    operator_total,

    message,
    created_at,

    listing:listings ( id, title, owner_id, security_deposit ),
    renter:profiles!rentals_renter_id_fkey (
      id,
      full_name,
      company_name
    )
  `,
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
            ← Back to Rental Requests
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

          <div className="rr-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pricing & Services
            </div>

            <div className="mt-3 grid gap-2 text-sm text-slate-700">
              <div>
                <span className="font-semibold">Service:</span>{" "}
                {rental.service_choice && rental.service_choice !== "none"
                  ? rental.service_choice === "driver_labor"
                    ? "Driver + Labor"
                    : rental.service_choice === "driver"
                      ? "Driver"
                      : rental.service_choice === "operator"
                        ? "Operator"
                        : rental.service_choice
                  : "None"}
              </div>

              {rental.service_choice && rental.service_choice !== "none" ? (
                <>
                  <div>
                    <span className="font-semibold">Rate:</span> $
                    {Number(rental.service_rate ?? 0).toFixed(2)} /{" "}
                    {rental.service_unit ?? "day"}
                  </div>

                  <div>
                    <span className="font-semibold">
                      {rental.service_unit === "hour" ? "Hours:" : "Days:"}
                    </span>{" "}
                    {rental.service_unit === "hour"
                      ? (rental.service_hours ?? 0)
                      : (rental.service_days ?? 0)}
                  </div>

                  <div>
                    <span className="font-semibold">Service Total:</span> $
                    {Number(rental.service_total ?? 0).toFixed(2)}
                  </div>
                </>
              ) : null}

              <div>
                <span className="font-semibold">Delivery:</span>{" "}
                {rental.delivery_selected
                  ? `$${Number(rental.delivery_fee ?? 0).toFixed(2)}`
                  : "Not selected"}
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

          <form action={updateOwnerDiscount} className="rr-card p-4">
            <input type="hidden" name="rental_id" value={rental.id} />

            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Owner Discount
            </div>

            <div className="mt-1 text-sm text-slate-600">
              Enter a flat discount amount and a short explanation.
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Discount amount
                </span>
                <input
                  type="number"
                  name="owner_discount_amount"
                  min="0"
                  step="0.01"
                  defaultValue={Number(
                    rental.owner_discount_amount ?? 0,
                  ).toFixed(2)}
                  className="rr-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-slate-700">Reason</span>
                <input
                  type="text"
                  name="owner_discount_note"
                  defaultValue={rental.owner_discount_note ?? ""}
                  placeholder="Example: Repeat customer"
                  className="rr-input"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <div className="text-sm text-slate-600">
                Current discount:{" "}
                <span className="font-bold text-slate-900">
                  ${Number(rental.owner_discount_amount ?? 0).toFixed(2)}
                </span>
              </div>

              <button type="submit" className="rr-btn rr-btn-primary">
                Save Discount
              </button>
            </div>
          </form>

          <form action={updateRentalDeposit} className="rr-card p-4">
            <input type="hidden" name="rental_id" value={rental.id} />

            <div className="border-b border-slate-200 pb-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Security Deposit
              </div>

              <div className="mt-1 text-sm text-slate-600">
                Record deductions and calculate the renter refund.
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-sm border border-slate-300 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Deposit Collected
                  </div>

                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    ${Number(rental.listing?.security_deposit ?? 0).toFixed(2)}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Original listing security deposit
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
                <span className="font-semibold text-slate-700">
                  Owner notes
                </span>
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
                  Changes are saved immediately and used when calculating the
                  renter's final refund.
                </div>

                <button
                  type="submit"
                  className="rr-btn rr-btn-primary rr-btn-lg"
                >
                  Save Deposit Changes
                </button>
              </div>
            </div>
          </form>

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
