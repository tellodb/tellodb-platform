import type { RequestHandler } from "@builder.io/qwik-city";
import { getClusterUsage } from "~/lib/usage";
import { getCurrentUser } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const clusterId = event.params.id;
    if (!clusterId) throw event.error(400, "Cluster ID required");

    // Verify cluster ownership before returning usage
    const supabase = getAdminSupabaseClient(event.env);
    const { data: cluster } = await supabase
      .from("clusters")
      .select("user_id")
      .eq("id", clusterId)
      .single();

    if (!cluster || cluster.user_id !== user.user_id) {
      throw event.error(403, "Forbidden");
    }

    const usage = await getClusterUsage(event, clusterId);
    event.json(200, usage || { daily: [], totals: { request_count: 0, ingest_count: 0, query_count: 0, graph_ops: 0 } });
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "clusterUsage", clusterId: event.params.id });
    throw e;
  }
};
