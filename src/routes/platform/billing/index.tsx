import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  CreditCardIcon,
} from "lucide-qwik";
import { buildSeoHead } from "~/lib/seo";
import { setPrivateNoStore } from "~/lib/cache";
import type { RequestHandler } from "@builder.io/qwik-city";
import { getSubscription } from "~/lib/subscriptions";
import { requireAuth } from "~/lib/auth";
import { captureError } from "~/lib/sentry";
import { capture } from "~/lib/posthog";

export const onRequest: RequestHandler = (event) => {
  const search = event.url.search;
  throw event.redirect(302, `/platform?tab=billing${search}`);
};

export const useBillingData = routeLoader$(async (event) => {
  try {
    const user = requireAuth(event);
    const sub = await getSubscription(event);
    return { user, sub };
  } catch (e) {
    captureError(e, { page: "billing" });
    throw e;
  }
});

const plans = [
  {
    id: "fractional",
    name: "Fractional",
    price: "$1.00",
    unit: "/1M truths",
    description: "Pay-as-you-go on the TelloDB shared engine",
    features: [
      "Shared compute instance",
      "10,000 free operations/mo",
      "$1.00 per million operations thereafter",
      "Access via global API endpoint",
    ],
    cta: "Current Plan",
    highlighted: false,
  },
  {
    id: "azure_micro",
    name: "Developer Micro",
    price: "$39.00",
    unit: "/month",
    description: "Azure Standard_B2als_v2 dedicated VM",
    features: [
      "2 vCPUs | 4 GiB RAM",
      "10 GB SSD standard storage",
      "Single-tenant VM instance",
      "Best for development & sandboxing",
    ],
    cta: "Deploy VM",
    highlighted: false,
  },
  {
    id: "azure_standard",
    name: "Agent Standard",
    price: "$89.00",
    unit: "/month",
    description: "Azure Standard_D2as_v5 dedicated VM",
    features: [
      "2 vCPUs | 8 GiB RAM",
      "50 GB SSD standard storage",
      "Single-tenant VM instance",
      "Best for low-latency agent memory",
    ],
    cta: "Deploy VM",
    highlighted: false,
  },
  {
    id: "azure_pro",
    name: "Production Core",
    price: "$179.00",
    unit: "/month",
    description: "Azure Standard_D4as_v5 dedicated VM",
    features: [
      "4 vCPUs | 16 GiB RAM",
      "50 GB Premium SSD storage",
      "Single-tenant VM instance",
      "Best for high-concurrency production",
    ],
    cta: "Deploy VM",
    highlighted: true,
  },
  {
    id: "azure_scale",
    name: "Scale Master",
    price: "$359.00",
    unit: "/month",
    description: "Azure Standard_D8as_v5 dedicated VM",
    features: [
      "8 vCPUs | 32 GiB RAM",
      "100 GB Premium SSD storage",
      "Single-tenant VM instance",
      "Best for large knowledge graphs",
    ],
    cta: "Deploy VM",
    highlighted: false,
  },
  {
    id: "azure_gpu",
    name: "GPU Superbrain",
    price: "$549.00",
    unit: "/month",
    description: "Azure Standard_NC4as_T4 GPU VM",
    features: [
      "4 vCPUs | 28 GiB RAM",
      "1 NVIDIA T4 GPU",
      "Single-tenant GPU VM instance",
      "Hardware-accelerated embeddings & re-ranking",
    ],
    cta: "Deploy VM",
    highlighted: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    unit: "",
    description: "Custom deployment, on-premise option",
    features: [
      "Unlimited requests",
      "Unlimited storage",
      "Dedicated infrastructure",
      "Custom SLA",
      "24/7 priority support",
    ],
    cta: "Contact Sales",
    highlighted: false,
    contact: true,
  },
];

export default component$(() => {
  const data = useBillingData();
  const sub = data.value.sub;

  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
      <main class="flex-1 overflow-y-auto p-8 lg:p-12 mb-20 max-w-5xl mx-auto w-full pt-[104px]">
        <header class="mb-12">
          <Link
            href="/platform"
            class="text-tertiary hover:text-primary flex items-center gap-1 transition-colors w-fit"
          >
            <ArrowLeftIcon class="w-4 h-4" />
            Mission Control
          </Link>
          <h1 class="font-headline text-4xl font-extrabold tracking-tighter text-on-surface mt-4">
            Billing & Prepaid Usage
          </h1>
          <p class="text-tertiary mt-2">
            Manage your cognitive memory credits and hosting plans.
          </p>
        </header>

        {/* Prepaid Token Balance & Monthly Free Allocation */}
        <section class="mb-12 grid gap-6 md:grid-cols-2">
          {/* Token Credits Status */}
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 flex flex-col justify-between">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1">
                <CheckIcon class="w-4 h-4 text-primary" /> Active Credits
              </p>
              <h2 class="text-3xl font-extrabold text-on-surface">
                {sub?.token_balance !== undefined
                  ? sub.token_balance.toLocaleString()
                  : "10,000"}
                <span class="text-sm font-medium text-tertiary ml-2">
                  truths remaining
                </span>
              </h2>

              {/* Monthly Free Tier Progress */}
              {sub?.token_balance !== undefined &&
              sub.token_balance <= 10000 ? (
                <div class="mt-6">
                  <div class="flex justify-between text-xs font-bold text-tertiary mb-1">
                    <span>Monthly Free Allocation</span>
                    <span>
                      {sub.token_balance.toLocaleString()} / 10,000 left
                    </span>
                  </div>
                  <div class="w-full bg-outline-variant/20 rounded-full h-2 overflow-hidden">
                    <div
                      class="bg-primary h-full transition-all duration-500"
                      style={{ width: `${(sub.token_balance / 10000) * 100}%` }}
                    ></div>
                  </div>
                  <p class="text-[10px] text-tertiary mt-2">
                    Resets automatically every 30 days. Ingestions and queries
                    deduct 1 credit each.
                  </p>
                </div>
              ) : (
                <p class="text-xs text-green-400 font-medium mt-4">
                  Free tier fully utilized. Active prepaid growth credits:{" "}
                  {((sub?.token_balance || 10000) - 10000).toLocaleString()}{" "}
                  truths.
                </p>
              )}
            </div>
          </div>

          {/* Refill Tokens Selector */}
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6">
            <p class="text-xs font-bold uppercase tracking-widest text-tertiary mb-4">
              Refill Prepaid Tokens
            </p>
            <div class="space-y-3">
              {[
                {
                  id: "starter",
                  name: "Starter Refill ($5.00)",
                  desc: "3.1M truths (~$1.60/M)",
                  tokens: 3125000,
                },
                {
                  id: "growth",
                  name: "Growth Refill ($10.00)",
                  desc: "6.6M truths (~$1.50/M)",
                  tokens: 6666666,
                },
                {
                  id: "scale",
                  name: "Scale Refill ($20.00)",
                  desc: "15.0M truths (~$1.33/M)",
                  tokens: 15000000,
                },
              ].map((pack) => (
                <form
                  key={pack.id}
                  method="post"
                  action="/api/billing/buy-tokens"
                  class="flex items-center justify-between p-3 rounded-xl border border-outline-variant/5 bg-black/20 hover:border-primary/30 transition-all"
                >
                  <input type="hidden" name="package_id" value={pack.id} />
                  <div>
                    <p class="text-sm font-bold">{pack.name}</p>
                    <p class="text-[10px] text-tertiary">{pack.desc}</p>
                  </div>
                  <button
                    type="submit"
                    onClick$={() => capture("token_purchase_clicked")}
                    class="rounded-lg bg-primary px-4 py-2 font-bold text-xs text-on-primary hover:opacity-90 transition-opacity"
                  >
                    Buy
                  </button>
                </form>
              ))}
            </div>
          </div>
        </section>

        {/* Current Plan Info */}
        {sub && (
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 mb-8">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-bold uppercase tracking-widest text-tertiary mb-1">
                  Current Plan
                </p>
                <p class="text-2xl font-bold capitalize">
                  {sub.tier?.replace("_", " ") || "Fractional"}
                </p>
                <p class="text-sm text-tertiary mt-1">
                  Status:{" "}
                  <span class="capitalize text-green-400 font-medium">
                    {sub.status}
                  </span>
                </p>
              </div>
              {sub.stripe_customer_id && (
                <form method="post" action="/api/billing/portal">
                  <button
                    type="submit"
                    class="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-6 py-3 font-bold text-sm text-primary transition-all hover:bg-primary hover:text-white"
                  >
                    <CreditCardIcon class="w-4 h-4" />
                    Manage in Stripe
                    <ExternalLinkIcon class="w-3 h-3" />
                  </button>
                </form>
              )}
            </div>
            {sub.current_period_end && (
              <p class="text-xs text-tertiary mt-3">
                Current period ends:{" "}
                {new Date(sub.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Plan Cards */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = sub?.tier === plan.id;
            return (
              <div
                key={plan.id}
                class={`rounded-2xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "border-outline-variant/10 bg-surface-container-low"
                } ${isCurrent ? "ring-2 ring-primary" : ""}`}
              >
                {plan.highlighted && !isCurrent && (
                  <span class="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                    Popular
                  </span>
                )}
                <h3 class="text-xl font-bold">{plan.name}</h3>
                <p class="text-3xl font-extrabold mt-2">
                  {plan.price}
                  <span class="text-sm font-normal text-tertiary">
                    {plan.unit}
                  </span>
                </p>
                <p class="text-sm text-tertiary mt-2 mb-4">
                  {plan.description}
                </p>
                <ul class="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} class="flex items-start gap-2 text-sm">
                      <CheckIcon class="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button
                    disabled
                    class="w-full py-3 px-4 rounded-xl border border-outline-variant/20 text-sm font-bold text-tertiary cursor-default"
                  >
                    Current Plan
                  </button>
                ) : plan.contact ? (
                  <a
                    href="mailto:sales@tellodb.com"
                    class="block w-full text-center py-3 px-4 rounded-xl border border-outline-variant/20 text-sm font-bold hover:bg-surface-container-high transition-colors"
                  >
                    Contact Sales
                  </a>
                ) : (
                  <Link
                    href={`/platform/clusters/new?tier=${plan.id}`}
                    class="block w-full text-center py-3 px-4 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Billing | TelloDB",
  description: "Manage your billing and subscription.",
  pathname: "/platform/billing",
  noindex: true,
});
