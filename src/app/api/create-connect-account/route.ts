import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
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

    if (profile?.stripe_account_id) {
      return NextResponse.json({
        accountId: profile.stripe_account_id,
      });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "Account email is required" },
        { status: 400 },
      );
    }

    const account = await stripe.v2.core.accounts.create({
      display_name: user.email,
      contact_email: user.email,
      dashboard: "express",
      defaults: {
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      identity: {
        country: "US",
        entity_type: "company",
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: {
                requested: true,
              },
            },
          },
        },
      },
    });

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ stripe_account_id: account.id })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      accountId: account.id,
    });
  } catch (error) {
    console.error("Create Stripe connected account failed:", error);

    return NextResponse.json(
      { error: "Unable to create Stripe connected account" },
      { status: 500 },
    );
  }
}
