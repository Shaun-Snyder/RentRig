import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { rentalId } = await req.json();

  if (!rentalId) {
    return NextResponse.json({ error: "Missing rentalId" }, { status: 400 });
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, renter_id, listings:listing_id(owner_id)")
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const ownerId = (rental as any).listings?.owner_id;
  const renterId = (rental as any).renter_id;

  if (user.id !== ownerId && user.id !== renterId) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { error: deleteMessagesError } = await supabaseAdmin
  .from("rental_messages")
  .delete()
  .eq("rental_id", rentalId);

if (deleteMessagesError) {
  return NextResponse.json(
    { error: deleteMessagesError.message },
    { status: 500 }
  );
}
  const { error: deleteRentalError } = await supabaseAdmin
    .from("rentals")
    .delete()
    .eq("id", rentalId);

  if (deleteRentalError) {
    return NextResponse.json(
      { error: deleteRentalError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}