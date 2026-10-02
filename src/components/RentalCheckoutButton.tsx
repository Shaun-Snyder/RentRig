"use client";

import { useState } from "react";

export default function RentalCheckoutButton({
  rentalId,
}: {
  rentalId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/create-rental-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rentalId }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.message || "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start checkout.",
      );
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="rr-btn rr-btn-primary"
      >
        {loading ? "Opening Checkout..." : "Pay Now"}
      </button>

      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
