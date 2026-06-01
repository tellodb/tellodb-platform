import type { RequestHandler } from "@builder.io/qwik-city";
import { getHardwareStats } from "~/lib/tellodb-core";
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
    const { data: cluster } = await supabase
      .from("clusters")
      .select("user_id, endpoint_url")
      .eq("id", clusterId)
      .single();

    if (!cluster) {
      throw event.error(403, `Forbidden - Cluster ${clusterId} not found`);
    }

    if (cluster.user_id !== user.user_id) {
      throw event.error(403, `Forbidden - Owner mismatch (owner: ${cluster.user_id}, user: ${user.user_id})`);
    }

    const hardware = await getHardwareStats(cluster.endpoint_url, cluster.engine_key);
    if (!hardware) {
      throw event.error(503, "Failed to contact engine");
    }

    event.json(200, hardware);
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "clusterHardware", clusterId: event.params.id });
    throw e;
  }
};
