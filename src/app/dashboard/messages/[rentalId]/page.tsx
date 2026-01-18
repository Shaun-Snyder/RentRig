
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import MessageThreadClient from "@/components/MessageThreadClient";

export default async function MessageThreadPage({
  params,
}: {
  params: { rentalId: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rentalId = params?.rentalId;
  if (!rentalId) redirect("/dashboard/messages");

  // Load the rental + listing only (avoid profiles.email join)
  const { data: rental, error } = await supabase
    .from("rentals")
    .select(
      "id, listing_id, renter_id, start_date, end_date, status, created_at, listing:listings(id,title,owner_id)"
    )
    .eq("id", rentalId)
    .single();

  // Show the real error (so we stop guessing)
  if (error || !rental) {
    return (
      <div>
        <ServerHeader />
        <div style={{ padding: 24 }}>
          <PageHeader title="Message Thread" subtitle="Failed to open thread" />

          <div className="rr-card mt-6 p-6 text-red-700">
            <div className="font-semibold">Thread load failed</div>

            <div className="mt-3 text-sm grid gap-2">
              <div>
                <span className="font-medium">rentalId:</span> {rentalId}
              </div>
              <div>
                <span className="font-medium">error:</span>{" "}
                {error?.message ?? "No rental returned"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Extra safety check: must be renter OR listing owner
  const isRenter = rental.renter_id === user.id;
  const isOwner = (rental as any)?.listing?.owner_id === user.id;

  if (!isRenter && !isOwner) {
    redirect("/dashboard/messages");
  }

  return (
    <div>
      <ServerHeader />

      <div style={{ padding: 24 }}>
        <PageHeader
          title="Message Thread"
          subtitle={(rental as any)?.listing?.title ?? "Rental"}
        />

        <div className="mt-6">
          <MessageThreadClient rental={rental as any} />
        </div>
      </div>
    </div>
  );
}
