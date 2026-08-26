import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DayInput = {
  weekday: number;
  start_time: string;
  end_time: string;
};

function validTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Not authenticated." },
      { status: 401 },
    );
  }

  const body = await req.json();

  const listingId = String(body?.listingId ?? "").trim();
  const days: DayInput[] = Array.isArray(body?.days) ? body.days : [];

  if (!listingId) {
    return NextResponse.json(
      { ok: false, message: "Missing listing ID." },
      { status: 400 },
    );
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    return NextResponse.json(
      { ok: false, message: "Listing not found." },
      { status: 404 },
    );
  }

  if (listing.owner_id !== user.id) {
    return NextResponse.json(
      { ok: false, message: "Forbidden." },
      { status: 403 },
    );
  }

  for (const day of days) {
    if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) {
      return NextResponse.json(
        { ok: false, message: "Invalid weekday." },
        { status: 400 },
      );
    }

    if (!validTime(day.start_time) || !validTime(day.end_time)) {
      return NextResponse.json(
        { ok: false, message: "Invalid start or end time." },
        { status: 400 },
      );
    }

    if (day.end_time <= day.start_time) {
      return NextResponse.json(
        {
          ok: false,
          message: "End time must be later than start time.",
        },
        { status: 400 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("listing_hourly_availability")
    .delete()
    .eq("listing_id", listingId);

  if (deleteError) {
    return NextResponse.json(
      { ok: false, message: deleteError.message },
      { status: 500 },
    );
  }

  if (days.length > 0) {
    const rows = days.map((day) => ({
      listing_id: listingId,
      weekday: day.weekday,
      start_time: day.start_time,
      end_time: day.end_time,
    }));

    const { error: insertError } = await supabase
      .from("listing_hourly_availability")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { ok: false, message: insertError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
