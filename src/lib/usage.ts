import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "./supabase";
import { getCurrentUser } from "./auth";
import { captureError } from "./sentry";

export interface UsageStats {
  daily: {
    date: string;
    request_count: number;
    ingest_count: number;
    query_count: number;
    graph_ops: number;
    storage_bytes: number;
  }[];
  totals: {
    request_count: number;
    ingest_count: number;
    query_count: number;
    graph_ops: number;
  };
}

export async function getClusterUsage(
  event: RequestEventCommon,
  clusterId: string,
  days: number = 30
): Promise<UsageStats | null> {
  const user = getCurrentUser(event.cookie);
  if (!user) return null;
  const supabase = getAdminSupabaseClient(event.env);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  try {
    const { data } = await supabase
      .from("usage_daily")
      .select("*")
      .eq("cluster_id", clusterId)
      .gte("date", startDate)
      .order("date", { ascending: true });
    if (!data) return null;
    const totals = data.reduce(
      (acc, d: any) => ({
        request_count: acc.request_count + (d.request_count || 0),
        ingest_count: acc.ingest_count + (d.ingest_count || 0),
        query_count: acc.query_count + (d.query_count || 0),
        graph_ops: acc.graph_ops + (d.graph_ops || 0),
      }),
      { request_count: 0, ingest_count: 0, query_count: 0, graph_ops: 0 }
    );
    return { daily: data as any, totals };
  } catch (e) {
    captureError(e, { action: "getClusterUsage", clusterId });
    return null;
  }
}

export async function recordUsage(
  env: RequestEventCommon["env"],
  clusterId: string,
  stats: { requests?: number; ingests?: number; queries?: number; graph_ops?: number; storage_bytes?: number }
) {
  const supabase = getAdminSupabaseClient(env);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await supabase
      .from("usage_daily")
      .select("*")
      .eq("cluster_id", clusterId)
      .eq("date", today)
      .single();
    if (data) {
      await supabase
        .from("usage_daily")
        .update({
          request_count: data.request_count + (stats.requests || 0),
          ingest_count: data.ingest_count + (stats.ingests || 0),
          query_count: data.query_count + (stats.queries || 0),
          graph_ops: data.graph_ops + (stats.graph_ops || 0),
          storage_bytes: Math.max(data.storage_bytes, stats.storage_bytes || 0),
        })
        .eq("id", data.id);
    } else {
      await supabase.from("usage_daily").insert({
        cluster_id: clusterId,
        date: today,
        request_count: stats.requests || 0,
        ingest_count: stats.ingests || 0,
        query_count: stats.queries || 0,
        graph_ops: stats.graph_ops || 0,
        storage_bytes: stats.storage_bytes || 0,
      });
    }
  } catch (e) {
    captureError(e, { action: "recordUsage", clusterId });
  }
}
