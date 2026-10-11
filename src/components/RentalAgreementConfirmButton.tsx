"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RentalAgreementConfirmButton({
  rentalId,
}: {
  rentalId: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function confirmSigned() {
    setIsPending(true);
    setError("");

    try {
      const response = await fetch("/api/rental-agreement/confirm-signed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rentalId }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.error || "Could not confirm signed agreement.");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not confirm signed agreement.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={confirmSigned}
        disabled={isPending}
        className="rr-btn rr-btn-primary"
      >
        {isPending ? "Saving..." : "I Signed the Agreement"}
      </button>

      {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}
