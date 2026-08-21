"use client";

import { useState, useTransition } from "react";
import { updateOwnerDiscount } from "@/app/dashboard/owner-rentals/actions";

type Props = {
  rentalId: string;
  discountAmount: number;
  discountNote: string;
};

export default function OwnerDiscountForm({
  rentalId,
  discountAmount,
  discountNote,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="rr-card p-4"
      action={(formData) => {
        setSaved(false);

        startTransition(async () => {
          const result = await updateOwnerDiscount(formData);

          if (result?.ok) {
            setSaved(true);
          }
        });
      }}
    >
      <input type="hidden" name="rental_id" value={rentalId} />

      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Owner Discount
      </div>

      <div className="mt-1 text-sm text-slate-600">
        Enter a flat discount amount and a short explanation.
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-slate-700">Discount amount</span>

          <input
            type="number"
            name="owner_discount_amount"
            min="0"
            step="0.01"
            defaultValue={discountAmount.toFixed(2)}
            className="rr-input"
            onChange={() => setSaved(false)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-slate-700">Reason</span>

          <input
            type="text"
            name="owner_discount_note"
            defaultValue={discountNote}
            placeholder="Example: Repeat customer"
            className="rr-input"
            onChange={() => setSaved(false)}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
        <div className="text-sm text-slate-600">
          Current discount:{" "}
          <span className="font-bold text-slate-900">
            ${discountAmount.toFixed(2)}
          </span>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rr-btn rr-btn-primary"
        >
          {isPending ? "Saving..." : saved ? "Saved" : "Save Discount"}
        </button>
      </div>
    </form>
  );
}
