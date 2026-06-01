import type { RequestHandler } from "@builder.io/qwik-city";
import { getStorageStats } from "~/lib/tellodb-core";
import { getCurrentUser } from "~/lib/auth";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";

export const onGet: RequestHandler = async (event) => {
  const user = getCurrentUser(event.cookie);
  if (!user) throw event.error(401, "Unauthorized");

  try {
    const clusterId = event.params.id;
    if (!clusterId) throw event.error(400, "Cluster ID required");

    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database offline");

    const { data: cluster, error } = await supabase
      .from("clusters")
      .select("*")
      .eq("id", clusterId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw event.error(500, `Database error: ${error.message}`);
    }
    if (!cluster) throw event.error(404, `Cluster ${clusterId} not found`);
    if (cluster.user_id !== user.user_id) throw event.error(403, "Forbidden - owner mismatch");

    const isShared = cluster.tier === "fractional";

    if (isShared) {
      // Shared server: admin endpoint returns global stats, not user-scoped
      // Return empty with a flag so the frontend can show the right message
      event.json(200, { shared: true, tables: {} });
    } else {
      // Dedicated cluster: use admin endpoint with cluster's engine key
      const stats = await getStorageStats(clusterId, cluster.endpoint_url, cluster.engine_key);
      event.json(200, stats || { shared: false, tables: {} });
    }
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    if (e?.status) throw e;
    captureError(e, { action: "clusterStorageStats", clusterId: event.params.id });
    throw event.error(500, "Internal error");
  }
};
