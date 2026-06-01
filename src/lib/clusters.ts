import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "./supabase";
import { getCurrentUser } from "./auth";
import { captureError } from "./sentry";

export interface Cluster {
  id: string;
  name: string;
  tier: "fractional" | "dedicated_l4" | "dedicated_t4" | "self_hosted" | string;
  status: "provisioning" | "active" | "suspended" | "deleted" | "failed";
  endpoint_url: string;
  region: string;
  created_at_ms: number;
  engine_key?: string;
}

export async function getClusters(
  event: RequestEventCommon,
): Promise<Cluster[]> {
  const user = getCurrentUser(event.cookie);
  if (!user) return [];

  const supabase = getAdminSupabaseClient(event.env);
  const { data, error } = await supabase
    .from("clusters")
    .select("*")
    .neq("status", "deleted")
    .eq("user_id", user.user_id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: d.id,
    name: d.name,
    tier: d.tier,
    status: d.status,
    endpoint_url: d.endpoint_url,
    region: d.region,
    engine_key: d.engine_key,
    created_at_ms: new Date(d.created_at).getTime(),
  }));
}

export async function createCluster(
  event: RequestEventCommon,
  name: string,
  tier: string,
): Promise<Cluster | null> {
  const user = getCurrentUser(event.cookie);
  if (!user) return null;

  const supabase = getAdminSupabaseClient(event.env);

  // For now endpoint_url is always pointing to the Qwik proxy
  const platformUrl =
    import.meta.env.PUBLIC_PLATFORM_URL || "https://tellodb.com";
  const endpoint_url = `${platformUrl}/api`;

  const { data, error } = await supabase
    .from("clusters")
    .insert({
      user_id: user.user_id,
      name,
      tier,
      endpoint_url,
      region: "shared",
    })
    .select()
    .single();

  if (error || !data) {
    captureError(error || new Error("Cluster operation failed"), {
      action: "createCluster",
      name,
      tier,
    });
    console.error("Create cluster error:", error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    tier: data.tier,
    status: data.status,
    endpoint_url: data.endpoint_url,
    region: data.region,
    engine_key: data.engine_key,
    created_at_ms: new Date(data.created_at).getTime(),
  };
}

export async function connectCluster(
  event: RequestEventCommon,
  name: string,
  endpointUrl: string,
  engineKey: string,
): Promise<Cluster | null> {
  const user = getCurrentUser(event.cookie);
  if (!user) return null;

  const supabase = getAdminSupabaseClient(event.env);

  const { data, error } = await supabase
    .from("clusters")
    .insert({
      user_id: user.user_id,
      name,
      tier: "self_hosted",
      endpoint_url: endpointUrl.replace(/\/+$/, ""),
      engine_key: engineKey,
      region: "external",
      status: "active",
    })
    .select()
    .single();

  if (error || !data) {
    captureError(error || new Error("Cluster operation failed"), {
      action: "connectCluster",
      name,
    });
    console.error("Connect cluster error:", error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    tier: data.tier,
    status: data.status,
    endpoint_url: data.endpoint_url,
    region: data.region,
    engine_key: data.engine_key,
    created_at_ms: new Date(data.created_at).getTime(),
  };
}
