import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function FAQPage() {
  return (
    <div>
      <ServerHeader />

      <main className="mx-auto max-w-6xl px-6 py-4">
        <div className="rr-card p-4 mb-4">
  <PageHeader title="Frequently Asked Questions" />
</div>

        <div className="grid gap-3">

  <div>
    <h3 className="font-semibold">What is RentRig?</h3>
    <p className="text-sm text-slate-700 mt-1">
      RentRig is a marketplace where equipment and vehicle owners can list their assets,
      and renters can request rentals directly from them.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">How do I rent equipment?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Browse listings, select your dates, and submit a rental request. The owner will
      review your request and approve or decline it.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">Can I message the owner before renting?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Yes. Use the “Message Owner” button on any listing to ask questions before
      submitting a rental request.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">What is the difference between an inquiry and a rental request?</h3>
    <p className="text-sm text-slate-700 mt-1">
      An inquiry is just a message thread with the owner. A rental request is a formal
      request with dates and pricing that the owner can approve.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">How does payment work?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Payments are handled directly between the renter and the owner. RentRig does not
      currently process payments.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">Do I need insurance?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Insurance requirements are determined by the owner. Renters are responsible for
      confirming coverage before renting.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">What if equipment is damaged?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Any damages or disputes must be resolved between the owner and renter, typically
      through insurance or direct agreement.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">What happens after I submit a rental request?</h3>
    <p className="text-sm text-slate-700 mt-1">
      The owner will review your request. If approved, you can coordinate details
      such as delivery, pickup, and payment.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">Can I cancel a rental?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Cancellation terms are determined by the owner. Always confirm cancellation
      policies before booking.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">Do I need a license to rent equipment?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Some equipment requires a license. If required, you must either confirm you have
      the license or request an operator with the equipment.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">Can I hire a driver or operator?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Yes, if the listing offers it. Some equipment may require an operator depending
      on safety or licensing requirements.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">Is delivery available?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Some listings offer delivery. Delivery options and pricing are set by the owner.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">How are prices calculated?</h3>
    <p className="text-sm text-slate-700 mt-1">
      Prices are based on daily rates, optional services (like drivers or operators),
      delivery fees, and a service fee.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">What is the service fee?</h3>
    <p className="text-sm text-slate-700 mt-1">
      A small service fee is added to each rental to support the platform.
    </p>
  </div>

  <div>
    <h3 className="font-semibold">How do I contact support?</h3>
    <p className="text-sm text-slate-700 mt-1">
      You can reach support through the Contact page or by emailing support@rentrig.com.
    </p>
  </div>

</div>
      </main>
    </div>
  );
}