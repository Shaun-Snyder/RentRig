import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  const body = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const rentalId = session.metadata?.rental_id;

    if (!rentalId) {
      console.error("Stripe Checkout session missing rental_id metadata");

      return NextResponse.json(
        { error: "Missing rental metadata" },
        { status: 400 },
      );
    }

    const { data: rental, error: rentalLookupError } = await admin
      .from("rentals")
      .select("id, renter_id, stripe_checkout_session_id, payment_status")
      .eq("id", rentalId)
      .maybeSingle();

    if (rentalLookupError) {
      console.error(
        "Failed to verify rental for Stripe webhook:",
        rentalLookupError,
      );

      return NextResponse.json(
        { error: "Failed to verify rental" },
        { status: 500 },
      );
    }

    if (!rental) {
      console.error("Stripe webhook rental not found:", rentalId);

      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    if (rental.stripe_checkout_session_id !== session.id) {
      console.error("Stripe Checkout session does not match rental");

      return NextResponse.json(
        { error: "Checkout session mismatch" },
        { status: 400 },
      );
    }

    const sessionRenterId = session.metadata?.renter_id;

    if (!sessionRenterId || sessionRenterId !== rental.renter_id) {
      console.error("Stripe Checkout renter does not match rental");

      return NextResponse.json({ error: "Renter mismatch" }, { status: 400 });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    let chargeId: string | null = null;

    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["latest_charge"],
        },
      );

      chargeId =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : (paymentIntent.latest_charge?.id ?? null);
    }

    const { error: rentalUpdateError } = await admin
      .from("rentals")
      .update({
        payment_status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", rentalId)
      .neq("payment_status", "paid");

    if (rentalUpdateError) {
      console.error(
        "Failed to update rental after Stripe payment:",
        rentalUpdateError,
      );

      return NextResponse.json(
        { error: "Failed to update rental payment status" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true });
}
