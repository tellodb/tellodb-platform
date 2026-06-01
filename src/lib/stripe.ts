import Stripe from "stripe";
import type { RequestEventCommon } from "@builder.io/qwik-city";

function getStripeKey(env: RequestEventCommon["env"]) {
  const key = env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return key;
}

export function getStripeClient(env: RequestEventCommon["env"]) {
  return new Stripe(getStripeKey(env), { apiVersion: "2024-06-20" });
}

export async function createStripeCustomer(env: RequestEventCommon["env"], email: string, metadata: Record<string, string> = {}) {
  return getStripeClient(env).customers.create({ email, metadata });
}

export async function createCheckoutSession(
  env: RequestEventCommon["env"],
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata: Record<string, string> = {}
) {
  return getStripeClient(env).checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
}

export async function createPortalSession(
  env: RequestEventCommon["env"],
  customerId: string,
  returnUrl: string
) {
  return getStripeClient(env).billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function constructWebhookEvent(
  env: RequestEventCommon["env"],
  rawBody: string,
  signature: string,
  secret?: string
) {
  const webhookSecret = secret || env.get("STRIPE_WEBHOOK_SECRET") || "";
  return getStripeClient(env).webhooks.constructEventAsync(
    rawBody,
    signature,
    webhookSecret
  );
}

export async function retrieveStripeSubscription(env: RequestEventCommon["env"], subscriptionId: string) {
  return getStripeClient(env).subscriptions.retrieve(subscriptionId);
}
