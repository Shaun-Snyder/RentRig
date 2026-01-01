
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

async function assertListingOwnedByUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  userId: string
) {
  // IMPORTANT: your listings table column is owner_id (underscore)
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .single();

  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!listing) return { ok: false as const, status: 404, error: "Listing not found" };
  if (listing.owner_id !== userId) return { ok: false as const, status: 403, error: "Forbidden" };

  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const listingId = req.nextUrl.searchParams.get("listing_id");
  if (!listingId) return json(400, { error: "listing_id is required" });

  const { data, error } = await supabase
    .from("listing_photos")
    .select("id, listing_id, path, sort_order, created_at")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return json(400, { error: error.message });

  const paths = (data ?? []).map((p) => p.path).filter(Boolean) as string[];

  // Signed URLs so your client can render them reliably
  const { data: signed, error: signedErr } = await supabase.storage
    .from("listing-photos")
    .createSignedUrls(paths, 60 * 60);

  if (signedErr) return json(400, { error: signedErr.message });

  const urlByPath = new Map<string, string>();
  (signed ?? []).forEach((x) => {
    if (x.path && x.signedUrl) urlByPath.set(x.path, x.signedUrl);
  });

  const photos = (data ?? []).map((p) => ({
    ...p,
    url: p.path ? urlByPath.get(p.path) ?? null : null,
  }));

  // Keep BOTH shapes so your UI won’t break depending on what it expects
  return json(200, {
    photos,
    urls: photos.map((p) => p.url).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "Not authenticated" });

  const fd = await req.formData();

  // DEBUG: show what keys are coming in (you can remove later)
  const keys: string[] = [];
  for (const [k, v] of fd.entries()) {
    keys.push(`${k}:${v instanceof File ? `File(${v.name})` : String(v)}`);
  }
  console.log("listing-photos POST form keys:", keys);

  const listingId = getListingId(fd);
  const file = getAnyFile(fd);

  if (!listingId) return json(400, { error: "Missing listing_id", keys });
  if (!file) return json(400, { error: "Missing file", keys });

  const own = await assertListingOwnedByUser(supabase, listingId, user.id);
  if (!own.ok) return json(own.status, { error: own.error });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${listingId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const up = await supabase.storage.from("listing-photos").upload(path, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (up.error) return json(400, { error: up.error.message, keys });

  // sort_order = append to end
  const { data: last, error: lastErr } = await supabase
    .from("listing_photos")
    .select("sort_order")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (lastErr) return json(400, { error: lastErr.message });

  const nextSort = (last?.[0]?.sort_order ?? -1) + 1;

  // ✅ FIX: listing_photos requires uploaded_by (NOT NULL)
  const ins = await supabase
    .from("listing_photos")
    .insert({
      listing_id: listingId,
      path,
      sort_order: nextSort,
      uploaded_by: user.id,
    })
    .select("id, listing_id, path, sort_order, created_at")
    .single();

  if (ins.error) return json(400, { error: ins.error.message });

  // Return a signed url for immediate UI update
  const { data: signedOne, error: signedOneErr } = await supabase.storage
    .from("listing-photos")
    .createSignedUrl(path, 60 * 60);

  if (signedOneErr) return json(200, { ok: true, photo: ins.data });

  return json(200, { ok: true, photo: { ...ins.data, url: signedOne?.signedUrl ?? null } });
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
  if (!photo) return json(404, { error: "Photo not found" });

  // If you want: only uploader can delete
  if (photo.uploaded_by && photo.uploaded_by !== user.id) return json(403, { error: "Forbidden" });

  // verify ownership via listing as well (extra safety)
  const own = await assertListingOwnedByUser(supabase, photo.listing_id, user.id);
  if (!own.ok) return json(own.status, { error: own.error });

  await supabase.storage.from("listing-photos").remove([photo.path]);

  const del = await supabase.from("listing_photos").delete().eq("id", photoId);
  if (del.error) return json(400, { error: del.error.message });

  return json(200, { ok: true });
}
