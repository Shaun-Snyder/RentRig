
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function getListingId(fd: FormData) {
  const a = fd.get("listing_id");
  const b = fd.get("listingId");
  const s = (typeof a === "string" ? a : typeof b === "string" ? b : "").trim();
  return s || null;
}

function getAnyFile(fd: FormData): File | null {
  const keys = ["file", "photo", "image"];
  for (const k of keys) {
    const v = fd.get(k);
    if (v instanceof File) return v;
  }
  for (const [, v] of fd.entries()) {
    if (v instanceof File) return v;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const listingId = req.nextUrl.searchParams.get("listing_id");

  if (!listingId) return json(400, { error: "listing_id is required" });

  const { data, error } = await supabase
    .from("listing_photos")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return json(400, { error: error.message });

  return json(200, { photos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "Not authenticated" });

  const fd = await req.formData();

  // DEBUG: show what keys are coming in
  const keys: string[] = [];
  for (const [k, v] of fd.entries()) {
    keys.push(`${k}:${v instanceof File ? `File(${v.name})` : String(v)}`);
  }
  console.log("listing-photos POST form keys:", keys);

  const listingId = getListingId(fd);
  const file = getAnyFile(fd);

  if (!listingId) return json(400, { error: "Missing listing_id", keys });
  if (!file) return json(400, { error: "Missing file", keys });

  // Make sure listing belongs to this user (listings table uses owner_id)
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .single();

  if (listingErr) return json(400, { error: listingErr.message });
  if (!listing || listing.owner_id !== user.id) return json(403, { error: "Forbidden" });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${listingId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const up = await supabase.storage.from("listing-photos").upload(path, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (up.error) return json(400, { error: up.error.message });

  // sort_order = append to end
  const { data: last, error: lastErr } = await supabase
    .from("listing_photos")
    .select("sort_order")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (lastErr) return json(400, { error: lastErr.message });

  const nextSort = (last?.[0]?.sort_order ?? -1) + 1;

  // listing_photos table uses uploaded_by (NOT owner_id)
  const ins = await supabase
    .from("listing_photos")
    .insert({
      listing_id: listingId,
      uploaded_by: user.id,
      path,
      sort_order: nextSort,
    })
    .select("*")
    .single();

  if (ins.error) return json(400, { error: ins.error.message });

  return json(200, { ok: true, photo: ins.data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "Not authenticated" });

  const photoId = req.nextUrl.searchParams.get("photo_id");
  if (!photoId) return json(400, { error: "photo_id is required" });

  const { data: photo, error: photoErr } = await supabase
    .from("listing_photos")
    .select("id, listing_id, path, uploaded_by")
    .eq("id", photoId)
    .single();

  if (photoErr) return json(400, { error: photoErr.message });
  if (!photo) return json(404, { error: "Not found" });

  // only uploader can delete
  if (photo.uploaded_by !== user.id) return json(403, { error: "Forbidden" });

  await supabase.storage.from("listing-photos").remove([photo.path]);

  const del = await supabase.from("listing_photos").delete().eq("id", photoId);
  if (del.error) return json(400, { error: del.error.message });

  return json(200, { ok: true });
}
