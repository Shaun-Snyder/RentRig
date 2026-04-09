import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const listingId = req.nextUrl.searchParams.get("listing_id");
  if (!listingId) {
    return NextResponse.redirect(new URL("/listings", req.url));
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    return NextResponse.redirect(new URL("/listings", req.url));
  }

  if (listing.owner_id === user.id) {
    return NextResponse.redirect(new URL(`/listings/${listingId}`, req.url));
  }

  // Reuse an existing inquiry thread first
      const { data: existingInquiry } = await supabase
    .from("rentals")
    .select("id")
    .eq("listing_id", listingId)
    .eq("renter_id", user.id)
    .eq("is_inquiry", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingInquiry?.id) {
    return NextResponse.redirect(
      new URL(`/dashboard/messages/${existingInquiry.id}`, req.url),
    );
  }

  // Create a lightweight inquiry thread
     const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 1);

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

      const { data: created, error: createError } = await supabase
    .from("rentals")
    .insert({
      listing_id: listingId,
      renter_id: user.id,
      status: "pending",
      is_inquiry: true,
      message: null,
      start_date: startDate,
      end_date: endDate,
    })
    .select("id")
    .single();

    if (createError || !created?.id) {
    return NextResponse.json(
      {
        error: createError?.message ?? "Failed to create inquiry thread",
      },
      { status: 500 },
    );
  }

  return NextResponse.redirect(
    new URL(`/dashboard/messages/${created.id}`, req.url),
  );
}