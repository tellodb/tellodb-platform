import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "./supabase";
import { getCurrentUser } from "./auth";
import { captureError } from "./sentry";

export const DEFAULT_TEST_API_KEY = "82a2cd542b86763b5941fba04db9802928c53a27256fcccb64e12f414f69826a";

export interface ApiKey {
  key_id: string;
  name: string;
  key_prefix: string;
  created_at_ms: number;
  last_used_ms: number | null;
  disabled: boolean;
  token?: string; // Only returned on creation
}

export interface UsageStats {
    request_count: number;
    ingest_count: number;
    query_count: number;
    temporal_query_count: number;
    last_request_ms: number | null;
}

export async function getApiKeys(event: RequestEventCommon): Promise<ApiKey[]> {
  try {
    const user = getCurrentUser(event.cookie);
    if (!user) return [];

    const supabase = getAdminSupabaseClient(event.env);
    const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((d: any) => ({
        key_id: d.id,
        name: d.name,
        key_prefix: d.key_value.substring(0, 8),
        created_at_ms: new Date(d.created_at).getTime(),
        last_used_ms: d.last_used_at ? new Date(d.last_used_at).getTime() : null,
        disabled: !d.is_active,
        token: d.key_value // Add the full token here
    }));
  } catch (e) {
    captureError(e, { action: "getApiKeys" });
    return [];
  }
}

export interface ApiKeyCreateResult {
  key: ApiKey;
  engineSynced: boolean;
  engineError?: string;
}

async function safeReadText(res: Response, timeoutMs = 2000): Promise<string> {
  return new Promise<string>((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve("[Response body reading timed out]");
      }
    }, timeoutMs);

    res.text().then(
      (text) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(text);
        }
      },
      (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(`[Failed to read response body: ${err.message}]`);
        }
      }
    );
  });
}

export async function createApiKey(event: RequestEventCommon, name: string, clusterId?: string): Promise<ApiKeyCreateResult | null> {
  try {
    const user = getCurrentUser(event.cookie);
    if (!user) {
      console.log("[createApiKey] getCurrentUser returned null");
      return null;
    }
    console.log("[createApiKey] starting key creation for user:", user.user_id, "name:", name, "clusterId:", clusterId);

    const supabase = getAdminSupabaseClient(event.env);
    const rawKey = `tellodb-sk-${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

    console.log("[createApiKey] inserting key in DB...");
    const { data, error } = await supabase
        .from("api_keys")
        .insert({
            user_id: user.user_id,
            name,
            key_value: rawKey,
            cluster_id: clusterId || null
        })
        .select()
        .single();

    if (error || !data) {
        console.error("[createApiKey] Supabase API Key Creation Error", error);
        return null;
    }
    console.log("[createApiKey] key inserted successfully in DB, id:", data.id);

    let engineSynced = false;
    let engineError: string | undefined;

    if (clusterId) {
      console.log("[createApiKey] fetching cluster info for engine sync...");
      const { data: cluster } = await supabase
          .from("clusters")
          .select("endpoint_url, engine_key")
          .eq("id", clusterId)
          .maybeSingle();

      if (cluster && cluster.engine_key) {
        try {
          console.log("[createApiKey] injecting key to custom cluster engine at:", cluster.endpoint_url);
          const res = await fetch(`${cluster.endpoint_url.replace(/\/+$/, "")}/admin/api_keys`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": cluster.engine_key,
            },
            body: JSON.stringify({
              key_id: data.id,
              user_id: user.user_id,
              name,
              token: rawKey,
              cluster_id: clusterId,
            }),
            signal: AbortSignal.timeout(5000),
          });
          console.log("[createApiKey] custom cluster engine injection status:", res.status);
          if (res.ok) {
            engineSynced = true;
          } else {
            engineError = `Engine returned ${res.status}`;
            const errorBody = await safeReadText(res, 2000);
            console.error(`Failed to inject key to custom cluster ${clusterId}: ${res.status} ${errorBody}`);
          }
        } catch (injectErr: any) {
          engineError = `Connection failed: ${injectErr.message}`;
          console.error(`Failed to connect to cluster ${clusterId} for key injection:`, injectErr.message);
        }
      } else {
        engineError = "Cluster engine_key not found";
        console.warn("[createApiKey] Cluster engine_key not found for clusterId:", clusterId);
      }
    } else {
      const engineUrl = (event.env.get("TELLODB_URL") || process.env.TELLODB_URL || "").replace(/\/+$/, "");
      const engineKey = event.env.get("TELLODB_ADMIN_KEY") || event.env.get("TELLODB_API_KEY") || process.env.TELLODB_ADMIN_KEY || "";
      console.log("[createApiKey] global key engine sync, url:", engineUrl, "hasKey:", !!engineKey);

      if (!engineUrl || !engineKey) {
        engineError = "TELLODB_URL or TELLODB_ADMIN_KEY not configured";
        console.error("Engine injection skipped: missing env vars", { hasUrl: !!engineUrl, hasKey: !!engineKey });
      } else {
        try {
          console.log("[createApiKey] injecting key to shared engine at:", engineUrl);
          const res = await fetch(`${engineUrl}/admin/api_keys`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": engineKey,
            },
            body: JSON.stringify({
              key_id: data.id,
              user_id: user.user_id,
              name,
              token: rawKey,
              cluster_id: null,
            }),
            signal: AbortSignal.timeout(5000),
          });
          console.log("[createApiKey] shared engine injection status:", res.status);
          if (res.ok) {
            engineSynced = true;
          } else {
            engineError = `Engine returned ${res.status}`;
            const errorBody = await safeReadText(res, 2000);
            console.error(`Failed to inject key to shared engine: ${res.status} ${errorBody}`);
          }
        } catch (injectErr: any) {
          engineError = `Connection failed: ${injectErr.message}`;
          console.error(`Failed to connect to shared engine for key injection:`, injectErr.message);
        }
      }
    }

    const result = {
      key: {
        key_id: data.id,
        name: data.name,
        key_prefix: data.key_value.substring(0, 8),
        created_at_ms: new Date(data.created_at).getTime(),
        last_used_ms: null,
        disabled: !data.is_active,
        token: rawKey
      },
      engineSynced,
      engineError
    };
    console.log("[createApiKey] success, returning key_id:", result.key.key_id);
    return result;
  } catch (e) {
    captureError(e, { action: "createApiKey", name });
    console.error("[createApiKey] caught fatal exception:", e);
    return null;
  }
}

export async function revokeApiKey(event: RequestEventCommon, keyId: string): Promise<boolean> {
  try {
    const user = getCurrentUser(event.cookie);
    if (!user) return false;

    const supabase = getAdminSupabaseClient(event.env);
    
    // Get cluster info for this key to revoke it from the custom server if needed
    const { data: keyInfo } = await supabase
        .from("api_keys")
        .select("cluster_id")
        .eq("id", keyId)
        .eq("user_id", user.user_id)
        .maybeSingle();

    const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("id", keyId)
        .eq("user_id", user.user_id);

    if (error) return false;

    if (keyInfo && keyInfo.cluster_id) {
      const { data: cluster } = await supabase
          .from("clusters")
          .select("endpoint_url, engine_key")
          .eq("id", keyInfo.cluster_id)
          .maybeSingle();

      if (cluster && cluster.engine_key) {
        try {
          const res = await fetch(`${cluster.endpoint_url.replace(/\/+$/, "")}/admin/api_keys/${encodeURIComponent(keyId)}`, {
            method: "DELETE",
            headers: {
              "x-api-key": cluster.engine_key,
            },
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) {
            console.error(`Failed to revoke key from custom cluster ${keyInfo.cluster_id}: ${res.status}`);
          }
        } catch (revokeErr: any) {
          console.error(`Failed to connect to cluster ${keyInfo.cluster_id} for key revocation:`, revokeErr.message);
        }
      }
    } else if (keyInfo && !keyInfo.cluster_id) {
      const engineUrl = (event.env.get("TELLODB_URL") || process.env.TELLODB_URL || "").replace(/\/+$/, "");
      const engineKey = event.env.get("TELLODB_ADMIN_KEY") || event.env.get("TELLODB_API_KEY") || process.env.TELLODB_ADMIN_KEY || "";

      if (engineUrl && engineKey) {
        try {
          const res = await fetch(`${engineUrl}/admin/api_keys/${encodeURIComponent(keyId)}`, {
            method: "DELETE",
            headers: {
              "x-api-key": engineKey,
            },
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) {
            console.error(`Failed to revoke key from shared engine: ${res.status}`);
          }
        } catch (revokeErr: any) {
          console.error(`Failed to connect to shared engine for key revocation:`, revokeErr.message);
        }
      }
    }

    return true;
  } catch (e) {
    captureError(e, { action: "revokeApiKey", keyId });
    return false;
  }
}


export async function getUsageStats(event: RequestEventCommon): Promise<UsageStats | null> {
  try {
    const user = getCurrentUser(event.cookie);
    if (!user) return null;

    const supabase = getAdminSupabaseClient(event.env);

    // 1. Fetch all clusters for the user to get their IDs
    const { data: clusters, error: clustersErr } = await supabase
      .from("clusters")
      .select("id")
      .eq("user_id", user.user_id)
      .neq("status", "deleted");

    if (clustersErr || !clusters || clusters.length === 0) {
      return {
        request_count: 0,
        ingest_count: 0,
        query_count: 0,
        temporal_query_count: 0,
        last_request_ms: null
      };
    }

    const clusterIds = clusters.map(c => c.id);

    // 2. Fetch daily usage for all these clusters
    const { data: usageData, error: usageErr } = await supabase
      .from("usage_daily")
      .select("request_count, ingest_count, query_count, graph_ops, date")
      .in("cluster_id", clusterIds);

    if (usageErr || !usageData) {
      return {
        request_count: 0,
        ingest_count: 0,
        query_count: 0,
        temporal_query_count: 0,
        last_request_ms: null
      };
    }

    // 3. Aggregate usage and determine last active request date
    let latestActiveDateMs: number | null = null;
    const totals = usageData.reduce(
      (acc, d) => {
        if (d.request_count > 0 && d.date) {
          const t = new Date(d.date).getTime();
          if (latestActiveDateMs === null || t > latestActiveDateMs) {
            latestActiveDateMs = t;
          }
        }
        return {
          request_count: acc.request_count + (d.request_count || 0),
          ingest_count: acc.ingest_count + (d.ingest_count || 0),
          query_count: acc.query_count + (d.query_count || 0),
          temporal_query_count: acc.temporal_query_count + (d.graph_ops || 0),
        };
      },
      { request_count: 0, ingest_count: 0, query_count: 0, temporal_query_count: 0 }
    );

    return {
      ...totals,
      last_request_ms: latestActiveDateMs
    };
  } catch (e) {
    captureError(e, { action: "getUsageStats" });
    console.error("Error fetching usage stats:", e);
    return null;
  }
}
