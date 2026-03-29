import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function LegalPage() {
  return (
    <div>
      <ServerHeader />

      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <PageHeader title="Legal & Disclaimer" />

        <div className="rr-card" style={{ marginTop: 16, padding: 20 }}>
          <p>
            RentRig is a peer-to-peer marketplace that connects equipment owners
            with renters.
          </p>

          <p style={{ marginTop: 12 }}>
            RentRig does not own, operate, or control listed vehicles or
            equipment.
          </p>

          <p style={{ marginTop: 12 }}>
            All rental agreements, payments, and responsibilities are between
            the owner and the renter.
          </p>
        </div>
      </div>
    </div>
  );
}