import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "./supabase";
import { getCurrentUser } from "./auth";
import { captureError } from "./sentry";

export interface ContextTemplate {
  id: string;
  cluster_id: string;
  name: string;
  template: string;
  is_default: boolean;
  created_at: string;
}

export async function getContextTemplates(event: RequestEventCommon, clusterId: string): Promise<ContextTemplate[]> {
  const user = getCurrentUser(event.cookie);
  if (!user) return [];
  const supabase = getAdminSupabaseClient(event.env);
  try {
    const { data } = await supabase.from("context_templates").select("*").eq("cluster_id", clusterId).order("created_at", { ascending: true });
    return (data || []) as any;
  } catch (e) {
    captureError(e, { action: "getContextTemplates", clusterId });
    return [];
  }
}

export async function createContextTemplate(event: RequestEventCommon, clusterId: string, name: string, template: string): Promise<ContextTemplate | null> {
  const user = getCurrentUser(event.cookie);
  if (!user) return null;
  const supabase = getAdminSupabaseClient(event.env);
  try {
    const { data, error } = await supabase.from("context_templates").insert({ cluster_id: clusterId, user_id: user.user_id, name, template }).select().single();
    if (error) return null;
    return data as any;
  } catch (e) {
    captureError(e, { action: "createContextTemplate", clusterId, name });
    return null;
  }
}

export async function deleteContextTemplate(event: RequestEventCommon, templateId: string): Promise<boolean> {
  const supabase = getAdminSupabaseClient(event.env);
  try {
    const { error } = await supabase.from("context_templates").delete().eq("id", templateId);
    return !error;
  } catch (e) {
    captureError(e, { action: "deleteContextTemplate", templateId });
    return false;
  }
}

const MARKER_REGEX = /%\{(\w+)(?:\s+([^}]*))?\}/g;

interface MarkerHandler {
  (params: Record<string, string>, context: AssembleContext): Promise<string>;
}

interface AssembleContext {
  clusterId: string;
  query?: string;
  event: RequestEventCommon;
}

export const defaultMarkers: Record<string, MarkerHandler> = {
  facts: async (params, ctx) => {
    const limit = parseInt(params.limit || "10");
    try {
      const res = await fetch(`${getCoreUrl()}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": getAdminKey() },
        body: JSON.stringify({ textual_query: ctx.query || "recent important facts", limit, entity_id: ctx.clusterId }),
      });
      if (!res.ok) return "[No facts available]";
      const data = await res.json();
      if (!data?.length) return "[No facts available]";
      return data.map((d: any, i: number) => `${i + 1}. ${d.textual_content || d.memory_id}`).join("\n");
    } catch { return "[Error loading facts]"; }
  },
  user_summary: async (_, ctx) => {
    try {
      const res = await fetch(`${getCoreUrl()}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": getAdminKey() },
        body: JSON.stringify({ textual_query: "user profile preferences traits", limit: 15, entity_id: ctx.clusterId }),
      });
      if (!res.ok) return "[No user profile available]";
      const data = await res.json();
      if (!data?.length) return "[No user profile available]";
      return data.map((d: any) => `- ${d.textual_content}`).join("\n");
    } catch { return "[Error loading user profile]"; }
  },
  graph_neighbors: async (params, ctx) => {
    const n = parseInt(params.n || "5");
    return `[Graph neighbors: ${n} entities connected]`;
  },
  temporal_range: async (params, ctx) => {
    const days = parseInt(params.days || "7");
    return `[Memories from the last ${days} days]`;
  },
  related_entities: async (_, ctx) => {
    return `[Connected entities from knowledge graph]`;
  },
};

function getCoreUrl() {
  return (import.meta.env.TELLODB_URL || "http://localhost:3000").replace(/\/+$/, "");
}
function getAdminKey() {
  return import.meta.env.TELLODB_ADMIN_KEY || "82a2cd542b86763b5941fba04db9802928c53a27256fcccb64e12f414f69826a";
}

export async function assembleContext(template: string, ctx: AssembleContext): Promise<string> {
  const markers = new Map<string, string>();

  const matches = Array.from(template.matchAll(MARKER_REGEX));
  for (const match of matches) {
    const key = match[0];
    if (markers.has(key)) continue;
    const handler = defaultMarkers[match[1]];
    if (!handler) { markers.set(key, `[Unknown marker: ${match[1]}]`); continue; }
    const params: Record<string, string> = {};
    if (match[2]) {
      match[2].split(/\s+/).forEach((p) => {
        const [k, v] = p.split("=");
        if (k) params[k] = v || "true";
      });
    }
    try {
      markers.set(key, await handler(params, ctx));
    } catch {
      markers.set(key, `[Error processing: ${match[1]}]`);
    }
  }

  let result = template;
  for (const [key, value] of markers) {
    result = result.replaceAll(key, value);
  }
  return result;
}
