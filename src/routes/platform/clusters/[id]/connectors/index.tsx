import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, Link, type DocumentHead } from "@builder.io/qwik-city";
import { ArrowLeftIcon, PlugIcon, ExternalLinkIcon, Trash2Icon, SettingsIcon } from "lucide-qwik";
import { buildSeoHead } from "~/lib/seo";
import { setPrivateNoStore } from "~/lib/cache";
import type { RequestHandler } from "@builder.io/qwik-city";
import { requireAuth } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { getConnectors, deleteConnector, getConnectorMeta } from "~/lib/connectors";
import { captureError } from "~/lib/sentry";
import { capture, captureServer } from "~/lib/posthog";

export const onRequest: RequestHandler = (event) => { setPrivateNoStore(event); };

export const useConnectorData = routeLoader$(async (event) => {
  try {
    const user = requireAuth(event);
    const clusterId = event.params.id;
    const supabase = getAdminSupabaseClient(event.env);
    const { data: cluster } = await supabase.from("clusters").select("*").eq("id", clusterId).single();
    if (!cluster || cluster.user_id !== user.user_id) throw event.error(404, "Not found");
    const connectors = await getConnectors(event, clusterId);
    return { cluster: cluster as any, connectors };
  } catch (e) {
    captureError(e, { page: "connectors" });
    throw e;
  }
});

export const useDeleteConnector = routeAction$(async (data, event) => {
  try {
    const user = requireAuth(event);
    await deleteConnector(event, String(data.id || ""));
    await captureServer("connector_deleted", user.user_id);
    return { success: true };
  } catch (e) {
    captureError(e, { page: "connectors", action: "deleteConnector" });
    return { success: false };
  }
});

const AVAILABLE = ["slack", "github", "notion"];

export default component$(() => {
  const data = useConnectorData();
  const deleteAction = useDeleteConnector();
  const cluster = data.value.cluster;
  const connectors = data.value.connectors as any[];

  return (
    <div class="flex min-h-screen bg-background text-on-surface font-body antialiased">
      <main class="flex-1 overflow-y-auto p-8 lg:p-12 mb-20 max-w-4xl mx-auto w-full pt-[104px]">
        <header class="mb-8">
          <Link href={`/platform/clusters/${cluster.id}`} class="text-tertiary hover:text-primary flex items-center gap-1 transition-colors w-fit">
            <ArrowLeftIcon class="w-4 h-4" />
            {cluster.name}
          </Link>
          <h1 class="font-headline text-3xl font-extrabold tracking-tighter text-on-surface mt-2">Connectors</h1>
          <p class="text-tertiary mt-2">Connect external services to auto-ingest data into your cluster.</p>
        </header>

        {/* Connected */}
        <div class="mb-8">
          <h3 class="text-sm font-bold uppercase tracking-widest text-tertiary mb-4">Connected ({connectors.length})</h3>
          {connectors.length === 0 && (
            <p class="text-sm text-tertiary text-center py-8 border border-outline-variant/10 rounded-2xl">No connectors configured yet. Add one below.</p>
          )}
          <div class="space-y-2">
            {connectors.map((c: any) => {
              const meta = getConnectorMeta(c.connector_type);
              return (
                <div key={c.id} class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 flex items-center justify-between">
                  <div>
                    <p class="font-bold text-sm capitalize">{c.connector_type}</p>
                    <p class="text-xs text-tertiary">
                      {c.last_sync_at ? `Last sync: ${new Date(c.last_sync_at).toLocaleDateString()}` : "Not synced yet"}
                    </p>
                  </div>
                  <span class={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${c.status === "active" ? "bg-green-500/10 text-green-400" : "bg-surface-container-high text-tertiary"}`}>
                    {c.status}
                  </span>
                  <Form action={deleteAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" class="p-2 text-tertiary hover:text-red-400"><Trash2Icon class="w-4 h-4" /></button>
                  </Form>
                </div>
              );
            })}
          </div>
        </div>

        {/* Available connectors */}
        <div>
          <h3 class="text-sm font-bold uppercase tracking-widest text-tertiary mb-4">Available Integrations</h3>
          <div class="grid gap-3">
            {AVAILABLE.map((type) => {
              const meta = getConnectorMeta(type);
              const isConnected = connectors.some((c: any) => c.connector_type === type);
              return (
                <div key={type} class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 flex items-center justify-between">
                  <div>
                    <h4 class="font-bold capitalize">{meta.name}</h4>
                    <p class="text-sm text-tertiary">{meta.description}</p>
                  </div>
                  {isConnected ? (
                    <span class="text-xs text-green-400 font-bold uppercase tracking-widest">Connected ✓</span>
                  ) : (
                    <a href={meta.setupUrl || "#"} target="_blank" rel="noreferrer" class="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/20">
                      <PlugIcon class="w-4 h-4" /> Connect <ExternalLinkIcon class="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = buildSeoHead({
  title: "Connectors | TelloDB",
  description: "Connect Slack, GitHub, Notion, Gmail, and Google Drive to auto-ingest data into your TelloDB cluster.",
  pathname: "/platform/clusters/[id]/connectors",
  noindex: true
});
