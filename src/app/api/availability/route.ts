import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

// Returns blocked date ranges for a listing based on APPROVED rentals.
// We treat end_date as checkout/return day, and apply buffer_days.
// Blocked range semantics we return to UI: [start_date, end_date_plus_buffer) (end exclusive)
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

  // Use service role so this route can read approved rentals regardless of RLS.
  // Add SUPABASE_SERVICE_ROLE_KEY in Vercel env (Production + Preview).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error:
          "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars.",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // Optional: ensure listing exists
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listing_id)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "listing not found" }, { status: 404 });
  }

  const { data: rentals, error } = await supabase
    .from("rentals")
    .select("start_date, end_date, buffer_days, status")
    .eq("listing_id", listing_id)
    .eq("status", "approved");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const blocked = (rentals ?? []).map((r) => {
    const buffer = Number(r.buffer_days ?? 0);

    // end_exclusive = end_date + buffer_days
    // end_date is YYYY-MM-DD; easiest: return both and let client compute display.
    // We'll compute here as ISO date string.
    const end = new Date(r.end_date + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + buffer);
    const end_exclusive = end.toISOString().slice(0, 10);

    return {
      start: r.start_date,          // inclusive
      end_exclusive,               // exclusive
      buffer_days: buffer,
    };
  });

  return NextResponse.json({ listing_id, blocked });
}
