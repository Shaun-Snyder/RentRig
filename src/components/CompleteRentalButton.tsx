"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRentalCompleted } from "@/app/dashboard/owner-rentals/actions";

type Props = {
  rentalId: string;
};

export default function CompleteRentalButton({ rentalId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  function handleComplete() {
    startTransition(async () => {
      const result = await markRentalCompleted(rentalId);

      if (!result.ok) {
        alert(result.error);
        return;
      }

      setCompleted(true);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleComplete}
      disabled={isPending || completed}
      className="rr-btn rr-btn-primary"
    >
      {isPending
        ? "Completing..."
        : completed
          ? "Completed"
          : "Complete Rental"}
    </button>
  );
}
