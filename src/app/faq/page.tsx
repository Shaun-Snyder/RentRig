import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function FAQPage() {
  return (
    <div>
      <ServerHeader />

      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <PageHeader title="Frequently Asked Questions" />

        <div className="rr-card" style={{ marginTop: 16, padding: 20 }}>
          <h3>What is RentRig?</h3>
          <p>
            RentRig is a marketplace where owners can list vehicles and equipment,
            and renters can request rentals directly from them.
          </p>
        </div>
      </div>
    </div>
  );
}