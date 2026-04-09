import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <div>
      <ServerHeader />

      <div className="mx-auto max-w-3xl px-6 py-6">
        <PageHeader title="Contact Us" />

        <div className="rr-card mt-4 p-4 rounded-none border shadow-sm">
          <p className="text-sm text-slate-700">
            If you have questions, issues, or need support, you can reach us at:
          </p>

          <div className="mt-4 font-medium">support@rentrig.com</div>

          <p className="mt-4 text-sm text-slate-600">
            We typically respond within 24–48 hours.
          </p>
        </div>
      </div>
    </div>
  );
}