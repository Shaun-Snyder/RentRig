
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const rentalId = formData.get("rental_id");
  const file = formData.get("agreement");

  if (!rentalId || typeof rentalId !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing rental_id" },
      { status: 400 }
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "No agreement file uploaded" },
      { status: 400 }
    );
  }

  // Build a storage path: ownerId/rentalId/timestamp.ext
  const ext =
    file.name && file.name.includes(".")
      ? file.name.split(".").pop()!.toLowerCase()
      : "bin";

  const path = `${user.id}/${rentalId}/${Date.now()}.${ext}`;

  // Convert File -> Buffer for Node upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload into "rental-agreements" bucket
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("rental-agreements")
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError || !uploadData?.path) {
    console.error("Rental agreement upload error:", uploadError);
    return NextResponse.json(
      {
        ok: false,
        error: uploadError?.message || "Failed to upload agreement",
      },
      { status: 500 }
    );
  }

  // Get a public URL for the uploaded file
  const { data: publicData } = supabase
    .storage
    .from("rental-agreements")
    .getPublicUrl(uploadData.path);

  const publicUrl = publicData.publicUrl;

  // Save URL on the rentals table
  const { error: updateError } = await supabase
    .from("rentals")
    .update({ rental_agreement_url: publicUrl })
    .eq("id", rentalId);

  if (updateError) {
    console.error("Rental agreement DB update error:", updateError.message);
    return NextResponse.json(
      { ok: false, error: "Failed to save agreement URL" },
      { status: 500 }
    );
  }

    // Redirect back to the page the form came from (owner inspection page)
  const referer = request.headers.get("referer") || "/dashboard/owner-rentals";
  const url = new URL(referer, request.url);

  // 303 forces the browser to re-request the page as GET
  // so it won't POST to the inspection page and trigger the server action error.
  return NextResponse.redirect(url, { status: 303 });
}

