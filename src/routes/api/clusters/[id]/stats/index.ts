import type { RequestHandler } from "@builder.io/qwik-city";
import { getCoreClusterStats } from "~/lib/tellodb-core";
import { getCurrentUser } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const clusterId = event.params.id;
    if (!clusterId) throw event.error(400, "Cluster ID required");

    // Verify cluster ownership before returning stats
    const supabase = getAdminSupabaseClient(event.env);
    const { data: cluster, error } = await supabase
      .from("clusters")
      .select("*")
      .eq("id", clusterId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw event.error(500, `Database error: ${error.message}`);
    }
    if (!cluster) {
      throw event.error(404, `Forbidden - Cluster ${clusterId} not found`);
    }

    if (cluster.user_id !== user.user_id) {
      throw event.error(403, `Forbidden - Owner mismatch (owner: ${cluster.user_id}, user: ${user.user_id})`);
    }

    const stats = await getCoreClusterStats(clusterId, cluster.endpoint_url, cluster.engine_key);
    if (!stats) {
      throw event.error(503, "Failed to contact engine");
    }

    event.json(200, stats);
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "clusterStats", clusterId: event.params.id });
    throw e;
  }
};
