import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, message: "Not authenticated." },
      { status: 401 },
    );
  }

  const body = await req.json();
  const rentalId = String(body?.rentalId ?? "").trim();

  if (!rentalId) {
    return NextResponse.json(
      { ok: false, message: "Missing rental ID." },
      { status: 400 },
    );
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select(
      `
      id,
      listing_id,
      renter_id,
      status,
      payment_status,
      stripe_checkout_session_id,
      rental_subtotal,
      security_deposit_amount,
      delivery_selected,
      delivery_fee,
      owner_discount_amount,
      service_choice,
      service_total,
      operator_selected,
      operator_total,
      listings (
        id,
        owner_id,
        title
      )
    `,
    )
    .eq("id", rentalId)
    .eq("renter_id", user.id)
    .maybeSingle();

  if (rentalError) {
    console.error("Checkout rental lookup failed:", rentalError.message);

    return NextResponse.json(
      { ok: false, message: "Unable to load rental." },
      { status: 500 },
    );
  }

  if (!rental) {
    return NextResponse.json(
      { ok: false, message: "Rental not found." },
      { status: 404 },
    );
  }

  if (rental.status !== "approved") {
    return NextResponse.json(
      {
        ok: false,
        message: "This rental is not ready for payment.",
      },
      { status: 400 },
    );
  }
  if (
    rental.payment_status === "checkout_pending" &&
    rental.stripe_checkout_session_id
  ) {
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(
        rental.stripe_checkout_session_id,
      );

      if (existingSession.status === "open" && existingSession.url) {
        return NextResponse.json({
          ok: true,
          url: existingSession.url,
        });
      }
    } catch (error) {
      console.error("Existing Checkout session lookup failed:", error);
    }
  }

  if (rental.payment_status === "paid") {
    return NextResponse.json(
      {
        ok: false,
        message: "This rental has already been paid.",
      },
      { status: 400 },
    );
  }

  const listing = Array.isArray(rental.listings)
    ? (rental.listings[0] ?? null)
    : rental.listings;

  if (!listing) {
    return NextResponse.json(
      { ok: false, message: "Listing not found." },
      { status: 404 },
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: ownerProfile, error: ownerProfileError } = await admin
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", listing.owner_id)
    .maybeSingle();

  if (ownerProfileError) {
    console.error(
      "Checkout owner profile lookup failed:",
      ownerProfileError.message,
    );

    return NextResponse.json(
      { ok: false, message: "Unable to load owner payout account." },
      { status: 500 },
    );
  }

  if (!ownerProfile?.stripe_account_id) {
    return NextResponse.json(
      {
        ok: false,
        message: "The owner has not completed payout setup yet.",
      },
      { status: 400 },
    );
  }

  const rentalSubtotal = Math.max(0, Number(rental.rental_subtotal ?? 0) || 0);

  const deliveryCharge = rental.delivery_selected
    ? Math.max(0, Number(rental.delivery_fee ?? 0) || 0)
    : 0;

  const unifiedServiceTotal = Math.max(
    0,
    Number(rental.service_total ?? 0) || 0,
  );

  const legacyOperatorTotal = rental.operator_selected
    ? Math.max(0, Number(rental.operator_total ?? 0) || 0)
    : 0;

  const serviceCharge =
    rental.service_choice && rental.service_choice !== "none"
      ? unifiedServiceTotal
      : legacyOperatorTotal;

  const preDiscount = rentalSubtotal + deliveryCharge + serviceCharge;

  const ownerDiscount = Math.min(
    Math.max(0, Number(rental.owner_discount_amount ?? 0) || 0),
    preDiscount,
  );

  const rentalCharge = preDiscount - ownerDiscount;

  const securityDeposit = Math.max(
    0,
    Number(rental.security_deposit_amount ?? 0) || 0,
  );

  const totalDue = rentalCharge + securityDeposit;

  if (totalDue <= 0) {
    return NextResponse.json(
      { ok: false, message: "Rental total must be greater than zero." },
      { status: 400 },
    );
  }

  const origin = new URL(req.url).origin;

  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Rental - ${listing.title}`,
        },
        unit_amount: Math.round(rentalCharge * 100),
      },
      quantity: 1,
    },
  ];

  if (securityDeposit > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Refundable security deposit",
        },
        unit_amount: Math.round(securityDeposit * 100),
      },
      quantity: 1,
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: lineItems,
    success_url: `${origin}/dashboard/rentals/${rental.id}?payment=success`,
    cancel_url: `${origin}/dashboard/rentals/${rental.id}?payment=cancelled`,
    metadata: {
      rental_id: rental.id,
      renter_id: user.id,
      owner_id: listing.owner_id,
    },
    payment_intent_data: {
      metadata: {
        rental_id: rental.id,
        renter_id: user.id,
        owner_id: listing.owner_id,
      },
    },
  });

  if (!checkoutSession.url) {
    return NextResponse.json(
      { ok: false, message: "Stripe did not return a checkout URL." },
      { status: 500 },
    );
  }

  const { error: paymentUpdateError } = await supabase
    .from("rentals")
    .update({
      stripe_checkout_session_id: checkoutSession.id,
      payment_status: "checkout_pending",
    })
    .eq("id", rental.id)
    .eq("renter_id", user.id);

  if (paymentUpdateError) {
    console.error("Checkout rental update failed:", paymentUpdateError.message);

    return NextResponse.json(
      { ok: false, message: "Unable to save checkout session." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: checkoutSession.url,
  });
}
