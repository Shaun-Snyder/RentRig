
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function getListingId(body: any) {
  const a = typeof body?.listing_id === "string" ? body.listing_id : "";
  const b = typeof body?.listingId === "string" ? body.listingId : "";
  const s = (a || b).trim();
  return s || null;
}

function getOrderArray(body: any): Array<{ id: string; sort_order: number }> | null {
  // Accept either "photos" (what your UI sends) or "order" (what older route might expect)
  const arr = Array.isArray(body?.photos) ? body.photos : Array.isArray(body?.order) ? body.order : null;
  if (!arr) return null;

  const cleaned: Array<{ id: string; sort_order: number }> = [];
  for (const item of arr) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    const sort_order =
      typeof item?.sort_order === "number"
        ? item.sort_order
        : typeof item?.sort_order === "string"
          ? Number(item.sort_order)
          : NaN;

    if (!id || Number.isNaN(sort_order)) return null;
    cleaned.push({ id, sort_order });
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "Not authenticated" });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Expected JSON body" });
  }

  const listingId = getListingId(body);
  if (!listingId) return json(400, { error: "Missing listing_id" });

  const order = getOrderArray(body);
  if (!order) return json(400, { error: "Missing order array (expected `photos` or `order`)" });

  // Verify listing ownership
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .single();

  if (listingErr) return json(400, { error: listingErr.message });
  if (!listing || listing.owner_id !== user.id) return json(403, { error: "Forbidden" });

  // Update each photo's sort_order (scoped to this listing)
  // NOTE: We scope by listing_id so you can't reorder someone else's photos.
  const updates = await Promise.all(
    order.map((p) =>
      supabase
        .from("listing_photos")
        .update({ sort_order: p.sort_order })
        .eq("id", p.id)
        .eq("listing_id", listingId)
    )
  );

  const firstErr = updates.find((u) => u.error)?.error;
  if (firstErr) return json(400, { error: firstErr.message });

  return json(200, { ok: true });
}

export async function GET() {
  return json(405, { error: "Method not allowed" });
}
