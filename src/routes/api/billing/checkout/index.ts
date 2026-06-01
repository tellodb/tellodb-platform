import type { RequestHandler } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { getCurrentUser } from "~/lib/auth";
import { getStripeClient, createStripeCustomer } from "~/lib/stripe";
import { createCluster } from "~/lib/clusters";
import { captureError } from "~/lib/sentry";

export const onPost: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const body = (await event.parseBody()) as {
      tier?: string;
      name?: string;
      region?: string;
      storage_gb?: string;
    } | null;
    const tier = body?.tier || "fractional";
    const name = (body?.name || "My Cluster").trim();
    const region = body?.region || "westus2";
    const storageGb =
      tier === "fractional"
        ? 10
        : Math.max(
            10,
            Math.min(1000, parseInt(body?.storage_gb || "50", 10) || 50),
          );

    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw new Error("Database connection offline");

    // 1. Create the cluster in the database
    const cluster = await createCluster(event, name, tier);
    if (!cluster) throw new Error("Failed to create cluster");

    // 2. Free tier — provision immediately and redirect to cluster page
    if (tier === "fractional") {
      throw event.redirect(302, `/platform/clusters/${cluster.id}`);
    }

    // Check if Stripe is in mock mode for local testing
    const stripeKey = event.env.get("STRIPE_SECRET_KEY") || "";
    const isMockStripe =
      !stripeKey || stripeKey.trim().startsWith("sk_test_...");

    // 3. Paid tier — create or get Stripe customer, then checkout
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.user_id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;
    if (!customerId && !isMockStripe) {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.admin.getUserById(user.user_id);
        if (authError || !authData?.user?.email) {
          throw new Error("Could not retrieve user email for billing");
        }
        const customer = await createStripeCustomer(
          event.env,
          authData.user.email,
          { user_id: user.user_id },
        );
        customerId = customer.id;

        await supabase.from("subscriptions").upsert(
          {
            user_id: user.user_id,
            stripe_customer_id: customerId,
            tier: "fractional",
            status: "active",
          },
          { onConflict: "user_id" },
        );
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        captureError(err, { action: "checkout_createCustomer" });
        console.error(
          "[Checkout] Stripe customer creation failed:",
          msg || err,
        );
        throw new Error("Failed to initialize payment gateway");
      }
    } else if (isMockStripe && !customerId) {
      customerId = "cus_mock_123";
    }

    const vmConfigs: Record<
      string,
      { name: string; description: string; priceCents: number; size: string }
    > = {
      azure_micro: {
        name: "Developer Micro",
        description: "Azure Standard_B2als_v2 dedicated VM",
        priceCents: 3900,
        size: "Standard_B2als_v2",
      },
      azure_standard: {
        name: "Agent Standard",
        description: "Azure Standard_D2as_v5 dedicated VM",
        priceCents: 8900,
        size: "Standard_D2as_v5",
      },
      azure_pro: {
        name: "Production Core",
        description: "Azure Standard_D4as_v5 dedicated VM",
        priceCents: 17900,
        size: "Standard_D4as_v5",
      },
      azure_scale: {
        name: "Scale Master",
        description: "Azure Standard_D8as_v5 dedicated VM",
        priceCents: 35900,
        size: "Standard_D8as_v5",
      },
      azure_gpu: {
        name: "GPU Superbrain",
        description: "Azure Standard_NC4as_T4 dedicated VM",
        priceCents: 54900,
        size: "Standard_NC4as_T4",
      },
    };

    const vmConfig = vmConfigs[tier];
    if (!vmConfig) {
      throw new Error("Invalid tier selected for deployment");
    }

    const totalCents = vmConfig.priceCents + storageGb * 15;
    // Update cluster status to provisioning for BYOC VM tiers.
    // Azure provisioning happens later in the webhook after payment.
    if (vmConfig) {
      await supabase
        .from("clusters")
        .update({
          tier,
          region,
          status: "provisioning",
          storage_gb: storageGb,
        })
        .eq("id", cluster.id);
    }

    // Upsert subscription record
    await supabase.from("subscriptions").upsert(
      {
        user_id: user.user_id,
        stripe_customer_id: customerId,
        tier,
        status: "incomplete",
        vm_size: vmConfig?.size || undefined,
        vm_monthly_price: vmConfig ? totalCents / 100 : undefined,
        storage_gb: storageGb,
      },
      { onConflict: "user_id" },
    );

    if (isMockStripe) {
      // In mock mode, immediately activate the cluster since no real Azure VM is provisioned
      const vmEndpoint = `https://${cluster.id}.vm.tellodb.com`;
      await supabase
        .from("clusters")
        .update({
          status: "active",
          endpoint_url: vmEndpoint,
          region,
          storage_gb: storageGb,
        })
        .eq("id", cluster.id);

      await supabase.from("subscriptions").upsert(
        {
          user_id: user.user_id,
          stripe_customer_id: "cus_mock_123",
          tier,
          status: "active",
          vm_size: vmConfig?.size || undefined,
          vm_monthly_price: vmConfig ? totalCents / 100 : undefined,
          storage_gb: storageGb,
        },
        { onConflict: "user_id" },
      );

      // Record mock purchase
      await supabase.from("purchases").insert({
        user_id: user.user_id,
        amount: totalCents / 100,
        description: `Tellodb - Dedicated VM (${vmConfig.name}, ${storageGb} GB Storage)`,
      });

      throw event.redirect(
        302,
        `/platform/clusters/${cluster.id}?success=true&mock=true`,
      );
    }

    let session;
    try {
      const stripe = getStripeClient(event.env);
      const origin = event.url.origin;

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Tellodb - ${vmConfig.name} (${storageGb} GB Storage)`,
                description: `${vmConfig.description} with ${storageGb} GB SSD storage included.`,
              },
              unit_amount: totalCents,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            user_id: user.user_id,
            cluster_id: cluster.id,
            tier,
            storage_gb: String(storageGb),
          },
        },
        success_url: `${origin}/platform/clusters/${cluster.id}?success=true`,
        cancel_url: `${origin}/platform/clusters/${cluster.id}?canceled=true`,
        metadata: {
          user_id: user.user_id,
          cluster_id: cluster.id,
          tier,
          storage_gb: String(storageGb),
        },
      });
    } catch (stripeErr: any) {
      const msg =
        stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      captureError(stripeErr, {
        action: "billingCheckout_stripeSession",
        tier,
        customerId,
      });
      console.error(
        "[Checkout] Stripe session creation failed:",
        msg || stripeErr,
      );
      throw new Error("Failed to initiate checkout session");
    }

    throw event.redirect(302, session.url!);
  } catch (e: any) {
    if (!(e instanceof Error)) throw e;
    const errMsg = e.message || "(no message)";
    captureError(e, { action: "billingCheckout" });
    console.error("[Checkout] Error:", errMsg);
    throw event.error(500, errMsg);
  }
};
