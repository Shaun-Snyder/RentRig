export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import ServerHeader from "@/components/ServerHeader";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import MessageThreadClient from "@/components/MessageThreadClient";
function photoUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/listing-photos/${path}`;
}
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
      "id, listing_id, renter_id, start_date, end_date, status, is_inquiry, created_at, listing:listings(id,title,owner_id), renter:profiles!rentals_renter_id_fkey(id,full_name,avatar_url)",
    )
    .eq("id", rentalId)
    .maybeSingle();

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
  const listing = Array.isArray((rental as any).listing)
    ? (rental as any).listing[0]
    : (rental as any).listing;

  const isRenter = rental.renter_id === user.id;
  const isOwner = listing?.owner_id === user.id;

  if (!isRenter && !isOwner) {
    redirect("/dashboard/messages");
  }
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", listing?.owner_id)
    .single();
  const { data: firstPhoto } = await supabase
    .from("listing_photos")
    .select("path")
    .eq("listing_id", listing?.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const renterProfile = Array.isArray((rental as any).renter)
    ? (rental as any).renter[0]
    : (rental as any).renter;

  const rentalWithNames = {
    ...(rental as any),
    listing: {
      id: listing?.id ?? "",
      title: listing?.title ?? "Listing",
      owner_id: listing?.owner_id ?? null,
      owner_name: ownerProfile?.full_name ?? "Owner",
      owner_avatar_url: ownerProfile?.avatar_url ?? null,
      thumb_url: firstPhoto?.path ? photoUrl(firstPhoto.path) : "",
    },
    renter: {
      ...(renterProfile ?? {}),
      avatar_url: renterProfile?.avatar_url ?? null,
    },
  };

  return (
    <div>
      <ServerHeader />

      <div style={{ padding: 24 }}>
        <PageHeader
          title={
            (rental as any).is_inquiry
              ? "Inquiry Thread"
              : "Rental Request Thread"
          }
          subtitle={listing?.title ?? "Rental"}
        />

        <div className="mt-6">
          <MessageThreadClient
            rental={rentalWithNames as any}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  );
}
