import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.stripe_account_id) {
      return NextResponse.json(
        { error: "Stripe connected account not found" },
        { status: 400 },
      );
    }

    const origin = new URL(req.url).origin;

    const accountLink = await stripe.v2.core.accountLinks.create({
      account: profile.stripe_account_id,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: `${origin}/dashboard`,
          return_url: `${origin}/dashboard`,
        },
      },
    });

    return NextResponse.json({
      url: accountLink.url,
    });
  } catch (error) {
    console.error("Create Stripe onboarding link failed:", error);

    return NextResponse.json(
      { error: "Unable to create Stripe onboarding link" },
      { status: 500 },
    );
  }
}
