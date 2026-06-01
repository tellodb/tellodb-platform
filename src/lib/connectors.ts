import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "./supabase";
import { getCurrentUser } from "./auth";
import { captureError } from "./sentry";

export interface ConnectorConfig {
  id: string;
  cluster_id: string;
  connector_type: string;
  credentials: Record<string, string>;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  status: string;
}

const CONNECTOR_META: Record<string, { name: string; icon: string; description: string; setupUrl: string }> = {
  slack: { name: "Slack", icon: "MessageSquare", description: "Ingest channel messages and threads as conversation memories.", setupUrl: "https://slack.com/oauth/v2/authorize" },
  github: { name: "GitHub", icon: "GitBranch", description: "Ingest issues, PRs, and commits as decision and fact memories.", setupUrl: "https://github.com/apps/tellodb-platform/installations/new" },
  notion: { name: "Notion", icon: "FileText", description: "Ingest pages and databases as fact memories.", setupUrl: "" },
  gmail: { name: "Gmail", icon: "Mail", description: "Ingest emails and threads.", setupUrl: "" },
  gdrive: { name: "Google Drive", icon: "HardDrive", description: "Ingest documents.", setupUrl: "" },
};

export function getConnectorMeta(type: string) { return CONNECTOR_META[type] || { name: type, icon: "Plug", description: "", setupUrl: "" }; }

export async function getConnectors(event: RequestEventCommon, clusterId: string): Promise<ConnectorConfig[]> {
  const supabase = getAdminSupabaseClient(event.env);
  try {
    const { data } = await supabase.from("connector_configs").select("*").eq("cluster_id", clusterId);
    return (data || []) as any;
  } catch (e) {
    captureError(e, { action: "getConnectors", clusterId });
    return [];
  }
}

export async function createConnector(event: RequestEventCommon, clusterId: string, type: string, credentials: Record<string, string>): Promise<ConnectorConfig | null> {
  const supabase = getAdminSupabaseClient(event.env);
  try {
    const { data, error } = await supabase.from("connector_configs").insert({ cluster_id: clusterId, connector_type: type, credentials }).select().single();
    if (error) return null;
    return data as any;
  } catch (e) {
    captureError(e, { action: "createConnector", clusterId, type });
    return null;
  }
}

export async function deleteConnector(event: RequestEventCommon, connectorId: string): Promise<boolean> {
  const supabase = getAdminSupabaseClient(event.env);
  try {
    const { error } = await supabase.from("connector_configs").delete().eq("id", connectorId);
    return !error;
  } catch (e) {
    captureError(e, { action: "deleteConnector", connectorId });
    return false;
  }
}
