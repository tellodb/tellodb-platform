import type { RequestHandler } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { getCurrentUser } from "~/lib/auth";
import { getStripeClient, createStripeCustomer } from "~/lib/stripe";
import { captureError } from "~/lib/sentry";

const PACKAGES: Record<string, { name: string; description: string; priceCents: number; tokens: number }> = {
  starter: {
    name: "$5.00 Starter Pack",
    description: "3,125,000 truths / operations ($1.60 per million, 20% lower than Pinecone)",
    priceCents: 500,
    tokens: 3125000,
  },
  growth: {
    name: "$10.00 Growth Pack",
    description: "6,666,666 truths / operations ($1.50 per million, 25% lower than Pinecone)",
    priceCents: 1000,
    tokens: 6666666,
  },
  scale: {
    name: "$20.00 Scale Pack",
    description: "15,000,000 truths / operations ($1.33 per million, 33% lower than Pinecone)",
    priceCents: 2000,
    tokens: 15000000,
  },
};

export const onPost: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const body = (await event.parseBody()) as { package_id?: string } | null;
    const packageId = body?.package_id || "starter";
    const pack = PACKAGES[packageId];

    if (!pack) throw new Error("Invalid token package selected");

    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw new Error("Database connection offline");

    // Check if Stripe is in mock mode for local testing
    const stripeKey = event.env.get("STRIPE_SECRET_KEY") || "";
    const isMockStripe = !stripeKey || stripeKey.trim().startsWith("sk_test_...");

    // 1. Get or create Stripe customer
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.user_id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;
    if (!customerId && !isMockStripe) {
      try {
        const { data: authData, error: authError } = await supabase.auth.admin.getUserById(user.user_id);
        if (authError || !authData?.user?.email) {
          throw new Error("Could not retrieve user email for billing");
        }
        const customer = await createStripeCustomer(event.env, authData.user.email, { user_id: user.user_id });
        customerId = customer.id;

        // Upsert subscription record with customer ID
        await supabase.from("subscriptions").upsert({
          user_id: user.user_id,
          stripe_customer_id: customerId,
          tier: "fractional",
          status: "active",
        }, { onConflict: "user_id" });
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        captureError(err, { action: "buyTokens_createCustomer" });
        console.error("Stripe customer creation error:", msg || err);
        throw new Error("Failed to initialize payment gateway");
      }
    } else if (isMockStripe && !customerId) {
      customerId = "cus_mock_123";
    }
    if (isMockStripe) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("token_balance")
        .eq("user_id", user.user_id)
        .maybeSingle();

      const currentBalance = sub?.token_balance ?? 10000;
      await supabase.from("subscriptions").upsert({
        user_id: user.user_id,
        token_balance: currentBalance + pack.tokens,
        stripe_customer_id: "cus_mock_123",
        tier: "fractional",
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Record mock purchase
      await supabase.from("purchases").insert({
        user_id: user.user_id,
        amount: pack.priceCents / 100,
        description: `Prepaid Credits - Refill ${pack.tokens.toLocaleString()} truths`,
      });

      throw event.redirect(302, `/platform/billing?success=true&tokens=${pack.tokens}&mock=true`);
    }

    // 2. Create Stripe Checkout Session in payment mode
    const stripe = getStripeClient(event.env);
    const origin = event.url.origin;

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: pack.name,
                description: pack.description,
              },
              unit_amount: pack.priceCents,
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/platform/billing?success=true&tokens=${pack.tokens}`,
        cancel_url: `${origin}/platform/billing?canceled=true`,
        metadata: {
          type: "prepaid_tokens",
          user_id: user.user_id,
          token_count: String(pack.tokens),
        },
      });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      captureError(err, { action: "buyTokens_createCheckout" });
      console.error("Stripe checkout error:", msg || err);
      throw new Error("Failed to initiate checkout");
    }
    throw event.redirect(302, session.url!);
  } catch (e: any) {
    if (!(e instanceof Error)) throw e;
    const errMsg = e.message || "(no message)";
    captureError(e, { action: "buyTokens" });
    console.error("[BuyTokens] Error:", errMsg);
    throw event.error(500, errMsg);
  }
};
