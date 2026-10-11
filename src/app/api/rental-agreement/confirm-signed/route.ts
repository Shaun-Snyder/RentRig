import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { rentalId } = await request.json();

  if (!rentalId || typeof rentalId !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing rentalId" },
      { status: 400 },
    );
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, renter_id, rental_agreement_url, rental_agreement_signed")
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) {
    return NextResponse.json(
      { ok: false, error: "Rental not found" },
      { status: 404 },
    );
  }

  if (rental.renter_id !== user.id) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  if (!rental.rental_agreement_url) {
    return NextResponse.json(
      { ok: false, error: "No rental agreement has been uploaded." },
      { status: 400 },
    );
  }

  if (rental.rental_agreement_signed) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await supabase
    .from("rentals")
    .update({
      rental_agreement_signed: true,
      rental_agreement_signed_at: new Date().toISOString(),
    })
    .eq("id", rentalId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
