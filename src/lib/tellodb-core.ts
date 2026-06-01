import { captureError } from "./sentry";

export function getTellodbCoreUrl(): string {
  return (import.meta.env.TELLODB_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function getAdminKey(): string {
  return import.meta.env.TELLODB_ADMIN_KEY || "82a2cd542b86763b5941fba04db9802928c53a27256fcccb64e12f414f69826a";
}

export interface CoreClusterStats {
  memory_count: number;
  entity_count: number;
  fact_count: number;
  storage_bytes: number;
  request_count?: number;
  ingest_count?: number;
  query_count?: number;
}

export async function provisionCluster(clusterId: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getTellodbCoreUrl()}/admin/clusters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": getAdminKey() },
      body: JSON.stringify({ cluster_id: clusterId, user_id: userId }),
    });
    return res.ok;
  } catch (e) {
    captureError(e, { action: "provisionCluster", clusterId });
    return false;
  }
}

export async function deprovisionCluster(clusterId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getTellodbCoreUrl()}/admin/clusters/${encodeURIComponent(clusterId)}`, {
      method: "DELETE",
      headers: { "x-api-key": getAdminKey() },
    });
    return res.ok;
  } catch (e) {
    captureError(e, { action: "deprovisionCluster", clusterId });
    return false;
  }
}

export async function getCoreClusterStats(
  clusterId: string,
  endpointUrl?: string,
  engineKey?: string
): Promise<CoreClusterStats | null> {
  try {
    const url = endpointUrl ? endpointUrl.replace(/\/+$/, "") : getTellodbCoreUrl();
    const key = engineKey || getAdminKey();
    
    const res = await fetch(
      `${url}/admin/clusters/${encodeURIComponent(clusterId)}/stats`,
      { headers: { "x-api-key": key } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    captureError(e, { action: "getCoreClusterStats", clusterId });
    return null;
  }
}

export interface HardwareStats {
  cpu_usage_percent: number;
  ram_total_mb: number;
  ram_used_mb: number;
  storage_total_gb: number;
  storage_used_gb: number;
  gpu_usage_percent: number | null;
  gpu_ram_total_mb: number | null;
  gpu_ram_used_mb: number | null;
}

export async function getHardwareStats(
  endpointUrl?: string,
  engineKey?: string
): Promise<HardwareStats | null> {
  try {
    const url = endpointUrl ? endpointUrl.replace(/\/+$/, "") : getTellodbCoreUrl();
    const key = engineKey || getAdminKey();
    
    const res = await fetch(
      `${url}/admin/stats/hardware`,
      { headers: { "x-api-key": key } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    captureError(e, { action: "getHardwareStats" });
    return null;
  }
}

export interface StorageStats {
  memory_card_count: number;
  edge_count: number;
  memory_count: number;
  metric_count: number;
  ledger_turn_count: number;
  memory_artifact_count: number;
  temporal_event_count: number;
  shadow_question_count: number;
  facet_posting_count: number;
  mem_cell_count: number;
  mem_scene_count: number;
  profile_fact_count: number;
  session_router_count: number;
  fact_version_count: number;
  card_relation_count: number;
  memory_link_count: number;
  alias_count: number;
  preference_count: number;
  core_profile_count: number;
  deletion_tombstone_count: number;
  storage_bytes: number;
}

export async function getStorageStats(
  clusterId: string,
  endpointUrl?: string,
  engineKey?: string
): Promise<StorageStats | null> {
  try {
    const url = endpointUrl ? endpointUrl.replace(/\/+$/, "") : getTellodbCoreUrl();
    const key = engineKey || getAdminKey();
    const res = await fetch(
      `${url}/admin/clusters/${encodeURIComponent(clusterId)}/storage-stats`,
      { headers: { "x-api-key": key } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    captureError(e, { action: "getStorageStats", clusterId });
    return null;
  }
}

export interface GraphEdge {
  edge_id: string;
  source: string;
  target: string;
  edge_type: string;
  label: string;
  weight: number;
  timestamp_ms: number;
  memory_id: string;
}

export async function getGraphEdges(
  clusterId: string,
  endpointUrl?: string,
  engineKey?: string
): Promise<GraphEdge[] | null> {
  try {
    const url = endpointUrl ? endpointUrl.replace(/\/+$/, "") : getTellodbCoreUrl();
    const key = engineKey || getAdminKey();
    const res = await fetch(
      `${url}/admin/clusters/${encodeURIComponent(clusterId)}/graph-edges`,
      { headers: { "x-api-key": key } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    captureError(e, { action: "getGraphEdges", clusterId });
    return null;
  }
}


