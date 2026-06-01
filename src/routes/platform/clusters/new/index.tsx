import { component$, useSignal } from "@builder.io/qwik";
import { Link, type DocumentHead, useLocation } from "@builder.io/qwik-city";
import { buildSeoHead } from "~/lib/seo";
import { setPrivateNoStore } from "~/lib/cache";
import type { RequestHandler } from "@builder.io/qwik-city";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  RocketIcon,
  LockIcon,
  ZapIcon,
} from "lucide-qwik";
import { requireAuth } from "~/lib/auth";
import { captureError } from "~/lib/sentry";
import { capture } from "~/lib/posthog";

export const onRequest: RequestHandler = (event) => {
  setPrivateNoStore(event);
  requireAuth(event);
};

export default component$(() => {
  const loc = useLocation();
  const initialTier = loc.url.searchParams.get("tier") || "fractional";
  const selectedTier = useSignal<string>(initialTier);
  const clusterName = useSignal<string>("");
  const storageGb = useSignal<number>(50);

  const vmPrices: Record<string, number> = {
    azure_micro: 3900,
    azure_standard: 8900,
    azure_pro: 17900,
    azure_scale: 35900,
    azure_gpu: 54900,
  };

  const getButtonText = () => {
    if (selectedTier.value === "fractional") return "Deploy Free Cluster";
    const basePriceCents = vmPrices[selectedTier.value] || 0;
    const storagePriceCents = storageGb.value * 15;
    const totalCents = basePriceCents + storagePriceCents;
    return `Pay $${(totalCents / 100).toFixed(2)} / month`;
  };

  const integrationPath = useSignal<"shared" | "dedicated">(
    initialTier === "fractional" ? "shared" : "dedicated",
  );

  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
      <main class="flex-1 overflow-y-auto p-8 lg:p-12 mb-20 max-w-5xl mx-auto w-full pt-[104px]">
        <header class="mb-12 flex flex-col gap-2">
          <Link
            href="/platform"
            class="text-tertiary hover:text-primary mb-4 flex items-center gap-1 transition-colors w-fit"
          >
            <ArrowLeftIcon class="w-4 h-4" />
            Back to Mission Control
          </Link>
          <h1 class="font-headline text-4xl font-extrabold tracking-tighter text-on-surface">
            Integrate Tellodb
          </h1>
          <p class="mt-2 text-tertiary">
            Select your integration architecture to connect your cognitive
            agents.
          </p>
        </header>

        {/* 1. Integration Model Choice */}
        <section class="mb-12">
          <h2 class="text-xl font-bold mb-4">1. Select Deployment Pathway</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
            {/* Option A: Shared Cloud (Pay-Per-Usage) */}
            <label
              class={`cursor-pointer rounded-2xl border-2 p-6 flex flex-col justify-between transition-all relative ${
                integrationPath.value === "shared"
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-outline-variant/10 bg-surface-container-low hover:border-primary/50"
              }`}
              onClick$={() => {
                integrationPath.value = "shared";
                selectedTier.value = "fractional";
              }}
            >
              <div>
                <div class="flex justify-between items-start mb-4">
                  <div>
                    <h3 class="font-extrabold text-xl text-on-surface">
                      Shared Public Engine
                    </h3>
                    <p class="text-xs text-primary font-mono mt-1">
                      Zero Config • Pay-as-you-go
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="path"
                    checked={integrationPath.value === "shared"}
                    onChange$={() => {
                      integrationPath.value = "shared";
                      selectedTier.value = "fractional";
                    }}
                    class="h-5 w-5 accent-primary cursor-pointer shrink-0"
                  />
                </div>
                <p class="text-sm text-tertiary mb-6 leading-relaxed">
                  Connect your cognitive agents instantly to our shared engine
                  at{" "}
                  <code class="text-amber-400 font-mono text-xs">
                    tellodb.com/api
                  </code>
                  . No servers to boot, no cloud accounts to manage.
                </p>
                <ul class="text-xs text-tertiary space-y-2 mb-6 border-t border-outline-variant/10 pt-4">
                  <li class="flex items-center gap-2">
                    <CheckCircle2Icon class="w-4 h-4 text-primary shrink-0" />
                    <span>10,000 free operations monthly</span>
                  </li>
                  <li class="flex items-center gap-2">
                    <CheckCircle2Icon class="w-4 h-4 text-primary shrink-0" />
                    <span>$1.00 / million operations thereafter</span>
                  </li>
                  <li class="flex items-center gap-2">
                    <CheckCircle2Icon class="w-4 h-4 text-primary shrink-0" />
                    <span>Access via global API keys</span>
                  </li>
                </ul>
              </div>
            </label>{" "}
            {/* Option B: Dedicated VM (Deploy Your Own Server) */}
            <label
              class={`cursor-pointer rounded-2xl border-2 p-6 flex flex-col justify-between transition-all relative ${
                integrationPath.value === "dedicated"
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-outline-variant/10 bg-surface-container-low hover:border-primary/50"
              }`}
              onClick$={() => {
                integrationPath.value = "dedicated";
                if (selectedTier.value === "fractional") {
                  selectedTier.value = "azure_micro"; // default dedicated tier
                }
              }}
            >
              <div>
                <div class="flex justify-between items-start mb-4">
                  <div>
                    <h3 class="font-extrabold text-xl text-on-surface">
                      Deploy Dedicated Server
                    </h3>
                    <p class="text-xs text-green-400 font-mono mt-1">
                      Single-tenant VM • Full Control
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="path"
                    checked={integrationPath.value === "dedicated"}
                    onChange$={() => {
                      integrationPath.value = "dedicated";
                      if (selectedTier.value === "fractional") {
                        selectedTier.value = "azure_micro";
                      }
                    }}
                    class="h-5 w-5 accent-primary cursor-pointer shrink-0"
                  />
                </div>
                <p class="text-sm text-tertiary mb-6 leading-relaxed">
                  Deploy a completely isolated virtual machine dedicated
                  exclusively to your database load in Azure. Once VM is ready,
                  we give you a direct server URL (public IP) with the full
                  engine stack running on it.
                </p>
                <ul class="text-xs text-tertiary space-y-2 mb-6 border-t border-outline-variant/10 pt-4">
                  <li class="flex items-center gap-2">
                    <CheckCircle2Icon class="w-4 h-4 text-green-400 shrink-0" />
                    <span>Isolated hardware resources (vCPUs, RAM, GPU)</span>
                  </li>
                  <li class="flex items-center gap-2">
                    <CheckCircle2Icon class="w-4 h-4 text-green-400 shrink-0" />
                    <span>Custom SSD storage slider selection</span>
                  </li>
                  <li class="flex items-center gap-2">
                    <CheckCircle2Icon class="w-4 h-4 text-green-400 shrink-0" />
                    <span>Full network and regional isolation</span>
                  </li>
                </ul>
              </div>
            </label>
          </div>
        </section>

        {integrationPath.value === "shared" && (
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-8 max-w-xl text-center">
            <RocketIcon class="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
            <h3 class="text-xl font-bold text-on-surface mb-2">
              Ready to ingest memories immediately
            </h3>
            <p class="text-sm text-tertiary mb-6 leading-relaxed">
              No deployment necessary. Since you selected the shared public
              engine, you can generate an API key on the Pay Per Usage tab and
              start indexing truths right away.
            </p>
            <Link
              href="/platform?tab=api"
              class="inline-block rounded-lg bg-primary px-8 py-3 font-bold text-on-primary transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              Go to Pay Per Usage & Create Key
            </Link>
          </div>
        )}

        {integrationPath.value === "dedicated" && (
          <form
            action="/api/billing/checkout"
            method="post"
            class="space-y-12 animate-fade-in"
          >
            <section>
              <h2 class="text-xl font-bold mb-4">2. Select Azure Region</h2>
              <select
                name="region"
                class="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary transition-colors max-w-md cursor-pointer"
                required
              >
                <option value="westus2" selected>
                  West US 2 (Washington)
                </option>
                <option value="eastus">East US (Virginia)</option>
                <option value="northeurope">North Europe (Ireland)</option>
                <option value="westeurope">West Europe (Netherlands)</option>
                <option value="southeastasia">
                  Southeast Asia (Singapore)
                </option>
              </select>
            </section>

            <section>
              <h2 class="text-xl font-bold mb-4">3. Cluster Name</h2>
              <input
                type="text"
                name="name"
                bind:value={clusterName}
                class="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary transition-colors max-w-md"
                placeholder="e.g. prod-memory-cluster"
                required
              />
            </section>

            <section>
              <h2 class="text-xl font-bold mb-4">
                4. Select Dedicated Compute Hardware
              </h2>
              <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    id: "azure_micro",
                    name: "Developer Micro",
                    subName: "Azure Standard_B2als_v2",
                    badge: "Dedicated VM",
                    badgeClass: "bg-green-500/10 text-green-400",
                    features: [
                      "2 vCPUs | 4 GiB RAM",
                      "10 GB SSD standard storage",
                      "Single-tenant VM instance",
                      "Best for development & sandboxing",
                    ],
                    priceText: "$39.00 / month",
                  },
                  {
                    id: "azure_standard",
                    name: "Agent Standard",
                    subName: "Azure Standard_D2as_v5",
                    badge: "Production VM",
                    badgeClass: "bg-blue-500/10 text-blue-400",
                    features: [
                      "2 vCPUs | 8 GiB RAM",
                      "50 GB SSD standard storage",
                      "Single-tenant VM instance",
                      "Best for low-latency agent memory",
                    ],
                    priceText: "$89.00 / month",
                  },
                  {
                    id: "azure_pro",
                    name: "Production Core",
                    subName: "Azure Standard_D4as_v5",
                    badge: "High Performance",
                    badgeClass: "bg-orange-500/10 text-orange-400",
                    features: [
                      "4 vCPUs | 16 GiB RAM",
                      "50 GB Premium SSD storage",
                      "Single-tenant VM instance",
                      "Best for high-concurrency production",
                    ],
                    priceText: "$179.00 / month",
                  },
                  {
                    id: "azure_scale",
                    name: "Scale Master",
                    subName: "Azure Standard_D8as_v5",
                    badge: "Enterprise VM",
                    badgeClass: "bg-purple-500/10 text-purple-400",
                    features: [
                      "8 vCPUs | 32 GiB RAM",
                      "100 GB Premium SSD storage",
                      "Single-tenant VM instance",
                      "Best for large knowledge graphs",
                    ],
                    priceText: "$359.00 / month",
                  },
                  {
                    id: "azure_gpu",
                    name: "GPU Superbrain",
                    subName: "Azure Standard_NC4as_T4",
                    badge: "GPU Accelerated",
                    badgeClass: "bg-rose-500/10 text-rose-400",
                    features: [
                      "4 vCPUs | 28 GiB RAM",
                      "1 NVIDIA T4 GPU",
                      "Single-tenant GPU VM instance",
                      "Hardware-accelerated embeddings & re-ranking",
                    ],
                    priceText: "$549.00 / month",
                  },
                ].map((tier) => {
                  const isSelected = selectedTier.value === tier.id;
                  return (
                    <label
                      key={tier.id}
                      class={`cursor-pointer rounded-2xl border-2 p-5 flex flex-col justify-between transition-all relative ${isSelected ? "border-primary bg-primary/5" : "border-outline-variant/10 bg-surface-container-low hover:border-primary/50"}`}
                      onClick$={() => {
                        selectedTier.value = tier.id;
                        capture("hardware_tier_selected", { tier: tier.id });
                      }}
                    >
                      <div>
                        <div class="flex justify-between items-start mb-3">
                          <div>
                            <h3 class="font-bold text-lg text-on-surface">
                              {tier.name}
                            </h3>
                            <p class="text-xs text-tertiary">{tier.subName}</p>
                          </div>
                          <div class="flex items-center gap-2">
                            <span
                              class={`rounded px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${tier.badgeClass}`}
                            >
                              {tier.badge}
                            </span>
                            <input
                              type="radio"
                              name="tier"
                              value={tier.id}
                              checked={isSelected}
                              onChange$={() => {
                                selectedTier.value = tier.id;
                              }}
                              class="h-4 w-4 accent-primary cursor-pointer shrink-0"
                            />
                          </div>
                        </div>
                        <ul class="text-xs text-tertiary space-y-2 mb-6">
                          {tier.features.map((f, i) => (
                            <li key={i} class="flex items-center gap-1.5">
                              <CheckCircle2Icon class="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p class="text-xs font-mono text-on-surface font-bold border-t border-outline-variant/10 pt-3 mt-auto">
                        {tier.priceText}
                      </p>
                    </label>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 class="text-xl font-bold mb-2">
                5. Configure Dedicated Storage
              </h2>
              <p class="text-xs text-tertiary mb-4">
                Select the SSD storage capacity for your database VM ($0.15 per
                GB / month).
              </p>
              <div class="flex items-center gap-6 bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6 max-w-xl">
                <div class="flex-grow">
                  <input
                    type="range"
                    name="storage_gb"
                    min="10"
                    max="1000"
                    step="10"
                    bind:value={storageGb}
                    class="w-full accent-primary cursor-pointer"
                  />
                  <div class="flex justify-between text-[10px] text-tertiary font-bold mt-2 font-mono">
                    <span>10 GB</span>
                    <span>250 GB</span>
                    <span>500 GB</span>
                    <span>750 GB</span>
                    <span>1000 GB (1 TB)</span>
                  </div>
                </div>
                <div class="text-center bg-black/30 border border-outline-variant/10 px-6 py-4 rounded-xl shrink-0 min-w-[120px]">
                  <p class="text-2xl font-extrabold font-mono text-on-surface">
                    {storageGb.value} GB
                  </p>
                  <p class="text-[10px] text-primary font-bold mt-1">
                    +${(storageGb.value * 0.15).toFixed(2)}/mo
                  </p>
                </div>
              </div>
            </section>

            <section class="mt-12 flex justify-end">
              <button
                type="submit"
                disabled={!clusterName.value}
                onClick$={() =>
                  capture("cluster_deploy_started", {
                    tier: selectedTier.value,
                    region: "selected",
                    storageGb: storageGb.value,
                  })
                }
                class="rounded-lg bg-primary px-8 py-3 font-bold text-on-primary transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {getButtonText()}
              </button>
            </section>
          </form>
        )}
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Deploy Cluster | ALETHEIADB",
  description: "Deploy a new Tellodb cluster.",
  pathname: "/platform/clusters/new",
  noindex: true,
});
