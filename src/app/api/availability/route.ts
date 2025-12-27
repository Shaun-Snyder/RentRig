import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");

  if (!listingId) {
    return NextResponse.json({ error: "Missing listing_id" }, { status: 400 });
  }

  const supabase = await createClient();

  // Only approved rentals matter for availability
  const { data, error } = await supabase
    .from("rentals")
    .select("start_date, end_date, buffer_days, status")
    .eq("listing_id", listingId)
    .eq("status", "approved");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return ranges; client will compute blocked dates
  return NextResponse.json({ rentals: data ?? [] });
}
