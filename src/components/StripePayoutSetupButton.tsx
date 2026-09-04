"use client";

import { useState } from "react";

type StripePayoutStatus =
  "not_setup" | "active" | "pending" | "restricted" | "unsupported";

export default function StripePayoutSetupButton({
  status = "not_setup",
}: {
  status?: StripePayoutStatus;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startOnboarding() {
    setLoading(true);
    setError("");

    try {
      const accountResponse = await fetch("/api/create-connect-account", {
        method: "POST",
      });

      const accountData = await accountResponse.json();

      if (!accountResponse.ok) {
        throw new Error(accountData.error || "Unable to create Stripe account");
      }

      const linkResponse = await fetch("/api/create-connect-account-link", {
        method: "POST",
      });

      const linkData = await linkResponse.json();

      if (!linkResponse.ok || !linkData.url) {
        throw new Error(linkData.error || "Unable to start Stripe onboarding");
      }

      window.location.href = linkData.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (status === "active") {
    return (
      <div className="text-sm font-semibold text-green-700">
        ✓ Payouts Ready
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className="text-sm font-semibold text-red-600">
        Payouts are not available for this account.
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={startOnboarding}
        disabled={loading}
        className="rr-btn rr-btn-primary"
      >
        {loading
          ? "Opening Stripe..."
          : status === "pending" || status === "restricted"
            ? "Finish Payout Setup"
            : "Set Up Payouts"}
      </button>

      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
