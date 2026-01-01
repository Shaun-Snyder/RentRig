
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

// Returns blocked date ranges for a listing based on APPROVED rentals.
// Blocked range semantics returned to UI:
//   start: inclusive
//   end_exclusive: exclusive (end_date + buffer_days)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listing_id = (searchParams.get("listing_id") ?? "").trim();

  if (!listing_id) {
    return NextResponse.json({ error: "missing listing_id" }, { status: 400 });
  }

  if (!isUuid(listing_id)) {
    return NextResponse.json(
      { error: `invalid input syntax for type uuid: "${listing_id}"` },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[availability] listing_id:", listing_id);
  console.log("[availability] url:", url);
  console.log("[availability] hasServiceKey:", !!serviceKey, "len:", serviceKey?.length);

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "missing env", hasUrl: !!url, hasServiceKey: !!serviceKey },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // Ensure listing exists
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listing_id)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "listing not found" }, { status: 404 });
  }

  // Fetch approved rentals
  const { data: rentals, error } = await supabase
    .from("rentals")
    .select("start_date, end_date, buffer_days")
    .eq("listing_id", listing_id)
    .eq("status", "approved");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const blocked = (rentals ?? []).map((r) => {
    const buffer = Number(r.buffer_days ?? 0);

    const end = new Date(r.end_date + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + buffer);

    return {
      start: r.start_date, // inclusive
      end_exclusive: end.toISOString().slice(0, 10), // exclusive
      buffer_days: buffer,
    };
  });

  return NextResponse.json({ listing_id, blocked });
}
