import {
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
  useStore,
} from "@builder.io/qwik";
import {
  LayoutDashboardIcon,
  NetworkIcon,
  BarChart3Icon,
  LogOutIcon,
  PlusIcon,
  ServerIcon,
  CopyIcon,
  CheckCircle2Icon,
  Trash2Icon,
  KeyIcon,
  Loader2Icon,
  CreditCardIcon,
  SettingsIcon,
  CheckIcon,
  ExternalLinkIcon,
  UserIcon,
  UsersIcon,
  FileTextIcon,
  MailIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  GitBranchIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-qwik";
import {
  Form,
  Link,
  routeAction$,
  routeLoader$,
  useLocation,
  useNavigate,
  type RequestHandler,
  type DocumentHead,
} from "@builder.io/qwik-city";

import {
  createApiKey,
  getApiKeys,
  revokeApiKey,
  getUsageStats,
  type ApiKey,
} from "~/lib/api-keys";
import { getClusters, type Cluster } from "~/lib/clusters";
import { getTeamMembers, type TeamMemberInfo } from "~/lib/team";
import {
  getContextTemplates,
  createContextTemplate,
  deleteContextTemplate,
  type ContextTemplate,
} from "~/lib/context-templates";
import {
  getCoreClusterStats,
  getStorageStats,
  getGraphEdges,
  type CoreClusterStats,
  type StorageStats,
  type GraphEdge,
} from "~/lib/tellodb-core";
import { requireAuth } from "~/lib/auth";
import { CONTACT_MAILTO } from "~/constants/contact";
import { setPrivateNoStore } from "~/lib/cache";
import { buildSeoHead } from "~/lib/seo";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";
import { capture } from "~/lib/posthog";
import { identify } from "~/lib/posthog";

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

export const usePlatformData = routeLoader$(async (event) => {
  try {
    const user = requireAuth(event);
    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database connection offline");

    const [keys, usage, clusters, sub, purchases, members] = await Promise.all([
      getApiKeys(event),
      getUsageStats(event),
      getClusters(event),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.user_id)
        .maybeSingle()
        .then((res) => res.data),
      supabase
        .from("purchases")
        .select("*")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false })
        .then((res) => res.data || []),
      getTeamMembers(event),
    ]);

    const clusterId = clusters[0]?.id || "";
    const templates = clusterId
      ? await getContextTemplates(event, clusterId)
      : [];

    return {
      user,
      keys,
      usage,
      clusters,
      sub,
      purchases,
      members,
      templates,
      clusterId,
    };
  } catch (e) {
    captureError(e, { page: "platform" });
    throw e;
  }
});

export const useCreateTemplate = routeAction$(async (data, event) => {
  try {
    requireAuth(event);
    const name = String(data.name || "");
    const tmpl = String(data.template || "");
    const clusterId = String(data.cluster_id || "");
    if (!name || !tmpl || !clusterId)
      return event.fail(400, { message: "All fields required" });
    await createContextTemplate(event, clusterId, name, tmpl);
    return { success: true };
  } catch (e) {
    captureError(e, { page: "platform", action: "createTemplate" });
    return event.fail(500, { message: "Failed to create template." });
  }
});

export const useDeleteTemplate = routeAction$(async (data, event) => {
  try {
    requireAuth(event);
    await deleteContextTemplate(event, String(data.id || ""));
    return { success: true };
  } catch (e) {
    captureError(e, { page: "platform", action: "deleteTemplate" });
    return event.fail(500, { message: "Failed to delete template." });
  }
});

export const onRequest: RequestHandler = (event) => {
  setPrivateNoStore(event);
};

export const useCreateApiKeyAction = routeAction$(async (data, event) => {
  try {
    requireAuth(event);
    const name = String(data.name ?? "New API Key");

    const result = await createApiKey(event, name);

    return {
      success: !!result,
      key: result?.key ?? null,
      engineSynced: result?.engineSynced ?? false,
      engineError: result?.engineError,
    };
  } catch (e) {
    captureError(e, { page: "platform", action: "createApiKey" });
    return { success: false };
  }
});

export const useRevokeApiKeyAction = routeAction$(async (data, event) => {
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
    captureError(e, { page: "platform", action: "revokeApiKey" });
    return { revoked: false };
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

const PREDEFINED_TEMPLATES = [
  {
    name: "Compact",
    template:
      "# User Context\n%{user_summary}\n\n# Relevant Facts\n%{facts limit=5}\n\n# Graph Context\n%{graph_neighbors n=5}",
  },
  {
    name: "Conversational",
    template:
      "The user %{user_summary}\n\nHere are relevant facts about them:\n%{facts limit=8}\n\nRecent activity from the %{temporal_range days=7}:\n%{facts limit=5}",
  },
  {
    name: "Enterprise RAG",
    template:
      "USER PROFILE\n%{user_summary}\n\nRELATED ENTITIES\n%{related_entities}\n\nSUPPORTING FACTS (limit 15)\n%{facts limit=15}\n\nKNOWLEDGE GRAPH CONTEXT\n%{graph_neighbors n=10}",
  },
];

export default component$(() => {
  const platformData = usePlatformData();
  const createKeyAction = useCreateApiKeyAction();
  const revokeKeyAction = useRevokeApiKeyAction();
  const createTemplateAction = useCreateTemplate();
  const deleteTemplateAction = useDeleteTemplate();
  const keys = platformData.value.keys;
  const usage = platformData.value.usage;
  const clusters = platformData.value.clusters;
  const combinedStats = useStore({
    memory_count: 0,
    entity_count: 0,
    fact_count: 0,
    storage_bytes: 0,
  });
  const graphData = useStore<{ edges: GraphEdge[]; loaded: boolean }>({
    edges: [],
    loaded: false,
  });
  const storageData = useStore<{ stats: StorageStats | null; loaded: boolean }>(
    { stats: null, loaded: false },
  );
  const usageData = useStore<{
    daily: {
      date: string;
      request_count: number;
      ingest_count: number;
      query_count: number;
      graph_ops: number;
    }[];
    loaded: boolean;
  }>({ daily: [], loaded: false });

  const formatNum = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);

  // Declare these BEFORE useTask$ so Qwik's optimizer can capture them in serialized closures
  const newApiKeyName = useSignal("");
  const isCreatingKey = useSignal(false);
  const keyCreateError = useSignal("");
  const newlyCreatedKey = useStore<{
    token: string;
    engineSynced: boolean;
    engineError: string;
  }>({ token: "", engineSynced: false, engineError: "" });
  const localKeyList = useSignal<ApiKey[]>([]);
  const settingsNewName = useSignal("");
  const graphEntityId = useSignal("");

  useTask$(({ track }) => {
    const user = track(() => platformData.value.user);
    if (user?.user_id) {
      identify(user.user_id);
    }
  });

  useTask$(({ track }) => {
    const token = track(() => newlyCreatedKey.token);
    if (token) {
      capture("api_key_created", {
        name: newApiKeyName.value || "New API Key",
      });
    }
  });

  useTask$(({ track }) => {
    const revoked = track(() => revokeKeyAction.value?.revoked);
    if (revoked) {
      capture("api_key_revoked");
    }
  });

  useTask$(({ track }) => {
    const created = track(() => createTemplateAction.value?.success);
    if (created) {
      capture("template_created", { name: settingsNewName.value });
    }
  });

  useTask$(({ track }) => {
    const deleted = track(() => deleteTemplateAction.value?.success);
    if (deleted) {
      capture("template_deleted");
    }
  });

  const formatBytes = (b: number) => {
    if (!b) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const loc = useLocation();
  const nav = useNavigate();
  const initialTab = (loc.url.searchParams.get("tab") as any) || "overview";
  const activeMissionTab = useSignal<
    "overview" | "api" | "billing" | "settings"
  >(initialTab);
  const activeApiTab = useSignal<
    "keys" | "create" | "usage" | "graph" | "storage"
  >("keys");
  const activeSettingsTab = useSignal<"profile" | "team" | "templates">(
    "profile",
  );
  const showSettingsCreateForm = useSignal(false);
  const settingsNewTemplate = useSignal("");
  const settingsCopiedId = useSignal("");
  const visibleKeys = useStore<Record<string, boolean>>({});

  useTask$(() => {
    localKeyList.value = [...platformData.value.keys];
  });

  useVisibleTask$(({ cleanup }) => {
    const hasTransient = clusters.some(
      (c) => c.status === "provisioning" || c.status === "failed",
    );
    if (!hasTransient) return;

    const knownStatuses = Object.fromEntries(
      clusters.map((c) => [c.id, c.status]),
    );
    let transitioning = false;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/clusters/status");
        if (!res.ok) return;
        const latest: { id: string; status: string }[] = await res.json();
        for (const c of latest) {
          if (knownStatuses[c.id] && knownStatuses[c.id] !== c.status) {
            if (!transitioning) {
              transitioning = true;
              nav(loc.url.pathname);
            }
          }
        }
        const stillTransient = latest.some(
          (c) => c.status === "provisioning" || c.status === "failed",
        );
        if (!stillTransient && !transitioning) {
          clearInterval(interval);
          nav(loc.url.pathname);
        }
      } catch {
        /* cluster status polling skipped */
      }
    }, 5000);
    cleanup(() => clearInterval(interval));
  });

  useVisibleTask$(async () => {
    const active = clusters.filter((c) => c.status === "active");
    if (!active.length) return;
    const results = await Promise.all(
      active.map(async (c) => {
        try {
          const res = await fetch(`/api/clusters/${c.id}/stats`);
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      }),
    );
    const merged = results.reduce(
      (acc, s) => {
        if (s) {
          acc.memory_count += s.memory_count || 0;
          acc.entity_count += s.entity_count || 0;
          acc.fact_count += s.fact_count || 0;
          acc.storage_bytes += s.storage_bytes || 0;
        }
        return acc;
      },
      { memory_count: 0, entity_count: 0, fact_count: 0, storage_bytes: 0 },
    );
    combinedStats.memory_count = merged.memory_count;
    combinedStats.entity_count = merged.entity_count;
    combinedStats.fact_count = merged.fact_count;
    combinedStats.storage_bytes = merged.storage_bytes;
  });

  useVisibleTask$(async () => {
    try {
      // Only fetch from clusters that are actually running (not provisioning/failed)
      const activeDedicated = clusters.filter(
        (c) => c.status === "active" && c.tier !== "fractional",
      );
      const activeFractional = clusters.filter(
        (c) => c.tier === "fractional" && c.status === "active",
      );
      const hasActiveClusters =
        activeDedicated.length > 0 || activeFractional.length > 0;

      if (!hasActiveClusters) {
        // No active dedicated clusters — fetch graph from the shared server directly
        // using the user's API keys (Pay Per Usage path)
        try {
          const eid = graphEntityId.value.trim();
          const url = eid
            ? `/api/shared/graph-edges?entity_id=${encodeURIComponent(eid)}`
            : "/api/shared/graph-edges";
          const sharedRes = await fetch(url);
          graphData.edges = sharedRes.ok
            ? ((await sharedRes.json()) as GraphEdge[])
            : [];
        } catch {
          graphData.edges = [];
        }
        graphData.loaded = true;
        storageData.loaded = true;
        usageData.loaded = true;
        return;
      }

      // Active dedicated clusters exist — fetch per-cluster data
      const allActive = [...activeDedicated, ...activeFractional];
      const results = await Promise.all(
        allActive.map(async (c) => {
          const [edgesRes, sstatsRes, udataRes] = await Promise.all([
            fetch(`/api/clusters/${c.id}/graph-edges`).catch(() => null),
            fetch(`/api/clusters/${c.id}/storage-stats`).catch(() => null),
            fetch(`/api/clusters/${c.id}/usage`).catch(() => null),
          ]);
          const edges = edgesRes?.ok
            ? ((await edgesRes.json()) as GraphEdge[])
            : [];
          const sstats = sstatsRes?.ok
            ? ((await sstatsRes.json()) as StorageStats)
            : null;
          const udata = udataRes?.ok ? await udataRes.json() : { daily: [] };
          return { edges, sstats, udata };
        }),
      );

      graphData.edges = results.flatMap((r) => r.edges).filter(Boolean);
      graphData.loaded = true;

      // If dedicated clusters returned no graph data, also check shared server
      if (graphData.edges.length === 0) {
        try {
          const sharedRes = await fetch("/api/shared/graph-edges");
          if (sharedRes.ok) {
            const sharedEdges = (await sharedRes.json()) as GraphEdge[];
            graphData.edges = sharedEdges;
          }
        } catch {
          /* non-fatal */
        }
      }

      const ms = results.reduce((acc: any, r) => {
        const s = r.sstats as any;
        if (s && !s.shared) {
          for (const [k, v] of Object.entries(s)) {
            if (k !== "shared") acc[k] = (acc[k] || 0) + (v as number);
          }
        }
        return acc;
      }, {}) as StorageStats;
      storageData.stats = ms;
      storageData.loaded = true;

      const dm = new Map<string, any>();
      for (const r of results)
        for (const d of r.udata.daily || []) {
          const k = d.date || "";
          if (dm.has(k)) {
            const e = dm.get(k)!;
            e.request_count += d.request_count || 0;
            e.ingest_count += d.ingest_count || 0;
            e.query_count += d.query_count || 0;
            e.graph_ops += d.graph_ops || 0;
          } else dm.set(k, { ...d });
        }
      usageData.daily = Array.from(dm.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      usageData.loaded = true;
    } catch (err) {
      console.error("[graph/storage/usage] error:", err);
      graphData.loaded = true;
      storageData.loaded = true;
      usageData.loaded = true;
    }
  });

  // Use the newly created key if available
  const activeKey =
    newlyCreatedKey.token ||
    localKeyList.value[0]?.token ||
    keys[0]?.token ||
    "YOUR_API_KEY";
  // Proxy base_url: users always hit the Qwik frontend which securely forwards to the Rust engine
  const proxyBaseUrl =
    typeof window !== "undefined"
      ? window.location.origin + "/api"
      : "https://tellodb.com/api";

  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
      {/* Side Navigation */}
      <aside class="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-outline-variant/15 bg-surface-container-lowest font-body md:flex pt-[104px]">
        <div class="flex flex-col h-full px-4 py-6">
          {/* Primary Nav Section */}
          <div class="mb-6">
            <p class="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary/60">
              Main
            </p>
            <nav class="space-y-1">
              <button
                type="button"
                class={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                  activeMissionTab.value === "overview" ||
                  activeMissionTab.value === "api"
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-tertiary hover:bg-surface-container hover:text-on-surface"
                }`}
                onClick$={() => {
                  activeMissionTab.value = "overview";
                }}
              >
                <LayoutDashboardIcon
                  class={`w-4 h-4 ${activeMissionTab.value === "overview" || activeMissionTab.value === "api" ? "text-primary" : "text-tertiary"}`}
                />
                <span>Mission Control</span>
              </button>
              <button
                type="button"
                class={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                  activeMissionTab.value === "billing"
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-tertiary hover:bg-surface-container hover:text-on-surface"
                }`}
                onClick$={() => {
                  activeMissionTab.value = "billing";
                }}
              >
                <CreditCardIcon
                  class={`w-4 h-4 ${activeMissionTab.value === "billing" ? "text-primary" : "text-tertiary"}`}
                />
                <span>Billing</span>
              </button>
            </nav>
          </div>

          {/* Management Nav Section */}
          <div>
            <p class="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary/60">
              Management
            </p>
            <nav class="space-y-1">
              <button
                type="button"
                class={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                  activeMissionTab.value === "settings"
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-tertiary hover:bg-surface-container hover:text-on-surface"
                }`}
                onClick$={() => {
                  activeMissionTab.value = "settings";
                }}
              >
                <SettingsIcon
                  class={`w-4 h-4 ${activeMissionTab.value === "settings" ? "text-primary" : "text-tertiary"}`}
                />
                <span>Settings</span>
              </button>
            </nav>
          </div>

          {/* User Section */}
          <div class="mt-auto pt-6 border-t border-outline-variant/10">
            <div class="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-surface-container/50">
              <div class="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[11px] font-bold text-on-primary uppercase shrink-0 shadow-sm">
                {platformData.value.user.username.slice(0, 2)}
              </div>
              <div class="flex-1 min-w-0">
                <p class="truncate text-sm font-semibold text-on-surface leading-tight">
                  {platformData.value.user.username}
                </p>
                <p class="text-[11px] font-medium text-tertiary/70">
                  Free Tier
                </p>
              </div>
              <form action="/logout" method="post">
                <button
                  type="submit"
                  class="flex items-center justify-center h-8 w-8 rounded-lg text-tertiary hover:text-on-surface hover:bg-surface-container-high transition-all"
                  title="Sign out"
                >
                  <LogOutIcon class="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main class="ml-0 flex-1 overflow-y-auto p-6 md:ml-64 lg:p-8">
        <header class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          {activeMissionTab.value === "billing" ? (
            <div>
              <h1 class="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
                Billing &amp; Prepaid Usage
              </h1>
              <p class="mt-1.5 text-sm text-tertiary">
                Manage your cognitive memory credits and hosting plans.
              </p>
            </div>
          ) : activeMissionTab.value === "settings" ? (
            <div>
              <h1 class="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
                Settings
              </h1>
              <p class="mt-1.5 text-sm text-tertiary">
                Manage your account, team, and memory context templates.
              </p>
            </div>
          ) : (
            <div>
              <h1 class="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
                Mission Control
              </h1>
              <p class="mt-1.5 text-sm text-tertiary">
                Real-time oversight of your agent's cognitive substrate.
              </p>
            </div>
          )}
          {activeMissionTab.value !== "billing" &&
            activeMissionTab.value !== "settings" && (
              <div class="flex items-center gap-2.5 shrink-0 rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="relative flex h-2.5 w-2.5">
                    <span class="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping"></span>
                    <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
                  </span>
                  <div class="text-left">
                    <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                      Engine
                    </p>
                    <p class="font-mono text-[11px] font-semibold text-on-surface -mt-0.5">
                      NOMINAL
                    </p>
                  </div>
                </div>
              </div>
            )}
        </header>

        {activeMissionTab.value !== "billing" &&
          activeMissionTab.value !== "settings" && (
            <div class="mb-8 inline-flex rounded-xl border border-outline-variant/10 bg-surface-container-low p-1">
              <button
                type="button"
                class={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
                  activeMissionTab.value === "overview"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-tertiary hover:text-on-surface"
                }`}
                onClick$={() => {
                  activeMissionTab.value = "overview";
                }}
              >
                <LayoutDashboardIcon
                  class={`w-3.5 h-3.5 ${activeMissionTab.value === "overview" ? "text-on-primary" : "text-tertiary"}`}
                />
                Overview
              </button>
              <button
                type="button"
                class={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
                  activeMissionTab.value === "api"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-tertiary hover:text-on-surface"
                }`}
                onClick$={() => {
                  activeMissionTab.value = "api";
                }}
              >
                <KeyIcon
                  class={`w-3.5 h-3.5 ${activeMissionTab.value === "api" ? "text-on-primary" : "text-tertiary"}`}
                />
                Pay Per Usage
              </button>
            </div>
          )}

        {activeMissionTab.value === "settings" && (
          <div class="mb-8 inline-flex rounded-xl border border-outline-variant/10 bg-surface-container-low p-1">
            <button
              type="button"
              class={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
                activeSettingsTab.value === "profile"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-tertiary hover:text-on-surface"
              }`}
              onClick$={() => {
                activeSettingsTab.value = "profile";
              }}
            >
              <UserIcon
                class={`w-3.5 h-3.5 ${activeSettingsTab.value === "profile" ? "text-on-primary" : "text-tertiary"}`}
              />
              Profile
            </button>
            <button
              type="button"
              class={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
                activeSettingsTab.value === "team"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-tertiary hover:text-on-surface"
              }`}
              onClick$={() => {
                activeSettingsTab.value = "team";
              }}
            >
              <UsersIcon
                class={`w-3.5 h-3.5 ${activeSettingsTab.value === "team" ? "text-on-primary" : "text-tertiary"}`}
              />
              Team
            </button>
            <button
              type="button"
              class={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
                activeSettingsTab.value === "templates"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-tertiary hover:text-on-surface"
              }`}
              onClick$={() => {
                activeSettingsTab.value = "templates";
              }}
            >
              <FileTextIcon
                class={`w-3.5 h-3.5 ${activeSettingsTab.value === "templates" ? "text-on-primary" : "text-tertiary"}`}
              />
              Context Templates
            </button>
          </div>
        )}

        {activeMissionTab.value === "overview" && (
          <>
            <section class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="group relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 transition-all hover:border-primary/20 hover:shadow-sm">
                <div class="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full -mr-6 -mt-6 transition-all group-hover:bg-primary/10" />
                <div class="relative">
                  <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                    Total Requests
                  </p>
                  <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                    {usage?.request_count || 0}
                  </p>
                </div>
              </div>

              <div class="group relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 transition-all hover:border-primary/20 hover:shadow-sm">
                <div class="absolute top-0 right-0 w-20 h-20 bg-secondary/5 rounded-bl-full -mr-6 -mt-6 transition-all group-hover:bg-secondary/10" />
                <div class="relative">
                  <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                    Memories Ingested
                  </p>
                  <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                    {usage?.ingest_count || 0}
                  </p>
                </div>
              </div>

              <div class="group relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 transition-all hover:border-primary/20 hover:shadow-sm">
                <div class="absolute top-0 right-0 w-20 h-20 bg-tertiary/5 rounded-bl-full -mr-6 -mt-6 transition-all group-hover:bg-tertiary/10" />
                <div class="relative">
                  <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                    Semantic Queries
                  </p>
                  <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                    {usage?.query_count || 0}
                  </p>
                </div>
              </div>

              <div class="group relative overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 transition-all hover:border-primary/20 hover:shadow-sm">
                <div class="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full -mr-6 -mt-6 transition-all group-hover:bg-primary/10" />
                <div class="relative">
                  <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                    Last Activity
                  </p>
                  <p class="mt-1.5 text-base font-bold text-on-surface">
                    <LocalDateTime value={usage?.last_request_ms ?? null} />
                  </p>
                </div>
              </div>
            </section>

            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-widest text-tertiary">
                Combined Knowledge Space
              </h3>
            </div>
            <section class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                  Total Memories
                </p>
                <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                  {formatNum(combinedStats.memory_count)}
                </p>
              </div>
              <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                  Total Entities
                </p>
                <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                  {formatNum(combinedStats.entity_count)}
                </p>
              </div>
              <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                  Total Facts
                </p>
                <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                  {formatNum(combinedStats.fact_count)}
                </p>
              </div>
              <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                  Combined Storage
                </p>
                <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                  {formatBytes(combinedStats.storage_bytes)}
                </p>
              </div>
            </section>

            <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div class="lg:col-span-2 space-y-6">
                <section>
                  <div class="mb-4 flex items-center justify-between">
                    <h3 class="text-base font-bold tracking-tight text-on-surface">
                      Your Clusters
                    </h3>
                    <Link
                      href="/platform/clusters/new"
                      class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.97] shadow-sm"
                    >
                      <PlusIcon class="w-3.5 h-3.5" />
                      Deploy Cluster
                    </Link>
                  </div>

                  <div class="space-y-3">
                    {clusters.length === 0 && (
                      <div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/15 py-12 px-6 text-center">
                        <div class="flex items-center justify-center h-12 w-12 rounded-xl bg-surface-container-high text-tertiary mb-4">
                          <ServerIcon class="w-6 h-6" />
                        </div>
                        <p class="text-sm font-medium text-tertiary mb-4">
                          No clusters yet. Deploy one to start connecting your
                          agents.
                        </p>
                        <Link
                          href="/platform/clusters/new"
                          class="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-on-primary transition-all hover:opacity-90 shadow-sm"
                        >
                          Deploy First Cluster
                        </Link>
                      </div>
                    )}
                    {clusters.map((cluster: Cluster) => (
                      <div
                        key={cluster.id}
                        class="group flex flex-col justify-between gap-4 rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 transition-all hover:border-primary/20 hover:shadow-sm lg:flex-row lg:items-center"
                      >
                        <div class="flex items-start gap-3.5">
                          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                            <ServerIcon class="w-5 h-5" />
                          </div>
                          <div>
                            <div class="flex items-center gap-2.5 flex-wrap">
                              <h4 class="text-sm font-bold text-on-surface">
                                {cluster.name}
                              </h4>
                              <span
                                class={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${
                                  cluster.status === "active"
                                    ? "bg-green-500/10 text-green-400"
                                    : cluster.status === "provisioning"
                                      ? "bg-yellow-500/10 text-yellow-400"
                                      : cluster.status === "failed"
                                        ? "bg-red-500/10 text-red-400"
                                        : "bg-outline-variant/10 text-tertiary"
                                }`}
                              >
                                {cluster.status}
                              </span>
                              <span class="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary font-bold uppercase tracking-[0.1em]">
                                {cluster.tier}
                              </span>
                            </div>
                            <p class="mt-1 font-mono text-xs text-tertiary">
                              {cluster.endpoint_url}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/platform/clusters/${cluster.id}`}
                          class="inline-flex items-center justify-center rounded-lg border border-outline-variant/15 px-4 py-2 text-xs font-bold text-on-surface transition-all hover:bg-surface-container hover:border-primary/30"
                        >
                          Manage
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <aside class="space-y-6">
                <div class="rounded-xl bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] border border-primary/15 p-5">
                  <div class="flex items-center gap-2.5 mb-3">
                    <div class="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
                      <BarChart3Icon class="w-4 h-4" />
                    </div>
                    <h3 class="text-sm font-bold text-primary">Need Scale?</h3>
                  </div>
                  <p class="text-xs text-tertiary leading-relaxed">
                    Unlock dedicated HNSW clusters and multi-region
                    synchronization for massive agent deployments.
                  </p>
                  <a
                    href={CONTACT_MAILTO}
                    class="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.97] shadow-sm"
                  >
                    Contact Engineering
                    <ExternalLinkIcon class="w-3 h-3" />
                  </a>
                </div>
              </aside>
            </div>
          </>
        )}

        {activeMissionTab.value === "api" && (
          <div class="space-y-6">
            {/* Key creation success banner (shows regardless of active sub-tab) */}
            {newlyCreatedKey.token && (
              <div class="rounded-xl bg-primary/[0.06] border border-primary/25 p-5">
                <div class="flex items-center gap-2.5 mb-3">
                  <div class="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10">
                    <CheckCircle2Icon class="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p class="text-xs font-bold text-primary">
                    New Key Generated Successfully
                  </p>
                </div>
                <p class="text-xs text-tertiary mb-3">
                  Make sure to copy your API key now. You won't be able to see
                  it again.
                </p>
                <div class="flex items-center gap-2 rounded-lg bg-black/40 p-3 font-mono text-xs text-primary border border-primary/15">
                  <span class="flex-1 truncate">{newlyCreatedKey.token}</span>
                  <button
                    class="p-1.5 hover:bg-primary/20 rounded transition-colors shrink-0"
                    onClick$={() =>
                      navigator.clipboard.writeText(newlyCreatedKey.token || "")
                    }
                  >
                    <CopyIcon class="w-3.5 h-3.5" />
                  </button>
                </div>
                <div class="mt-4 rounded-lg bg-black/20 border border-outline-variant/10 p-4">
                  <p class="text-[10px] font-bold uppercase tracking-widest text-tertiary mb-2">
                    Usage Example
                  </p>
                  <pre class="overflow-x-auto font-mono text-[10px] leading-relaxed text-primary/70 whitespace-pre-wrap">{`curl -X POST https://tellodb.com/api/ingest \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${newlyCreatedKey.token?.substring(0, 20)}..." \\
  -d '{
    "entity_id": "user-1",
    "textual_content": "Hello, Tellodb!"
  }'`}</pre>
                </div>
                <a
                  href="/docs/quickstart"
                  class="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:opacity-80 transition-opacity"
                >
                  <ExternalLinkIcon class="w-3 h-3" />
                  Read the Quickstart Guide →
                </a>
                {newlyCreatedKey.engineSynced ? (
                  <p class="text-[10px] text-green-400 mt-3 flex items-center gap-1">
                    <CheckCircle2Icon class="w-3 h-3" />
                    Key synced to engine - ready for direct API access
                  </p>
                ) : (
                  <p class="text-[10px] text-amber-400 mt-3 flex items-center gap-1">
                    <AlertCircleIcon class="w-3 h-3" />
                    Key created but engine sync failed (
                    {newlyCreatedKey.engineError || "unknown error"}). Use the
                    proxy endpoint or contact support.
                  </p>
                )}
              </div>
            )}

            <div class="mb-2 inline-flex flex-wrap rounded-xl border border-outline-variant/10 bg-surface-container-low p-1 gap-1">
              <button
                type="button"
                class={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all ${activeApiTab.value === "keys" ? "bg-primary text-on-primary shadow-sm" : "text-tertiary hover:text-on-surface"}`}
                onClick$={() => {
                  activeApiTab.value = "keys";
                }}
              >
                <KeyIcon
                  class={`w-3.5 h-3.5 ${activeApiTab.value === "keys" ? "text-on-primary" : "text-tertiary"}`}
                />
                API Keys
              </button>
              <button
                type="button"
                class={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all ${activeApiTab.value === "usage" ? "bg-primary text-on-primary shadow-sm" : "text-tertiary hover:text-on-surface"}`}
                onClick$={() => {
                  activeApiTab.value = "usage";
                }}
              >
                <TrendingUpIcon
                  class={`w-3.5 h-3.5 ${activeApiTab.value === "usage" ? "text-on-primary" : "text-tertiary"}`}
                />
                Usage Analytics
              </button>
              <button
                type="button"
                class={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all ${activeApiTab.value === "graph" ? "bg-primary text-on-primary shadow-sm" : "text-tertiary hover:text-on-surface"}`}
                onClick$={() => {
                  activeApiTab.value = "graph";
                }}
              >
                <GitBranchIcon
                  class={`w-3.5 h-3.5 ${activeApiTab.value === "graph" ? "text-on-primary" : "text-tertiary"}`}
                />
                Knowledge Graph
              </button>
              <button
                type="button"
                class={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all ${activeApiTab.value === "storage" ? "bg-primary text-on-primary shadow-sm" : "text-tertiary hover:text-on-surface"}`}
                onClick$={() => {
                  activeApiTab.value = "storage";
                }}
              >
                <DatabaseIcon
                  class={`w-3.5 h-3.5 ${activeApiTab.value === "storage" ? "text-on-primary" : "text-tertiary"}`}
                />
                Storage Explorer
              </button>
            </div>

            {/* ───── API Keys Sub-tab ───── */}
            {(activeApiTab.value === "keys" ||
              activeApiTab.value === "create") && (
              <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div class="lg:col-span-2 space-y-6">
                  <section>
                    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 class="text-base font-bold tracking-tight text-on-surface">
                          API Key Management
                        </h3>
                        <p class="mt-1 text-sm text-tertiary">
                          Generate, rotate, and segment access keys for every
                          environment.
                        </p>
                      </div>
                      <div class="inline-flex rounded-lg border border-outline-variant/10 bg-surface-container-low p-0.5">
                        <button
                          type="button"
                          class={`rounded-md px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-all ${activeApiTab.value === "keys" ? "bg-primary text-on-primary shadow-sm" : "text-tertiary hover:text-on-surface"}`}
                          onClick$={() => {
                            activeApiTab.value = "keys";
                          }}
                        >
                          Active Keys
                        </button>
                        <button
                          type="button"
                          class={`rounded-md px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-all ${activeApiTab.value === "create" ? "bg-primary text-on-primary shadow-sm" : "text-tertiary hover:text-on-surface"}`}
                          onClick$={() => {
                            activeApiTab.value = "create";
                          }}
                        >
                          Create Key
                        </button>
                      </div>
                    </div>

                    {activeApiTab.value === "keys" ? (
                      <div class="space-y-3">
                        {localKeyList.value.length === 0 &&
                          !newlyCreatedKey.token && (
                            <div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/15 py-12 px-6 text-center">
                              <div class="flex items-center justify-center h-12 w-12 rounded-xl bg-surface-container-high text-tertiary mb-4">
                                <KeyIcon class="w-6 h-6" />
                              </div>
                              <p class="text-sm font-medium text-tertiary mb-4">
                                No API keys yet. Create one to start using the
                                engine.
                              </p>
                              <button
                                type="button"
                                class="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-on-primary transition-all hover:opacity-90 shadow-sm"
                                onClick$={() => {
                                  activeApiTab.value = "create";
                                }}
                              >
                                Create First Key
                              </button>
                            </div>
                          )}
                        {localKeyList.value.map((key) => {
                          const isVisible = !!visibleKeys[key.key_id];
                          const displayValue = isVisible
                            ? key.token || `${key.key_prefix}••••••••••••`
                            : `${key.key_prefix}••••••••••••`;
                          return (
                            <div
                              key={key.key_id}
                              class="group flex flex-col justify-between gap-4 rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 transition-all hover:border-primary/20 hover:shadow-sm lg:flex-row lg:items-center"
                            >
                              <div class="flex items-center gap-3.5">
                                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                                  <KeyIcon class="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 class="text-sm font-bold text-on-surface">
                                    {key.name}
                                  </h4>
                                  <div class="mt-0.5 flex items-center gap-2">
                                    <p class="font-mono text-xs text-tertiary tracking-widest">
                                      {displayValue}
                                    </p>
                                    <button
                                      type="button"
                                      onClick$={() => {
                                        visibleKeys[key.key_id] =
                                          !visibleKeys[key.key_id];
                                      }}
                                      class="text-tertiary hover:text-on-surface p-0.5 rounded transition-colors"
                                      title={
                                        isVisible
                                          ? "Hide API key"
                                          : "Show API key"
                                      }
                                    >
                                      {isVisible ? (
                                        <EyeOffIcon class="w-3.5 h-3.5" />
                                      ) : (
                                        <EyeIcon class="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick$={() => {
                                        navigator.clipboard.writeText(
                                          key.token || "",
                                        );
                                      }}
                                      class="text-tertiary hover:text-on-surface p-0.5 rounded transition-colors"
                                      title="Copy API key"
                                    >
                                      <CopyIcon class="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div class="flex items-center gap-5">
                                <div class="text-right">
                                  <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-tertiary">
                                    Created
                                  </p>
                                  <p class="font-mono text-xs text-on-surface">
                                    <LocalDateTime value={key.created_at_ms} />
                                  </p>
                                </div>
                                <Form action={revokeKeyAction}>
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={key.key_id}
                                  />
                                  <button
                                    type="submit"
                                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500 hover:text-white"
                                    title="Revoke key"
                                  >
                                    <Trash2Icon class="w-3.5 h-3.5" />
                                  </button>
                                </Form>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <section>
                        <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                          <h3 class="text-sm font-bold text-on-surface mb-1">
                            Provision Access
                          </h3>
                          <p class="text-xs text-tertiary mb-4">
                            Create multiple keys to isolate your staging,
                            production, and sidecar environments.
                          </p>
                          {keyCreateError.value && (
                            <p class="text-xs text-red-400 mb-3 flex items-center gap-1.5">
                              <AlertCircleIcon class="w-3.5 h-3.5 shrink-0" />
                              {keyCreateError.value}
                            </p>
                          )}
                          <div class="flex flex-col gap-3 sm:flex-row">
                            <input
                              value={newApiKeyName.value}
                              onInput$={(_, el) => {
                                newApiKeyName.value = el.value;
                              }}
                              class="flex-1 rounded-lg border border-outline-variant/15 bg-surface-container-highest px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-tertiary/50"
                              placeholder="Key identifier (e.g. Production)"
                              disabled={isCreatingKey.value}
                            />
                            <button
                              type="button"
                              disabled={
                                isCreatingKey.value ||
                                !newApiKeyName.value.trim()
                              }
                              class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60 shrink-0 shadow-sm"
                              onClick$={async () => {
                                const name = newApiKeyName.value.trim();
                                if (!name || isCreatingKey.value) return;
                                isCreatingKey.value = true;
                                keyCreateError.value = "";
                                try {
                                  const result = await createKeyAction.submit({
                                    name,
                                  });
                                  const res = result.value;
                                  if (res?.success && res?.key) {
                                    const key = res.key as ApiKey;
                                    localKeyList.value = [
                                      key,
                                      ...localKeyList.value,
                                    ];
                                    newlyCreatedKey.token = key.token || "";
                                    newlyCreatedKey.engineSynced =
                                      res.engineSynced || false;
                                    newlyCreatedKey.engineError =
                                      res.engineError || "";
                                    newApiKeyName.value = "";
                                    activeApiTab.value = "keys";
                                  } else {
                                    keyCreateError.value =
                                      "Failed to create key. Please try again.";
                                  }
                                } catch (err: any) {
                                  keyCreateError.value =
                                    err?.message ||
                                    "Network error. Please try again.";
                                } finally {
                                  isCreatingKey.value = false;
                                }
                              }}
                            >
                              {isCreatingKey.value ? (
                                <>
                                  <Loader2Icon class="w-3.5 h-3.5 animate-spin" />{" "}
                                  Generating...
                                </>
                              ) : (
                                "Generate New Key"
                              )}
                            </button>
                          </div>
                        </div>
                      </section>
                    )}
                  </section>
                </div>
                <aside class="space-y-6">
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="text-sm font-bold text-on-surface">
                        Local Sidecar
                      </h3>
                      <span class="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary font-bold">
                        Python SDK
                      </span>
                    </div>
                    <p class="text-xs text-tertiary mb-3 leading-relaxed">
                      Connect your local agent to the engine using your
                      provisioned key.
                    </p>
                    <pre class="overflow-x-auto rounded-lg bg-black/30 p-4 font-mono text-[10px] leading-relaxed text-primary/70 border border-primary/5">
                      <code>{`from tellodb import TellodbClient

client = TellodbClient(
  api_key="${activeKey}",
  base_url="${proxyBaseUrl}"
)

client.ingest(
  entity_id="u_99",
  text="I prefer jasmine tea."
)`}</code>
                    </pre>
                  </div>
                  <div class="rounded-xl bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] border border-primary/15 p-5">
                    <div class="flex items-center gap-2.5 mb-3">
                      <div class="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
                        <BarChart3Icon class="w-4 h-4" />
                      </div>
                      <h3 class="text-sm font-bold text-primary">
                        Need Scale?
                      </h3>
                    </div>
                    <p class="text-xs text-tertiary leading-relaxed">
                      Unlock dedicated HNSW clusters and multi-region sync for
                      massive deployments.
                    </p>
                    <a
                      href={CONTACT_MAILTO}
                      class="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.97] shadow-sm"
                    >
                      Contact Engineering <ExternalLinkIcon class="w-3 h-3" />
                    </a>
                  </div>
                </aside>
              </div>
            )}

            {/* ───── Usage Analytics Sub-tab ───── */}
            {activeApiTab.value === "usage" && (
              <div class="space-y-6">
                {/* Summary cards */}
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Total Requests
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {usage?.request_count || 0}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Ingests
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {usage?.ingest_count || 0}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Queries
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {usage?.query_count || 0}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Credits Used
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatNum(
                        (usage?.request_count || 0) +
                          (usage?.ingest_count || 0),
                      )}
                    </p>
                  </div>
                </div>

                {/* Knowledge space summary */}
                <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Total Memories
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatNum(combinedStats.memory_count)}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Entities
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatNum(combinedStats.entity_count)}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Facts
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatNum(combinedStats.fact_count)}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Storage
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatBytes(combinedStats.storage_bytes)}
                    </p>
                  </div>
                </div>

                {/* Daily usage bar chart */}
                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                  <h3 class="text-sm font-bold text-on-surface mb-4">
                    Daily Usage (Last {usageData.daily.length} days)
                  </h3>
                  {usageData.daily.length === 0 ? (
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                      <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-surface-container-high text-tertiary mb-3">
                        <TrendingUpIcon class="w-5 h-5" />
                      </div>
                      <p class="text-sm font-medium text-tertiary">
                        No usage data yet.
                      </p>
                      <p class="text-xs text-tertiary/60 mt-1">
                        Start making API requests to see your usage patterns.
                      </p>
                    </div>
                  ) : (
                    <div class="overflow-x-auto">
                      <svg
                        width={Math.max(600, usageData.daily.length * 50)}
                        height="200"
                        class="text-tertiary"
                      >
                        <g transform="translate(40, 10)">
                          {(() => {
                            const maxVal = Math.max(
                              1,
                              ...usageData.daily.map(
                                (d) => d.request_count || 0,
                              ),
                            );
                            const barW = Math.max(
                              20,
                              (Math.min(600, usageData.daily.length * 50) -
                                40) /
                                usageData.daily.length -
                                6,
                            );
                            return usageData.daily.map((d, i) => {
                              const h = ((d.request_count || 0) / maxVal) * 150;
                              return (
                                <g key={d.date}>
                                  <rect
                                    x={i * (barW + 6)}
                                    y={150 - h}
                                    width={barW}
                                    height={h}
                                    rx="2"
                                    fill="currentColor"
                                    class="fill-primary/60 hover:fill-primary transition-colors"
                                  />
                                  <text
                                    x={i * (barW + 6) + barW / 2}
                                    y={175}
                                    text-anchor="middle"
                                    class="fill-tertiary text-[8px] font-mono"
                                  >
                                    {d.date.slice(5)}
                                  </text>
                                  <title>{`${d.date}: ${d.request_count} requests`}</title>
                                </g>
                              );
                            });
                          })()}
                        </g>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ───── Knowledge Graph Sub-tab ───── */}
            {activeApiTab.value === "graph" && (
              <div class="space-y-6">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Total Edges
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatNum(graphData.edges.length)}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Unique Nodes
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatNum(
                        (() => {
                          const s = new Set<string>();
                          for (const e of graphData.edges) {
                            s.add(e.source);
                            s.add(e.target);
                          }
                          return s.size;
                        })(),
                      )}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Edge Types
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatNum(
                        (() => {
                          const s = new Set<string>();
                          for (const e of graphData.edges) {
                            s.add(e.edge_type);
                          }
                          return s.size;
                        })(),
                      )}
                    </p>
                  </div>
                </div>

                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h3 class="text-sm font-bold text-on-surface">
                      Knowledge Graph Visualization
                    </h3>
                    <div class="flex items-center gap-2">
                      <input
                        value={graphEntityId.value}
                        onInput$={(_, el) => {
                          graphEntityId.value = el.value;
                        }}
                        placeholder="entity_id (e.g. user-1223)"
                        class="rounded-lg border border-outline-variant/15 bg-surface-container-highest px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-tertiary/50 w-48"
                      />
                      <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.97] shrink-0"
                        onClick$={async () => {
                          graphData.loaded = false;
                          graphData.edges = [];
                          try {
                            const eid = graphEntityId.value.trim();
                            const url = eid
                              ? `/api/shared/graph-edges?entity_id=${encodeURIComponent(eid)}`
                              : "/api/shared/graph-edges";
                            const res = await fetch(url);
                            graphData.edges = res.ok
                              ? ((await res.json()) as GraphEdge[])
                              : [];
                          } catch {
                            graphData.edges = [];
                          }
                          graphData.loaded = true;
                        }}
                      >
                        <GitBranchIcon class="w-3 h-3" />
                        Explore
                      </button>
                    </div>
                  </div>
                  {graphData.edges.length === 0 ? (
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                      <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-surface-container-high text-tertiary mb-3">
                        <GitBranchIcon class="w-5 h-5" />
                      </div>
                      {graphData.loaded ? (
                        <>
                          <p class="text-sm font-medium text-tertiary">
                            No knowledge graph data loaded yet.
                          </p>
                          <p class="text-xs text-tertiary/60 mt-1 max-w-sm">
                            Enter your entity_id above and click Explore to load
                            your knowledge graph, or ingest some memories via
                            the API first.
                          </p>
                          <pre class="mt-4 text-left rounded-lg bg-black/30 border border-outline-variant/10 p-3 font-mono text-[10px] text-primary/70 max-w-sm">
                            {`curl -X POST https://tellodb.com/api/ingest \\
  -H "x-api-key: YOUR_KEY" \\
  -d '{"entity_id":"user-1223","textual_content":"..."}'`}
                          </pre>
                        </>
                      ) : (
                        <p class="text-sm font-medium text-tertiary">
                          Loading knowledge graph...
                        </p>
                      )}
                    </div>
                  ) : (
                    <div class="overflow-x-auto">
                      <svg
                        width={Math.max(500, graphData.edges.length * 1.5)}
                        height="400"
                      >
                        {(() => {
                          const nodes = Array.from(
                            (() => {
                              const s = new Set<string>();
                              for (const e of graphData.edges) {
                                s.add(e.source);
                                s.add(e.target);
                              }
                              return s;
                            })(),
                          );
                          const nodePos = new Map<
                            string,
                            { x: number; y: number }
                          >();
                          const cx =
                            Math.max(500, graphData.edges.length * 1.5) / 2;
                          const cy = 200;
                          const r = Math.min(180, nodes.length * 15);
                          nodes.forEach((n, i) => {
                            const angle =
                              (2 * Math.PI * i) / nodes.length - Math.PI / 2;
                            nodePos.set(n, {
                              x: cx + r * Math.cos(angle),
                              y: cy + r * Math.sin(angle),
                            });
                          });
                          return (
                            <>
                              {graphData.edges.slice(0, 200).map((e, i) => {
                                const sp = nodePos.get(e.source);
                                const tp = nodePos.get(e.target);
                                if (!sp || !tp) return null;
                                return (
                                  <g key={e.edge_id}>
                                    <line
                                      x1={sp.x}
                                      y1={sp.y}
                                      x2={tp.x}
                                      y2={tp.y}
                                      stroke="currentColor"
                                      class="stroke-primary/20"
                                      stroke-width={Math.max(0.5, e.weight * 3)}
                                    />
                                    <title>{`${e.source} → ${e.target}: ${e.label || e.edge_type} (w: ${e.weight.toFixed(2)})`}</title>
                                  </g>
                                );
                              })}
                              {nodes.map((n) => {
                                const p = nodePos.get(n)!;
                                return (
                                  <g key={n}>
                                    <circle
                                      cx={p.x}
                                      cy={p.y}
                                      r="6"
                                      class="fill-primary stroke-surface-container-low"
                                      stroke-width="2"
                                    />
                                    <text
                                      x={p.x}
                                      y={p.y + 16}
                                      text-anchor="middle"
                                      class="fill-tertiary text-[9px] font-mono"
                                      font-size="9"
                                    >
                                      {n.length > 20
                                        ? n.slice(0, 18) + ".."
                                        : n}
                                    </text>
                                    <title>{n}</title>
                                  </g>
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  )}
                </div>

                {/* Edge Type Distribution */}
                {graphData.edges.length > 0 && (
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <h3 class="text-sm font-bold text-on-surface mb-4">
                      Edge Type Distribution
                    </h3>
                    <div class="space-y-2">
                      {(() => {
                        const dist = new Map<string, number>();
                        for (const e of graphData.edges) {
                          dist.set(
                            e.edge_type,
                            (dist.get(e.edge_type) || 0) + 1,
                          );
                        }
                        const maxCount = Math.max(1, ...dist.values());
                        return Array.from(dist.entries())
                          .sort((a, b) => b[1] - a[1])
                          .map(([type, count]) => (
                            <div key={type} class="flex items-center gap-3">
                              <span class="w-24 shrink-0 text-xs font-mono text-on-surface truncate">
                                {type}
                              </span>
                              <div class="flex-1 h-5 rounded bg-outline-variant/10 overflow-hidden">
                                <div
                                  class="h-full rounded bg-gradient-to-r from-primary to-secondary transition-all"
                                  style={{
                                    width: `${(count / maxCount) * 100}%`,
                                  }}
                                />
                              </div>
                              <span class="w-12 text-right text-xs font-bold text-tertiary">
                                {count}
                              </span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ───── Storage Explorer Sub-tab ───── */}
            {activeApiTab.value === "storage" && (
              <div class="space-y-6">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Total Records
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatNum(
                        storageData.stats
                          ? Object.entries(storageData.stats)
                              .filter(([k]) => k.endsWith("_count"))
                              .reduce((s, [, v]) => s + (v as number), 0)
                          : 0,
                      )}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      Data Structures
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {storageData.stats
                        ? Object.entries(storageData.stats).filter(([k]) =>
                            k.endsWith("_count"),
                          ).length
                        : 0}
                    </p>
                  </div>
                  <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                      DB Size
                    </p>
                    <p class="mt-1.5 text-2xl font-black text-on-surface tracking-tight">
                      {formatBytes(storageData.stats?.storage_bytes || 0)}
                    </p>
                  </div>
                </div>

                {/* Data structure bar chart */}
                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                  <h3 class="text-sm font-bold text-on-surface mb-4">
                    TelloDB Schema — Record Distribution
                  </h3>
                  {!storageData.loaded ? (
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                      <Loader2Icon class="w-6 h-6 animate-spin text-primary mb-3" />
                      <p class="text-xs text-tertiary">
                        Loading storage statistics...
                      </p>
                    </div>
                  ) : !storageData.stats ? (
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                      <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-surface-container-high text-tertiary mb-3">
                        <DatabaseIcon class="w-5 h-5" />
                      </div>
                      <p class="text-sm font-medium text-tertiary">
                        No storage data available.
                      </p>
                    </div>
                  ) : (
                    <div class="space-y-2">
                      {(() => {
                        const entries: [string, number][] = [];
                        for (const [k, v] of Object.entries(
                          storageData.stats!,
                        )) {
                          if (k.endsWith("_count") && k !== "storage_bytes") {
                            entries.push([
                              k.replace(/_count$/, "").replace(/_/g, " "),
                              v as number,
                            ]);
                          }
                        }
                        entries.sort((a, b) => b[1] - a[1]);
                        const maxCount = Math.max(
                          1,
                          ...entries.map((e) => e[1]),
                        );
                        const labelMap: Record<string, string> = {
                          "memory card": "Memory Cards",
                          edge: "Graph Edges",
                          memory: "Memories",
                          metric: "Metrics",
                          "ledger turn": "Ledger Turns",
                          "memory artifact": "Artifacts",
                          "temporal event": "Temporal Events",
                          "shadow question": "Shadow Questions",
                          "facet posting": "Facet Postings",
                          "mem cell": "Memory Cells",
                          "mem scene": "Memory Scenes",
                          "profile fact": "Profile Facts",
                          "session router": "Session Routers",
                          "fact version": "Fact Versions",
                          "card relation": "Card Relations",
                          "memory link": "Memory Links",
                          alias: "Aliases",
                          preference: "Preferences",
                          "core profile": "Core Profiles",
                          "deletion tombstone": "Tombstones",
                        };
                        return entries.map(([label, count]) => (
                          <div key={label} class="flex items-center gap-3">
                            <span class="w-32 shrink-0 text-xs font-semibold text-on-surface truncate capitalize">
                              {labelMap[label] || label}
                            </span>
                            <div class="flex-1 h-5 rounded bg-outline-variant/10 overflow-hidden">
                              <div
                                class="h-full rounded bg-gradient-to-r from-secondary to-primary transition-all flex items-center justify-end pr-1.5"
                                style={{
                                  width: `${Math.max(2, (count / maxCount) * 100)}%`,
                                }}
                              >
                                {count > maxCount * 0.15 && (
                                  <span class="text-[9px] font-bold text-on-primary">
                                    {count}
                                  </span>
                                )}
                              </div>
                            </div>
                            {count <= maxCount * 0.15 && (
                              <span class="w-16 text-right text-xs font-bold text-tertiary">
                                {formatNum(count)}
                              </span>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeMissionTab.value === "billing" && (
          <div class="space-y-8 max-w-5xl">
            {loc.url.searchParams.get("success") === "true" && (
              <div class="rounded-xl bg-green-500/[0.07] border border-green-500/25 p-4 text-green-400 flex items-start gap-3">
                <div class="flex items-center justify-center h-8 w-8 rounded-full bg-green-500/10 shrink-0">
                  <CheckCircle2Icon class="w-4 h-4" />
                </div>
                <div>
                  <p class="text-sm font-bold">Payment Successful!</p>
                  <p class="text-xs text-tertiary mt-0.5">
                    {loc.url.searchParams.get("tokens")
                      ? `${Number(loc.url.searchParams.get("tokens")).toLocaleString()} prepaid truths have been added to your account.`
                      : "Your subscription has been updated and your hosting plan is active."}
                  </p>
                </div>
              </div>
            )}

            {loc.url.searchParams.get("canceled") === "true" && (
              <div class="rounded-xl bg-red-500/[0.07] border border-red-500/25 p-4 text-red-400 flex items-start gap-3">
                <div class="flex items-center justify-center h-8 w-8 rounded-full bg-red-500/10 shrink-0 font-bold text-sm">
                  !
                </div>
                <div>
                  <p class="text-sm font-bold">Payment Canceled</p>
                  <p class="text-xs text-tertiary mt-0.5">
                    The checkout session was canceled. No charges were made.
                  </p>
                </div>
              </div>
            )}

            {/* Prepaid Token Balance & Monthly Free Allocation */}
            <section class="grid gap-5 md:grid-cols-2">
              {/* Token Credits Status */}
              <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-primary mb-3 flex items-center gap-1.5">
                  <CheckIcon class="w-3.5 h-3.5" /> Active Credits
                </p>
                <h2 class="text-3xl font-extrabold text-on-surface tracking-tight">
                  {platformData.value.sub?.token_balance !== undefined
                    ? platformData.value.sub.token_balance.toLocaleString()
                    : "10,000"}
                  <span class="text-sm font-medium text-tertiary ml-2">
                    truths remaining
                  </span>
                </h2>

                {/* Monthly Free Tier Progress */}
                {platformData.value.sub?.token_balance !== undefined &&
                platformData.value.sub.token_balance <= 10000 ? (
                  <div class="mt-5">
                    <div class="flex justify-between text-xs font-semibold text-tertiary mb-1.5">
                      <span>Monthly Free Allocation</span>
                      <span>
                        {platformData.value.sub.token_balance.toLocaleString()}{" "}
                        / 10,000 left
                      </span>
                    </div>
                    <div class="w-full bg-outline-variant/20 rounded-full h-1.5 overflow-hidden">
                      <div
                        class="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(platformData.value.sub.token_balance / 10000) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <p class="text-[10px] text-tertiary/70 mt-2">
                      Resets every 30 days. 1 credit per ingest or query.
                    </p>
                  </div>
                ) : (
                  <p class="text-xs text-green-400/80 font-medium mt-4">
                    Free tier fully utilized. Active prepaid credits:{" "}
                    {(
                      (platformData.value.sub?.token_balance || 10000) - 10000
                    ).toLocaleString()}{" "}
                    truths.
                  </p>
                )}
              </div>

              {/* Refill Tokens Selector */}
              <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary mb-3">
                  Refill Prepaid Tokens
                </p>
                <div class="space-y-2.5">
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
                      class="flex items-center justify-between gap-3 p-3 rounded-lg border border-outline-variant/5 bg-black/20 hover:border-primary/20 transition-all"
                    >
                      <input type="hidden" name="package_id" value={pack.id} />
                      <div class="min-w-0">
                        <p class="text-sm font-bold text-on-surface">
                          {pack.name}
                        </p>
                        <p class="text-[10px] text-tertiary">{pack.desc}</p>
                      </div>
                      <button
                        type="submit"
                        onClick$={() =>
                          capture("token_purchase_clicked", {
                            package: pack.id,
                          })
                        }
                        class="shrink-0 rounded-lg bg-primary px-3.5 py-1.5 font-bold text-[11px] text-on-primary hover:opacity-90 transition-opacity shadow-sm"
                      >
                        Buy
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            </section>

            {/* Current Plan Info */}
            {platformData.value.sub && (
              <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary mb-1">
                      Current Plan
                    </p>
                    <p class="text-xl font-bold text-on-surface capitalize">
                      {platformData.value.sub.tier?.replace("_", " ") ||
                        "Fractional"}
                    </p>
                    <p class="text-xs text-tertiary mt-0.5">
                      Status:{" "}
                      <span class="capitalize text-green-400/80 font-semibold">
                        {platformData.value.sub.status}
                      </span>
                    </p>
                  </div>
                  {platformData.value.sub.stripe_customer_id && (
                    <form method="post" action="/api/billing/portal">
                      <button
                        type="submit"
                        onClick$={() => capture("billing_portal_opened")}
                        class="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 font-bold text-xs text-primary transition-all hover:bg-primary hover:text-white"
                      >
                        <CreditCardIcon class="w-3.5 h-3.5" />
                        Manage in Stripe
                        <ExternalLinkIcon class="w-3 h-3" />
                      </button>
                    </form>
                  )}
                </div>
                {platformData.value.sub.current_period_end && (
                  <p class="text-xs text-tertiary/60 mt-3">
                    Current period ends:{" "}
                    {new Date(
                      platformData.value.sub.current_period_end,
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Plan Cards */}
            <div>
              <h2 class="text-lg font-bold text-on-surface mb-4">
                Hosting Plans
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {plans.map((plan) => {
                  const isCurrent = platformData.value.sub?.tier === plan.id;
                  return (
                    <div
                      key={plan.id}
                      class={`rounded-xl border p-5 flex flex-col ${
                        plan.highlighted
                          ? "border-primary/30 bg-gradient-to-b from-primary/[0.04] to-transparent ring-1 ring-primary/20"
                          : "border-outline-variant/10 bg-surface-container-low"
                      } ${isCurrent ? "ring-2 ring-primary" : ""}`}
                    >
                      {plan.highlighted && !isCurrent && (
                        <span class="text-[10px] font-bold uppercase tracking-[0.15em] text-primary mb-2">
                          Popular
                        </span>
                      )}
                      <h3 class="text-base font-bold text-on-surface">
                        {plan.name}
                      </h3>
                      <p class="text-2xl font-extrabold text-on-surface mt-1.5">
                        {plan.price}
                        <span class="text-xs font-medium text-tertiary">
                          {plan.unit}
                        </span>
                      </p>
                      <p class="text-xs text-tertiary mt-1.5 mb-3 leading-relaxed">
                        {plan.description}
                      </p>
                      <ul class="space-y-1.5 flex-1 mb-4">
                        {plan.features.map((f) => (
                          <li
                            key={f}
                            class="flex items-start gap-1.5 text-xs text-tertiary"
                          >
                            <CheckIcon class="w-3 h-3 text-green-400/80 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <button
                          disabled
                          class="w-full py-2.5 px-3 rounded-lg border border-outline-variant/15 text-xs font-bold text-tertiary/60 cursor-default"
                        >
                          Current Plan
                        </button>
                      ) : plan.contact ? (
                        <a
                          href="mailto:sales@tellodb.com"
                          class="block w-full text-center py-2.5 px-3 rounded-lg border border-outline-variant/15 text-xs font-bold text-on-surface hover:bg-surface-container transition-colors"
                        >
                          Contact Sales
                        </a>
                      ) : (
                        <Link
                          href={`/platform/clusters/new?tier=${plan.id}`}
                          class="block w-full text-center py-2.5 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
                        >
                          {plan.cta}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Purchase History */}
            <section class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
              <h2 class="text-base font-bold text-on-surface mb-0.5">
                Purchase History
              </h2>
              <p class="text-xs text-tertiary mb-4">
                A record of your past prepaid credit refills, dedicated VMs, and
                hosting plan upgrades.
              </p>

              <div class="overflow-x-auto -mx-5">
                <table class="w-full border-collapse text-left text-sm text-on-surface">
                  <thead>
                    <tr class="border-b border-outline-variant/10 text-[10px] font-bold uppercase tracking-[0.1em] text-tertiary">
                      <th class="py-3 px-5">Date</th>
                      <th class="py-3 px-5">Description</th>
                      <th class="py-3 px-5 text-right">Amount</th>
                      <th class="py-3 px-5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-outline-variant/5">
                    {platformData.value.purchases?.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          class="py-8 text-center text-tertiary text-xs"
                        >
                          No purchases found. Use a credit refill package or
                          deploy a dedicated VM.
                        </td>
                      </tr>
                    ) : (
                      platformData.value.purchases?.map((p: any) => (
                        <tr
                          key={p.id}
                          class="hover:bg-white/[0.02] transition-colors"
                        >
                          <td class="py-3.5 px-5 font-mono text-xs text-tertiary whitespace-nowrap">
                            {new Date(p.created_at).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </td>
                          <td class="py-3.5 px-5 font-semibold text-on-surface text-xs">
                            {p.description}
                          </td>
                          <td class="py-3.5 px-5 text-right font-mono font-bold text-on-surface text-xs">
                            ${Number(p.amount).toFixed(2)}
                          </td>
                          <td class="py-3.5 px-5 text-center">
                            <span class="inline-flex rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold text-green-400">
                              Paid
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeMissionTab.value === "settings" && (
          <>
            {/* ───── Profile Tab ───── */}
            {activeSettingsTab.value === "profile" && (
              <div class="max-w-2xl space-y-6">
                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
                  <div class="flex items-start gap-5">
                    <div class="h-16 w-16 shrink-0 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xl font-bold text-on-primary shadow-sm">
                      {platformData.value.user.username
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div class="pt-1">
                      <h2 class="text-lg font-bold text-on-surface">
                        {platformData.value.user.username}
                      </h2>
                      <p class="text-sm text-tertiary mt-0.5">
                        Free Tier Account
                      </p>
                      <div class="flex items-center gap-1.5 mt-2">
                        <span class="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold text-green-400 uppercase tracking-wider">
                          Active
                        </span>
                        <span class="text-[10px] text-tertiary">
                          Member since {new Date().toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low divide-y divide-outline-variant/5">
                  <div class="p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary mb-1.5">
                      Display Name
                    </p>
                    <p class="text-sm font-semibold text-on-surface">
                      {platformData.value.user.username}
                    </p>
                  </div>
                  <div class="p-5">
                    <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary mb-1.5">
                      User ID
                    </p>
                    <div class="flex items-center gap-2">
                      <code class="flex-1 text-xs font-mono text-tertiary bg-black/30 rounded-md px-3 py-2 border border-outline-variant/5 truncate">
                        {platformData.value.user.user_id}
                      </code>
                      <button
                        class="shrink-0 h-8 w-8 flex items-center justify-center rounded-md bg-surface-container-high text-tertiary hover:text-primary hover:bg-primary/10 transition-all"
                        onClick$={async () => {
                          await navigator.clipboard.writeText(
                            platformData.value.user.user_id,
                          );
                          settingsCopiedId.value = "user_id";
                          setTimeout(() => (settingsCopiedId.value = ""), 2000);
                        }}
                        title="Copy User ID"
                      >
                        {settingsCopiedId.value === "user_id" ? (
                          <CheckIcon class="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <CopyIcon class="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ───── Team Tab ───── */}
            {activeSettingsTab.value === "team" && (
              <div class="max-w-2xl space-y-6">
                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                      <div class="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-container-high text-primary">
                        <UsersIcon class="w-4 h-4" />
                      </div>
                      <h2 class="text-sm font-bold text-on-surface">
                        Members ({platformData.value.members.length})
                      </h2>
                    </div>
                  </div>
                  <div class="space-y-1">
                    {platformData.value.members.map(
                      (m: TeamMemberInfo, i: number) => (
                        <div
                          key={m.user_id}
                          class="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-container-high/50 transition-colors"
                        >
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-xs font-bold text-on-surface">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div class="min-w-0">
                              <p class="text-sm font-semibold text-on-surface truncate">
                                {m.name}
                              </p>
                              <p class="text-xs text-tertiary truncate">
                                {m.email}
                              </p>
                            </div>
                          </div>
                          <span
                            class={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                              m.role === "owner"
                                ? "bg-amber-500/10 text-amber-400"
                                : m.role === "admin"
                                  ? "bg-blue-500/10 text-blue-400"
                                  : "bg-surface-container-high text-tertiary"
                            }`}
                          >
                            {m.role}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div class="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
                  <div class="flex items-center gap-2 mb-4">
                    <div class="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-container-high text-primary">
                      <MailIcon class="w-4 h-4" />
                    </div>
                    <h2 class="text-sm font-bold text-on-surface">
                      Invite Member
                    </h2>
                  </div>
                  <form
                    method="post"
                    action="/api/team"
                    class="flex flex-col gap-3 sm:flex-row"
                  >
                    <input
                      type="email"
                      name="email"
                      placeholder="colleague@example.com"
                      class="flex-1 rounded-lg bg-black/40 border border-outline-variant/15 px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-tertiary/40"
                      required
                    />
                    <select
                      name="role"
                      class="rounded-lg bg-black/40 border border-outline-variant/15 px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      class="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-on-primary hover:opacity-90 transition-opacity shadow-sm shrink-0"
                    >
                      Send Invite
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ───── Context Templates Tab ───── */}
            {activeSettingsTab.value === "templates" && (
              <div class="max-w-3xl space-y-6">
                <p class="text-sm text-tertiary leading-relaxed">
                  Define how memories are formatted when sent to your LLM. Use
                  markers like{" "}
                  <code class="text-primary text-xs bg-primary/10 px-1.5 py-0.5 rounded">
                    {"{facts limit=10}"}
                  </code>{" "}
                  to control output.
                </p>

                {/* Built-in Templates */}
                <div>
                  <h3 class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary mb-3">
                    Built-in Templates
                  </h3>
                  <div class="grid gap-3 sm:grid-cols-3">
                    {PREDEFINED_TEMPLATES.map((p) => (
                      <div
                        key={p.name}
                        class="group relative rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 transition-all hover:border-primary/20 hover:shadow-sm"
                      >
                        <div class="flex items-center justify-between mb-2">
                          <h4 class="text-sm font-bold text-on-surface">
                            {p.name}
                          </h4>
                          <button
                            class="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick$={() => {
                              settingsNewName.value = p.name;
                              settingsNewTemplate.value = p.template;
                              showSettingsCreateForm.value = true;
                            }}
                          >
                            Use
                          </button>
                        </div>
                        <pre class="text-[10px] text-tertiary/70 leading-relaxed line-clamp-4 font-mono">
                          {p.template}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Your Templates Header */}
                <div class="flex items-center justify-between">
                  <h3 class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary">
                    Your Templates ({platformData.value.templates.length})
                  </h3>
                  <button
                    onClick$={() => {
                      showSettingsCreateForm.value = true;
                      settingsNewName.value = "";
                      settingsNewTemplate.value = "";
                    }}
                    class="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <PlusIcon class="w-3.5 h-3.5" /> New
                  </button>
                </div>

                {/* Create Form */}
                {showSettingsCreateForm.value && (
                  <Form
                    action={createTemplateAction}
                    class="rounded-xl border border-primary/20 bg-surface-container-low p-5 space-y-4"
                  >
                    <h3 class="text-sm font-bold text-on-surface">
                      Create Template
                    </h3>
                    <input
                      type="hidden"
                      name="cluster_id"
                      value={platformData.value.clusterId}
                    />
                    <div>
                      <label class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary block mb-1">
                        Name
                      </label>
                      <input
                        name="name"
                        class="w-full rounded-lg bg-black/40 border border-outline-variant/15 px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-tertiary/40"
                        placeholder="e.g., RAG Context"
                        required
                        value={settingsNewName.value}
                        onInput$={(_, el) => {
                          settingsNewName.value = el.value;
                        }}
                      />
                    </div>
                    <div>
                      <label class="text-[10px] font-bold uppercase tracking-[0.15em] text-tertiary block mb-1">
                        Template
                      </label>
                      <p class="text-xs text-tertiary/70 mb-2">
                        Markers:{" "}
                        <code class="text-primary text-[10px] bg-primary/10 px-1 rounded">
                          {"{facts limit=N}"}
                        </code>{" "}
                        <code class="text-primary text-[10px] bg-primary/10 px-1 rounded">
                          {"{user_summary}"}
                        </code>{" "}
                        <code class="text-primary text-[10px] bg-primary/10 px-1 rounded">
                          {"{graph_neighbors n=N}"}
                        </code>
                      </p>
                      <textarea
                        name="template"
                        rows={5}
                        class="w-full rounded-lg bg-black/40 border border-outline-variant/15 px-3.5 py-2.5 text-sm font-mono text-on-surface outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-tertiary/40"
                        placeholder="{user_summary}{facts limit=10}"
                        required
                        value={settingsNewTemplate.value}
                        onInput$={(_, el) => {
                          settingsNewTemplate.value = el.value;
                        }}
                      />
                    </div>
                    <div class="flex gap-3">
                      <button
                        type="submit"
                        disabled={createTemplateAction.isRunning}
                        class="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                      >
                        {createTemplateAction.isRunning
                          ? "Saving..."
                          : "Save Template"}
                      </button>
                      <button
                        type="button"
                        onClick$={() => (showSettingsCreateForm.value = false)}
                        class="rounded-lg border border-outline-variant/15 px-5 py-2.5 text-xs font-bold text-tertiary hover:bg-surface-container transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </Form>
                )}

                {/* Template List */}
                {platformData.value.templates.length === 0 &&
                  !showSettingsCreateForm.value && (
                    <div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/10 py-12 text-center">
                      <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-surface-container-high text-tertiary mb-3">
                        <FileTextIcon class="w-5 h-5" />
                      </div>
                      <p class="text-sm font-medium text-tertiary">
                        No custom templates yet.
                      </p>
                      <p class="text-xs text-tertiary/60 mt-1">
                        Create one above or use a built-in template.
                      </p>
                    </div>
                  )}

                <div class="space-y-2">
                  {platformData.value.templates.map((t: any) => (
                    <div
                      key={t.id}
                      class="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container-low p-4 transition-all hover:border-outline-variant/20"
                    >
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <div class="flex items-center justify-center h-6 w-6 rounded bg-surface-container-high text-primary">
                            <FileTextIcon class="w-3 h-3" />
                          </div>
                          <h4 class="text-sm font-bold text-on-surface">
                            {t.name}
                          </h4>
                        </div>
                        <pre class="text-xs text-tertiary/60 font-mono truncate pl-8">
                          {t.template.slice(0, 100)}
                        </pre>
                      </div>
                      <Form action={deleteTemplateAction} class="shrink-0 ml-3">
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          class="flex h-8 w-8 items-center justify-center rounded-lg text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete template"
                        >
                          <Trash2Icon class="w-3.5 h-3.5" />
                        </button>
                      </Form>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Console | TelloDB",
  description: "Mission Control for your agentic memory engine.",
  pathname: "/platform",
  noindex: true,
});
