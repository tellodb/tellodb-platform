import type { RequestHandler } from "@builder.io/qwik-city";
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
    const { data: cluster } = await supabase
      .from("clusters")
      .select("id, user_id, status, endpoint_url, region, tier")
      .eq("id", clusterId)
      .single();

    if (!cluster) throw event.error(404, "Not found");
    if (cluster.user_id !== user.user_id) throw event.error(403, "Forbidden");

    event.json(200, { id: cluster.id, status: cluster.status, endpoint_url: cluster.endpoint_url, region: cluster.region, tier: cluster.tier });
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "clusterStatus", clusterId: event.params.id });
    throw e;
  }
};
