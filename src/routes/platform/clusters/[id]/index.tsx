import {
  component$,
  useVisibleTask$,
  useSignal,
  useTask$,
} from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  Link,
  type DocumentHead,
  useLocation,
  useNavigate,
} from "@builder.io/qwik-city";
import { buildSeoHead } from "~/lib/seo";
import { setPrivateNoStore } from "~/lib/cache";
import type { RequestHandler } from "@builder.io/qwik-city";
import { getProvisioningSteps } from "~/lib/azure";
import {
  ArrowLeftIcon,
  RocketIcon,
  CopyIcon,
  KeyIcon,
  NetworkIcon,
  BarChart3Icon,
  ActivityIcon,
  DatabaseIcon,
  UsersIcon,
  FileTextIcon,
  ServerIcon,
  RefreshCwIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-qwik";
import { requireAuth } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { type HardwareStats } from "~/lib/tellodb-core";
import { createApiKey, revokeApiKey } from "~/lib/api-keys";
import { captureError } from "~/lib/sentry";
import { capture } from "~/lib/posthog";
import { captureServer } from "~/lib/posthog";

export const onRequest: RequestHandler = (event) => {
  setPrivateNoStore(event);
};

export const useClusterDetail = routeLoader$(async (event) => {
  try {
    const user = requireAuth(event);
    const clusterId = event.params.id;
    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database connection offline");

    const { data: cluster } = await supabase
      .from("clusters")
      .select("*")
      .eq("id", clusterId)
      .single();
    if (!cluster || cluster.user_id !== user.user_id)
      throw event.error(404, "Not found");

    const apiKey =
      cluster.engine_key ||
      event.env.get("TELLODB_ADMIN_KEY") ||
      "82a2cd542b86763b5941fba04db9802928c53a27256fcccb64e12f414f69826a";

    const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", user.user_id)
      .eq("cluster_id", clusterId)
      .order("created_at", { ascending: false });

    const mappedKeys = apiKeys
      ? apiKeys.map((k: any) => ({
          key_id: k.id,
          name: k.name,
          key_prefix: k.key_value.substring(0, 8),
          created_at_ms: new Date(k.created_at).getTime(),
          last_used_ms: k.last_used_at
            ? new Date(k.last_used_at).getTime()
            : null,
          disabled: !k.is_active,
        }))
      : [];

    return { cluster, user, apiKey, apiKeys: mappedKeys };
  } catch (e) {
    captureError(e, { page: "cluster_detail" });
    throw e;
  }
});

export const useCreateClusterApiKey = routeAction$(async (data, event) => {
  try {
    requireAuth(event);
    const clusterId = event.params.id;
    const name = String(data.name ?? "New API Key");

    const result = await createApiKey(event, name, clusterId);

    return {
      success: !!result,
      key: result?.key ?? null,
      engineSynced: result?.engineSynced ?? false,
      engineError: result?.engineError,
    };
  } catch (e) {
    captureError(e, { page: "cluster_detail", action: "createApiKey" });
    return { success: false };
  }
});

export const useRevokeClusterApiKey = routeAction$(async (data, event) => {
  try {
    requireAuth(event);
    const id = String(data.id ?? "");

    if (id) {
      await revokeApiKey(event, id);
    }

    return {
      revoked: true,
    };
  } catch (e) {
    captureError(e, { page: "cluster_detail", action: "revokeApiKey" });
    return { revoked: false };
  }
});

export const useDeleteCluster = routeAction$(async (data, event) => {
  try {
    const user = requireAuth(event);
    const clusterId = String(data.cluster_id || "");
    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database connection offline");

    // 1. Get cluster detail to verify ownership
    const { data: cluster } = await supabase
      .from("clusters")
      .select("user_id, tier, region, status")
      .eq("id", clusterId)
      .single();

    if (!cluster || cluster.user_id !== user.user_id) {
      throw event.error(404, "Cluster not found");
    }

    // 2. Delete Azure VM if dedicated tier
    if (
      cluster.tier !== "fractional" &&
      cluster.region &&
      cluster.region !== "shared"
    ) {
      const supabaseUrl = (import.meta.env.PUBLIC_SUPABASE_URL || "").replace(
        /\/+$/,
        "",
      );
      const functionUrl = `${supabaseUrl}/functions/v1/cleanup-vm`;

      try {
        const fnRes = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: event.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
          },
          body: JSON.stringify({ clusterId, region: cluster.region }),
        });
        if (!fnRes.ok) {
          const err = await fnRes.json();
          console.error(`Azure cleanup failed for ${clusterId}: ${err.error}`);
        }
      } catch (fnErr: any) {
        console.error(
          `Azure cleanup call failed for ${clusterId}:`,
          fnErr.message,
        );
      }
    }

    // 3. Cancel Stripe subscription if it's a dedicated VM and user has subscription
    if (cluster.tier !== "fractional") {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", user.user_id)
        .maybeSingle();

      if (sub?.stripe_subscription_id) {
        try {
          const stripeKey = event.env.get("STRIPE_SECRET_KEY") || "";
          const isMockStripe =
            !stripeKey || stripeKey.trim().startsWith("sk_test_...");
          if (!isMockStripe) {
            const { getStripeClient } = await import("~/lib/stripe");
            const stripe = getStripeClient(event.env);
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
          }
        } catch (stripeErr) {
          console.error(
            "Failed to cancel Stripe subscription during cluster deletion:",
            stripeErr,
          );
        }
      }

      // Downgrade subscription record to fractional/canceled
      await supabase
        .from("subscriptions")
        .update({
          tier: "fractional",
          status: "canceled",
          vm_size: null,
          vm_monthly_price: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.user_id);
    }

    // 4. Soft delete the cluster
    const { error } = await supabase
      .from("clusters")
      .update({ status: "deleted" })
      .eq("id", clusterId);

    if (error) {
      throw event.error(500, "Failed to delete cluster");
    }

    await captureServer("cluster_deleted", user.user_id, {
      clusterId,
      tier: cluster.tier,
    });
    throw event.redirect(302, "/platform");
  } catch (e) {
    captureError(e, { page: "cluster_detail", action: "deleteCluster" });
    throw e;
  }
});

export const useRetryProvision = routeAction$(async (data, event) => {
  try {
    const user = requireAuth(event);
    const clusterId = String(data.cluster_id || "");
    const region = String(data.region || "westus2");
    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database connection offline");

    const { data: cluster } = await supabase
      .from("clusters")
      .select("id, user_id, tier, status")
      .eq("id", clusterId)
      .maybeSingle();

    if (!cluster || cluster.user_id !== user.user_id) {
      throw event.error(404, "Cluster not found");
    }

    if (cluster.status === "active") {
      throw event.error(400, "Cluster is already active");
    }

    const vmSizeMap: Record<string, string> = {
      azure_micro: "Standard_B2als_v2",
      azure_standard: "Standard_D2as_v5",
      azure_pro: "Standard_D4as_v5",
      azure_scale: "Standard_D8as_v5",
      azure_gpu: "Standard_NC4as_T4",
    };

    const tier = cluster.tier || "azure_standard";
    const vmSize = vmSizeMap[tier] || "Standard_D2s_v5";
    const storageGb = parseInt(String(data.storage_gb || "50"), 10);

    await supabase
      .from("clusters")
      .update({
        status: "provisioning",
        region,
      })
      .eq("id", clusterId);

    const supabaseUrl = (import.meta.env.PUBLIC_SUPABASE_URL || "").replace(
      /\/+$/,
      "",
    );
    const functionUrl = `${supabaseUrl}/functions/v1/provision-vm`;

    try {
      const fnRes = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: event.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        },
        body: JSON.stringify({ clusterId, tier, region, vmSize, storageGb }),
      });

      const fnResult = await fnRes.json();
      if (fnResult.submitted) {
        await supabase.from("clusters").update({ region }).eq("id", clusterId);
        return { success: true, region, steps: fnResult.steps || [] };
      } else {
        await supabase
          .from("clusters")
          .update({ status: "failed" })
          .eq("id", clusterId);
        return {
          success: false,
          error: fnResult.error || "Provisioning failed",
          steps: fnResult.steps || [],
        };
      }
    } catch (fnErr: any) {
      await supabase
        .from("clusters")
        .update({ status: "failed" })
        .eq("id", clusterId);
      return {
        success: false,
        error: fnErr.message || "Edge function call failed",
        steps: [],
      };
    }
  } catch (e) {
    captureError(e, { page: "cluster_detail", action: "retryProvision" });
    return { success: false, error: "An unexpected error occurred" };
  }
});

function formatDate(value: number, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const LocalDateTime = component$((props: { value: number | null }) => {
  const label = useSignal(
    props.value ? formatDate(props.value, "en-US") : "Never",
  );

  useVisibleTask$(({ track }) => {
    track(() => props.value);
    if (!props.value) {
      label.value = "Never";
      return;
    }

    label.value = formatDate(props.value);
  });

  return <>{label.value}</>;
});

export default component$(() => {
  const data = useClusterDetail();
  const deleteAction = useDeleteCluster();
  const retryAction = useRetryProvision();
  const createApiKeyAction = useCreateClusterApiKey();
  const revokeApiKeyAction = useRevokeClusterApiKey();
  const cluster = data.value.cluster as any;
  const stats = useSignal<any>(null);
  const apiKey = data.value.apiKey as string;
  const apiKeys = data.value.apiKeys || [];
  const retrying = useSignal(false);
  const showKey = useSignal(false);
  const newApiKeyName = useSignal("");
  const showApiKeyCreate = useSignal(false);
  const hardwareStats = useSignal<HardwareStats | null>(null);
  const clusterStatus = useSignal(cluster.status);

  useTask$(({ track }) => {
    const created = track(() => createApiKeyAction.value?.success);
    if (created) {
      capture("cluster_api_key_created", { clusterId: cluster.id });
    }
  });

  useTask$(({ track }) => {
    const retried = track(() => retryAction.value?.success);
    if (retried) {
      capture("cluster_provision_retried", { clusterId: cluster.id });
    }
  });

  useVisibleTask$(({ cleanup }) => {
    if (
      clusterStatus.value === "provisioning" ||
      clusterStatus.value === "failed"
    ) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/clusters/${cluster.id}/status`);
          if (res.ok) {
            const data = await res.json();
            clusterStatus.value = data.status;
            if (data.status === "active") {
              clearInterval(interval);
              nav(loc.url.pathname);
            }
          }
        } catch (e) {
          captureError(e, { page: "cluster_detail", action: "pollStatus" });
        }
      }, 5000);
      cleanup(() => clearInterval(interval));
      return;
    }

    if (clusterStatus.value === "active") {
      fetch(`/api/clusters/${cluster.id}/stats`)
        .then((res) => (res.ok ? res.json() : null))
        .then((s) => {
          if (s) stats.value = s;
        })
        .catch(() => {});
    }

    if (clusterStatus.value === "active" && cluster.tier !== "fractional") {
      const fetchHardware = async () => {
        try {
          const res = await fetch(`/api/clusters/${cluster.id}/hardware`);
          if (res.ok) hardwareStats.value = await res.json();
        } catch (e) {
          captureError(e, { page: "cluster_detail", action: "fetchHardware" });
        }
      };
      fetchHardware();
      const interval = setInterval(fetchHardware, 30000);
      cleanup(() => clearInterval(interval));
    }
  });

  const vmSize =
    {
      azure_micro: "Standard_B2als_v2",
      azure_standard: "Standard_D2as_v5",
      azure_pro: "Standard_D4as_v5",
      azure_scale: "Standard_D8as_v5",
      azure_gpu: "Standard_NC4as_T4",
    }[cluster.tier as string] || "Standard_D2s_v5";

  const loc = useLocation();
  const nav = useNavigate();

  const formatNum = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);
  const formatBytes = (b: number) => {
    if (!b) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (clusterStatus.value === "provisioning") {
    const createdMs = new Date(cluster.created_at).getTime();
    const elapsedMin = Math.floor((Date.now() - createdMs) / 60000);
    const stuck = elapsedMin > 3;
    const platformUrl = loc.url.origin;
    const activateCurl = `curl -X POST ${platformUrl}/api/clusters/${cluster.id}/activate \\\n  -H "x-admin-key: 82a2cd542b86763b5941fba04db9802928c53a27256fcccb64e12f414f69826a" \\\n  -H "Content-Type: application/json" \\\n  -d '{"ip_address": "YOUR_VM_PUBLIC_IP"}'`;

    return (
      <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
        <main class="flex-grow flex items-center justify-center p-8 lg:p-12 mb-20 max-w-2xl mx-auto w-full pt-[104px]">
          <div class="w-full">
            <header class="mb-8 text-center">
              <div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 mb-4 animate-spin">
                <Loader2Icon class="w-6 h-6" />
              </div>
              <h1 class="font-headline text-3xl font-extrabold tracking-tighter text-on-surface">
                Provisioning Dedicated VM
              </h1>
              <p class="text-tertiary mt-2 text-sm">
                Cluster Name:{" "}
                <span class="text-on-surface font-semibold">
                  {cluster.name}
                </span>
              </p>
              <p class="text-[10px] text-tertiary mt-1">
                Region: {cluster.region?.toUpperCase()} • VM Size: {vmSize} •
                Storage: {cluster.storage_gb || 10} GB SSD
              </p>
            </header>

            <section class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 mb-6 shadow-lg shadow-black/20">
              <h3 class="text-sm font-bold mb-2 text-on-surface">
                Waiting for Server Boot
              </h3>
              <p class="text-xs text-tertiary mb-6 leading-relaxed">
                The virtual machine instance is being allocated in Azure. Once
                the VM boots up and starts the TelloDB engine, it must send
                an activation signal to our API gateway to transition this
                cluster to active.
              </p>

              <div class="border-t border-outline-variant/10 pt-4">
                <p class="text-xs font-bold text-primary mb-2 uppercase tracking-widest">
                  Activation Callback Command
                </p>
                <p class="text-[11px] text-tertiary mb-3 leading-relaxed">
                  Run this command from your VM bootstrap script (cloud-init) or
                  manually to report your server's public IP and activate it:
                </p>
                <div class="flex items-start gap-2 rounded-lg bg-black/40 p-3 font-mono text-[11px] text-amber-400 border border-amber-500/20 whitespace-pre overflow-x-auto">
                  <code class="flex-1">{activateCurl}</code>
                  <button
                    class="p-1 hover:bg-amber-500/20 rounded transition-colors text-amber-400 self-start shrink-0"
                    onClick$={() => navigator.clipboard.writeText(activateCurl)}
                  >
                    <CopyIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            {stuck && (
              <section class="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 mb-6">
                <h3 class="text-sm font-bold text-red-400 mb-2">
                  Provisioning Taking Longer Than Expected
                </h3>
                <p class="text-xs text-tertiary mb-4 leading-relaxed">
                  This cluster has been provisioning for {elapsedMin} minutes.
                  If you selected a region with limited capacity, the VM size
                  may not be available. Try a different region like{" "}
                  <span class="font-semibold text-on-surface">West US 2</span>.
                </p>
                <Form action={retryAction} class="flex flex-col gap-3">
                  <input type="hidden" name="cluster_id" value={cluster.id} />
                  <input
                    type="hidden"
                    name="storage_gb"
                    value={cluster.storage_gb || 50}
                  />
                  <div class="flex items-end gap-3">
                    <div class="flex-1">
                      <label class="text-[10px] font-bold uppercase tracking-widest text-tertiary mb-1 block">
                        Region
                      </label>
                      <select
                        name="region"
                        class="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-on-surface text-sm outline-none focus:border-primary"
                      >
                        <option value="westus2" selected>
                          West US 2 (Washington)
                        </option>
                        <option value="eastus">East US (Virginia)</option>
                        <option value="westeurope">
                          West Europe (Netherlands)
                        </option>
                        <option value="northeurope">
                          North Europe (Ireland)
                        </option>
                        <option value="southeastasia">
                          Southeast Asia (Singapore)
                        </option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={retrying.value}
                      class="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition-all flex items-center gap-2 shrink-0"
                      onClick$={() => {
                        retrying.value = true;
                      }}
                    >
                      <RefreshCwIcon class="w-3.5 h-3.5" />
                      Retry Provisioning
                    </button>
                  </div>
                </Form>
                {retryAction.value?.steps &&
                  (retryAction.value.steps as string[]).length > 0 && (
                    <div class="mt-4 rounded-lg bg-black/40 p-3 border border-outline-variant/20">
                      <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary mb-2">
                        Diagnostic Log
                      </p>
                      <ul class="text-[11px] font-mono text-tertiary space-y-1">
                        {(retryAction.value.steps as string[]).map(
                          (step: string, i: number) => (
                            <li key={i} class="flex items-start gap-2">
                              <span class="text-primary shrink-0">
                                {i + 1}.
                              </span>
                              <span>{step}</span>
                            </li>
                          ),
                        )}
                      </ul>
                      {retryAction.value.error && (
                        <p class="text-[11px] font-mono text-red-400 mt-2 border-t border-outline-variant/10 pt-2">
                          Error: {retryAction.value.error as string}
                        </p>
                      )}
                    </div>
                  )}
              </section>
            )}

            <div class="flex justify-between items-center px-2">
              <Link
                href="/platform"
                class="text-xs font-bold text-tertiary hover:text-primary transition-colors flex items-center gap-1"
              >
                <ArrowLeftIcon class="w-3.5 h-3.5" /> Return to Mission Control
              </Link>
              <button
                onClick$={() => nav(loc.url.pathname)}
                class="rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary hover:text-white px-4 py-2 text-xs font-bold text-primary transition-all"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (clusterStatus.value === "failed") {
    return (
      <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
        <main class="flex-grow flex items-center justify-center p-8 lg:p-12 mb-20 max-w-2xl mx-auto w-full pt-[104px]">
          <div class="w-full text-center">
            <div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 mb-4">
              <ActivityIcon class="w-6 h-6" />
            </div>
            <h1 class="font-headline text-3xl font-extrabold tracking-tighter text-on-surface mb-2">
              Provisioning Failed
            </h1>
            <p class="text-tertiary text-sm mb-6">
              The Azure VM could not be created for cluster{" "}
              <span class="font-semibold text-on-surface">{cluster.name}</span>.
            </p>
            <div class="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 mb-6 text-left">
              <p class="text-xs font-bold uppercase tracking-widest text-red-400 mb-2">
                What went wrong
              </p>
              <p class="text-sm text-tertiary leading-relaxed">
                The VM size{" "}
                <code class="font-mono text-amber-400">{vmSize}</code> is not
                available in{" "}
                <span class="font-semibold text-on-surface">
                  {(cluster.region || "westus2").toUpperCase()}
                </span>
                . This is a capacity restriction in that Azure region — your
                subscription and payment are valid.
              </p>
            </div>
            <div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 mb-8 text-left">
              <p class="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                Retry with a different region
              </p>
              <Form action={retryAction} class="flex items-end gap-3">
                <input type="hidden" name="cluster_id" value={cluster.id} />
                <input
                  type="hidden"
                  name="storage_gb"
                  value={cluster.storage_gb || 50}
                />
                <div class="flex-1">
                  <select
                    name="region"
                    class="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-on-surface text-sm outline-none focus:border-primary"
                  >
                    <option value="westus2" selected>
                      West US 2 (Washington)
                    </option>
                    <option value="eastus">East US (Virginia)</option>
                    <option value="westeurope">
                      West Europe (Netherlands)
                    </option>
                    <option value="northeurope">North Europe (Ireland)</option>
                    <option value="southeastasia">
                      Southeast Asia (Singapore)
                    </option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={retrying.value}
                  class="rounded-lg bg-primary hover:bg-primary/90 px-4 py-2 text-sm font-bold text-on-primary transition-all flex items-center gap-2 shrink-0"
                  onClick$={() => {
                    retrying.value = true;
                  }}
                >
                  <RefreshCwIcon class="w-3.5 h-3.5" />
                  Retry Provisioning
                </button>
              </Form>
              {retryAction.value?.steps &&
                (retryAction.value.steps as string[]).length > 0 && (
                  <div class="mt-4 rounded-lg bg-black/40 p-3 border border-outline-variant/20">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary mb-2">
                      Diagnostic Log
                    </p>
                    <ul class="text-[11px] font-mono text-tertiary space-y-1">
                      {(retryAction.value.steps as string[]).map(
                        (step: string, i: number) => (
                          <li key={i} class="flex items-start gap-2">
                            <span class="text-primary shrink-0">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ),
                      )}
                    </ul>
                    {retryAction.value.error && (
                      <p class="text-[11px] font-mono text-red-400 mt-2 border-t border-outline-variant/10 pt-2">
                        Error: {retryAction.value.error as string}
                      </p>
                    )}
                  </div>
                )}
            </div>
            <div class="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/platform"
                class="rounded-lg border border-outline-variant/20 px-6 py-3 font-bold text-sm text-on-surface transition-all hover:bg-surface-container-high"
              >
                Back to Mission Control
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
      <main class="flex-1 overflow-y-auto p-8 lg:p-12 mb-20 max-w-5xl mx-auto w-full pt-[104px]">
        <header class="mb-8 flex flex-col gap-4">
          <Link
            href="/platform"
            class="text-tertiary hover:text-primary flex items-center gap-1 transition-colors w-fit"
          >
            <ArrowLeftIcon class="w-4 h-4" />
            Mission Control
          </Link>
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <h1 class="font-headline text-4xl font-extrabold tracking-tighter text-on-surface">
                  {cluster.name}
                </h1>
                <span
                  class={`rounded px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest ${
                    cluster.status === "active"
                      ? "bg-green-500/10 text-green-400"
                      : cluster.status === "provisioning"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {cluster.status}
                </span>
                <span class="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary font-bold uppercase tracking-widest">
                  {cluster.tier?.replace("_", " ") || "Fractional"}
                </span>
              </div>
              <p class="text-tertiary font-mono text-sm">
                Cluster ID: {cluster.id.slice(0, 16)}...
              </p>
            </div>
            {cluster.tier === "fractional" ? (
              <Link
                href={`/platform/clusters/new?tier=azure_gpu`}
                class="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/20 px-6 py-3 font-bold text-sm text-orange-400 transition-all hover:bg-orange-500 hover:text-white shadow-lg"
              >
                <RocketIcon class="w-4 h-4" />
                Migrate to Dedicated
              </Link>
            ) : (
              <div class="flex items-center gap-3 rounded-xl bg-surface-container-low px-5 py-3 border border-outline-variant/10">
                <ServerIcon class="w-5 h-5 text-primary" />
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                    VM Status
                  </p>
                  <p class="text-sm font-bold text-green-400">Deployed</p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Tab Navigation */}
        <div class="flex gap-1 border-b border-outline-variant/10 mb-8">
          <Link
            href={`/platform/clusters/${cluster.id}`}
            class="px-4 py-3 text-sm font-bold border-b-2 border-primary text-primary"
          >
            Overview
          </Link>
          <Link
            href={`/platform/clusters/${cluster.id}/graph`}
            class="px-4 py-3 text-sm font-bold text-tertiary hover:text-on-surface border-b-2 border-transparent hover:border-outline-variant/30 transition-colors"
          >
            <NetworkIcon class="w-4 h-4 inline mr-1.5" />
            Graph
          </Link>
          <Link
            href={`/platform/clusters/${cluster.id}/analytics`}
            class="px-4 py-3 text-sm font-bold text-tertiary hover:text-on-surface border-b-2 border-transparent hover:border-outline-variant/30 transition-colors"
          >
            <BarChart3Icon class="w-4 h-4 inline mr-1.5" />
            Analytics
          </Link>
        </div>

        {/* Stats Grid */}
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
            <div class="flex items-center gap-2 text-tertiary text-xs font-bold uppercase tracking-widest mb-2">
              <DatabaseIcon class="w-4 h-4" /> Memories
            </div>
            <p class="text-3xl font-extrabold">
              {stats.value ? formatNum(stats.value.memory_count) : "—"}
            </p>
          </div>
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
            <div class="flex items-center gap-2 text-tertiary text-xs font-bold uppercase tracking-widest mb-2">
              <UsersIcon class="w-4 h-4" /> Entities
            </div>
            <p class="text-3xl font-extrabold">
              {stats.value ? formatNum(stats.value.entity_count) : "—"}
            </p>
          </div>
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
            <div class="flex items-center gap-2 text-tertiary text-xs font-bold uppercase tracking-widest mb-2">
              <FileTextIcon class="w-4 h-4" /> Facts
            </div>
            <p class="text-3xl font-extrabold">
              {stats.value ? formatNum(stats.value.fact_count) : "—"}
            </p>
          </div>
          <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
            <div class="flex items-center gap-2 text-tertiary text-xs font-bold uppercase tracking-widest mb-2">
              <ActivityIcon class="w-4 h-4" /> Storage
            </div>
            <p class="text-3xl font-extrabold">
              {stats.value ? formatBytes(stats.value.storage_bytes) : "—"}
            </p>
          </div>
        </section>

        {/* Live Server Performance (dedicated clusters only) */}
        {cluster.tier !== "fractional" && (
          <section class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 mb-8">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold flex items-center gap-2">
                <ActivityIcon class="w-5 h-5 text-primary" /> Live Server
                Performance
              </h2>
              <span class="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary font-bold uppercase tracking-widest">
                Live
              </span>
            </div>

            {!hardwareStats.value ? (
              <div class="flex flex-col items-center justify-center py-6 text-tertiary">
                <RefreshCwIcon class="w-6 h-6 animate-spin mb-2" />
                <p class="text-xs">Connecting to engine hardware monitor...</p>
              </div>
            ) : (
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CPU Utilization */}
                <div class="p-4 rounded-xl bg-black/20 border border-outline-variant/5">
                  <div class="flex justify-between items-center mb-2">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                      CPU Usage
                    </p>
                    <p class="text-sm font-bold font-mono">
                      {hardwareStats.value.cpu_usage_percent.toFixed(1)}%
                    </p>
                  </div>
                  <div class="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-outline-variant/10">
                    <div
                      class="bg-primary h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, hardwareStats.value.cpu_usage_percent))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* RAM Utilization */}
                <div class="p-4 rounded-xl bg-black/20 border border-outline-variant/5">
                  <div class="flex justify-between items-center mb-2">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                      RAM Usage
                    </p>
                    <p class="text-sm font-bold font-mono">
                      {hardwareStats.value.ram_used_mb}MB /{" "}
                      {hardwareStats.value.ram_total_mb}MB
                    </p>
                  </div>
                  <div class="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-outline-variant/10">
                    <div
                      class="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, (hardwareStats.value.ram_used_mb / (hardwareStats.value.ram_total_mb || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Storage Disk Utilization */}
                <div class="p-4 rounded-xl bg-black/20 border border-outline-variant/5">
                  <div class="flex justify-between items-center mb-2">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary">
                      Disk Storage
                    </p>
                    <p class="text-sm font-bold font-mono">
                      {hardwareStats.value.storage_used_gb}GB /{" "}
                      {hardwareStats.value.storage_total_gb}GB
                    </p>
                  </div>
                  <div class="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-outline-variant/10">
                    <div
                      class="bg-green-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, (hardwareStats.value.storage_used_gb / (hardwareStats.value.storage_total_gb || 1)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* GPU Performance (if available) */}
                {hardwareStats.value.gpu_usage_percent !== null && (
                  <div class="p-4 rounded-xl bg-black/20 border border-outline-variant/5 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                      <p class="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">
                        NVIDIA GPU Acceleration
                      </p>
                    </div>
                    <div>
                      <div class="flex justify-between items-center mb-2">
                        <p class="text-[11px] font-semibold text-tertiary">
                          GPU Utilization
                        </p>
                        <p class="text-xs font-bold font-mono">
                          {hardwareStats.value.gpu_usage_percent.toFixed(1)}%
                        </p>
                      </div>
                      <div class="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-outline-variant/10">
                        <div
                          class="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, hardwareStats.value.gpu_usage_percent))}%`,
                          }}
                        />
                      </div>
                    </div>
                    {hardwareStats.value.gpu_ram_used_mb !== null &&
                      hardwareStats.value.gpu_ram_total_mb !== null && (
                        <div>
                          <div class="flex justify-between items-center mb-2">
                            <p class="text-[11px] font-semibold text-tertiary">
                              GPU VRAM
                            </p>
                            <p class="text-xs font-bold font-mono">
                              {hardwareStats.value.gpu_ram_used_mb}MB /{" "}
                              {hardwareStats.value.gpu_ram_total_mb}MB
                            </p>
                          </div>
                          <div class="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-outline-variant/10">
                            <div
                              class="bg-amber-600 h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, Math.max(0, (hardwareStats.value.gpu_ram_used_mb / (hardwareStats.value.gpu_ram_total_mb || 1)) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* VM Specs (dedicated clusters only) */}
        {cluster.tier !== "fractional" && (
          <section class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 mb-8">
            <h2 class="text-lg font-bold mb-4">Server Specifications</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary mb-1">
                  VM Size
                </p>
                <p class="font-mono text-sm font-bold">{vmSize}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary mb-1">
                  Region
                </p>
                <p class="font-mono text-sm font-bold">
                  {(cluster.region || "eastus").toUpperCase()}
                </p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary mb-1">
                  SSD Storage
                </p>
                <p class="font-mono text-sm font-bold">
                  {cluster.storage_gb || 50} GB Premium SSD
                </p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary mb-1">
                  Status
                </p>
                <p class="font-mono text-sm font-bold text-green-400">Active</p>
              </div>
            </div>
          </section>
        )}

        {/* Connection Details */}
        <section class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 mb-8">
          <h2 class="text-lg font-bold mb-4">Connection Details</h2>
          <div class="space-y-4">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-tertiary mb-1">
                Endpoint URL
              </p>
              <div class="flex items-center gap-2 rounded-lg bg-black/40 p-3 font-mono text-sm text-primary border border-primary/20">
                <span class="flex-1 truncate">
                  {cluster.endpoint_url || "https://api.tellodb.com/api"}
                </span>
                <button
                  class="p-1 hover:bg-primary/20 rounded transition-colors text-primary"
                  onClick$={() =>
                    navigator.clipboard.writeText(
                      cluster.endpoint_url || "https://api.tellodb.com/api",
                    )
                  }
                >
                  <CopyIcon class="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-tertiary mb-1">
                Engine Admin Key / Master Key
              </p>
              <div class="flex items-center gap-2 rounded-lg bg-black/40 p-3 font-mono text-sm text-on-surface border border-outline-variant/20">
                <span class="flex-1 truncate text-tertiary select-all">
                  {showKey.value ? apiKey : "••••••••••••••••••••••••••••••••"}
                </span>
                <button
                  class="p-1 hover:bg-primary/20 rounded transition-colors text-tertiary shrink-0"
                  onClick$={() => {
                    showKey.value = !showKey.value;
                  }}
                >
                  {showKey.value ? (
                    <EyeOffIcon class="w-4 h-4" />
                  ) : (
                    <EyeIcon class="w-4 h-4" />
                  )}
                </button>
                <button
                  class="p-1 hover:bg-primary/20 rounded transition-colors text-primary shrink-0"
                  onClick$={() => navigator.clipboard.writeText(apiKey)}
                >
                  <CopyIcon class="w-4 h-4" />
                </button>
              </div>
              <p class="text-xs text-tertiary mt-1">
                Use this key in the x-api-key header to perform administrative
                tasks or authenticate directly on your engine.
              </p>
            </div>
          </div>
        </section>

        {/* API Key Management */}
        <section class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 mb-8">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h2 class="text-lg font-bold">API Key Management</h2>
              <p class="text-xs text-tertiary mt-1">
                Generate staging, production, or client access keys specifically
                for this cluster.
              </p>
            </div>
            <button
              onClick$={() => {
                showApiKeyCreate.value = !showApiKeyCreate.value;
              }}
              class="rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary hover:text-white px-4 py-2 text-xs font-bold text-primary transition-all"
            >
              {showApiKeyCreate.value ? "Cancel" : "Generate Key"}
            </button>
          </div>

          {showApiKeyCreate.value && (
            <Form
              action={createApiKeyAction}
              class="mb-6 bg-black/25 border border-outline-variant/10 p-5 rounded-xl flex flex-col sm:flex-row gap-3 animate-fade-in"
            >
              <input
                type="text"
                name="name"
                bind:value={newApiKeyName}
                placeholder="Key identifier (e.g. Production Client 01)"
                required
                class="flex-grow rounded-lg border border-outline-variant/20 bg-surface-container-highest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={createApiKeyAction.isRunning}
                class="rounded-lg bg-primary px-5 py-2 font-bold text-xs text-on-primary transition-all shrink-0"
              >
                {createApiKeyAction.isRunning ? "Generating..." : "Create"}
              </button>
            </Form>
          )}

          {createApiKeyAction.value?.success &&
            createApiKeyAction.value.key?.token && (
              <div class="mb-6 rounded-xl bg-green-500/10 border border-green-500/30 p-5">
                <p class="text-xs font-bold text-green-400 mb-2">
                  New Key Generated Successfully!
                </p>
                <p class="text-xs text-tertiary mb-3">
                  Copy your API key now. You won't be able to see it again.
                </p>
                <div class="flex items-center gap-2 rounded-lg bg-black/40 p-3 font-mono text-xs text-green-400 border border-green-500/20">
                  <span class="flex-grow truncate">
                    {createApiKeyAction.value.key.token}
                  </span>
                  <button
                    class="p-1 hover:bg-green-500/20 rounded transition-colors text-green-400 shrink-0"
                    onClick$={() =>
                      navigator.clipboard.writeText(
                        createApiKeyAction.value?.key?.token || "",
                      )
                    }
                  >
                    <CopyIcon class="w-4 h-4" />
                  </button>
                </div>
                {createApiKeyAction.value.engineSynced ? (
                  <p class="text-[10px] text-green-400 mt-3 flex items-center gap-1">
                    <CheckCircle2Icon class="w-3 h-3" />
                    Key synced to engine - ready for direct API access
                  </p>
                ) : (
                  <p class="text-[10px] text-amber-400 mt-3 flex items-center gap-1">
                    <AlertCircleIcon class="w-3 h-3" />
                    Key created but engine sync failed (
                    {createApiKeyAction.value.engineError || "unknown error"}).
                    Contact support.
                  </p>
                )}
              </div>
            )}

          {/* Active Keys List */}
          <div class="space-y-3">
            {apiKeys.length === 0 ? (
              <p class="text-xs text-tertiary text-center py-4 bg-black/25 rounded-xl">
                No API keys created for this cluster. Use the button above to
                generate one.
              </p>
            ) : (
              apiKeys.map((key: any) => (
                <div
                  key={key.key_id}
                  class="flex items-center justify-between bg-black/20 rounded-xl p-4 border border-outline-variant/10"
                >
                  <div>
                    <h4 class="text-sm font-bold">{key.name}</h4>
                    <p class="text-[11px] font-mono text-tertiary mt-1 tracking-wider">
                      {key.key_prefix}••••••••
                    </p>
                  </div>
                  <div class="flex items-center gap-6">
                    <div class="text-right hidden sm:block">
                      <p class="text-[9px] font-bold text-tertiary uppercase">
                        Created
                      </p>
                      <p class="font-mono text-[10px] mt-0.5">
                        <LocalDateTime value={key.created_at_ms} />
                      </p>
                    </div>
                    <Form action={revokeApiKeyAction}>
                      <input type="hidden" name="id" value={key.key_id} />
                      <button
                        type="submit"
                        class="rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 text-xs font-bold transition-all"
                      >
                        Revoke
                      </button>
                    </Form>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section class="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 mt-8">
          <h2 class="text-lg font-bold text-red-400 mb-2">Danger Zone</h2>
          <p class="text-sm text-tertiary mb-4">
            Deleting this cluster will permanently remove all stored memories,
            fact slots, and graph indexes. If this is a dedicated VM, it will
            immediately stop the virtual machine and cancel any active
            subscription.
          </p>
          <Form action={deleteAction}>
            <input type="hidden" name="cluster_id" value={cluster.id} />
            <button
              type="submit"
              onClick$={(e) => {
                if (
                  !confirm(
                    "Are you absolutely sure you want to delete this cluster? This action is irreversible.",
                  )
                ) {
                  e.preventDefault();
                }
              }}
              class="rounded-lg bg-red-600 hover:bg-red-700 px-6 py-3 font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-950/20"
            >
              Delete Cluster
            </button>
          </Form>
        </section>
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Cluster Detail | TelloDB",
  description: "Manage your TelloDB cluster.",
  pathname: "/platform/clusters/[id]",
  noindex: true,
});
