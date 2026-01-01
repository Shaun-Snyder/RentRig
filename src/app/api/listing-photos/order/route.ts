
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const listing_id = body?.listing_id as string | undefined;
  const order = body?.order as Array<{ id: string; sort_order: number }> | undefined;

  if (!listing_id || !Array.isArray(order)) {
    return NextResponse.json({ error: "Missing listing_id or order" }, { status: 400 });
  }

  // Ensure listing belongs to user
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listing_id)
    .single();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if ((listing as any).owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update each photo row sort_order (only within this listing)
  for (const row of order) {
    if (!row?.id) continue;
    const so = Number(row.sort_order ?? 0);

    const { error: upErr } = await supabase
      .from("listing_photos")
      .update({ sort_order: so })
      .eq("id", row.id)
      .eq("listing_id", listing_id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
