import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { rentalId } = await req.json();

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, renter_id, status")
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) {
    return NextResponse.json({ error: "Rental not found." }, { status: 404 });
  }

  if (rental.renter_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (rental.status !== "rejected") {
    return NextResponse.json(
      { error: "Only rejected rentals can be acknowledged." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("rentals")
    .update({ renter_rejection_acknowledged: true })
    .eq("id", rentalId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
