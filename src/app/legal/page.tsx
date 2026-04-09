import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function LegalPage() {
  return (
    <div>
      <ServerHeader />

      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <PageHeader title="Legal & Disclaimer" />

        <div className="rr-card mt-4 p-4 rounded-none border shadow-sm space-y-4 text-sm text-slate-700">

  <div>
    <p>
      RentRig is a peer-to-peer marketplace that connects equipment and vehicle owners with renters.
    </p>
  </div>

  <div>
    <p>
      RentRig does not own, operate, maintain, or control any of the equipment or vehicles listed on the platform.
    </p>
  </div>

  <div>
    <p>
      All rental agreements, terms, payments, and arrangements are made directly between the owner and the renter.
      RentRig is not a party to any rental transaction.
    </p>
  </div>

  <div>
    <p className="font-semibold">
      Responsibility & Liability
    </p>
    <p>
      Owners and renters are solely responsible for their own actions, use of equipment, and compliance with all
      applicable laws, regulations, and safety requirements.
    </p>
  </div>

  <div>
    <p className="font-semibold">
      Insurance
    </p>
    <p>
      Owners and renters are responsible for maintaining any necessary insurance coverage. RentRig does not provide
      insurance coverage for rentals, equipment, or users.
    </p>
  </div>

  <div>
    <p className="font-semibold">
      Damages & Disputes
    </p>
    <p>
      Any damages, losses, injuries, or disputes arising from a rental must be resolved directly between the owner and
      the renter. RentRig is not responsible for mediating or resolving disputes.
    </p>
  </div>

  <div>
    <p className="font-semibold">
      No Warranty
    </p>
    <p>
      RentRig makes no guarantees regarding the condition, safety, legality, or suitability of any listed equipment or
      vehicles.
    </p>
  </div>

  <div>
    <p className="font-semibold">
      Platform Role
    </p>
    <p>
      RentRig’s role is limited to providing a platform for connecting owners and renters. By using this platform,
      users acknowledge and accept these terms.
    </p>
  </div>

</div>
      </div>
    </div>
  );
}