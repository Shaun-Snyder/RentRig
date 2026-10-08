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

  const { data: rental } = await supabase
    .from("rentals")
    .select("id, renter_id, status, renter_returned")
    .eq("id", rentalId)
    .single();

  if (!rental || rental.renter_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (rental.status !== "approved") {
    return NextResponse.json(
      { error: "Only approved rentals can be marked returned." },
      { status: 400 },
    );
  }

  if (rental.renter_returned) {
    return NextResponse.json({ ok: true });
  }

  // Require both owner and renter pre-rental condition reports
  const { data: preRentalInspections, error: inspectionError } = await supabase
    .from("rental_inspections")
    .select("role")
    .eq("rental_id", rentalId)
    .eq("phase", "checkin")
    .in("role", ["owner", "renter"]);

  if (inspectionError) {
    return NextResponse.json(
      { error: inspectionError.message },
      { status: 500 },
    );
  }

  const hasOwnerPreRental = (preRentalInspections ?? []).some(
    (inspection) => inspection.role === "owner",
  );

  const hasRenterPreRental = (preRentalInspections ?? []).some(
    (inspection) => inspection.role === "renter",
  );

  if (!hasOwnerPreRental || !hasRenterPreRental) {
    return NextResponse.json(
      {
        error:
          "Both the owner and renter pre-rental condition reports must be completed before this rental can be marked returned.",
      },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("rentals")
    .update({ renter_returned: true })
    .eq("id", rentalId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
