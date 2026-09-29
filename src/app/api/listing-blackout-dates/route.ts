import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
  const blackoutDate = String(body?.blackoutDate ?? "").trim();

  if (!listingId || !validDate(blackoutDate)) {
    return NextResponse.json(
      { ok: false, message: "Invalid listing or blackout date." },
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

  const { data: inserted, error: insertError } = await supabase
    .from("listing_blackout_dates")
    .insert({
      listing_id: listingId,
      blackout_date: blackoutDate,
    })
    .select("id, blackout_date")
    .single();

  if (insertError) {
    return NextResponse.json(
      { ok: false, message: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    blackoutDate: inserted,
  });
}

export async function DELETE(req: NextRequest) {
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
  const id = String(body?.id ?? "").trim();

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Missing blackout date ID." },
      { status: 400 },
    );
  }

  const { data: blackout, error: blackoutError } = await supabase
    .from("listing_blackout_dates")
    .select("id, listing_id")
    .eq("id", id)
    .single();

  if (blackoutError || !blackout) {
    return NextResponse.json(
      { ok: false, message: "Blackout date not found." },
      { status: 404 },
    );
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", blackout.listing_id)
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

  const { error: deleteError } = await supabase
    .from("listing_blackout_dates")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      { ok: false, message: deleteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
