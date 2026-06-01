import type { RequestHandler } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { captureError } from "~/lib/sentry";

export const onPost: RequestHandler = async (event) => {
  const clusterId = event.params.id;

  try {
    let body;
    try {
      body = (await event.parseBody()) as { ip_address?: string } | null;
    } catch (e: any) {
      captureError(e, { action: "activateCluster", context: "parseBody" });
      throw event.error(400, "Invalid JSON payload");
    }

    const ipAddress = body?.ip_address;
    if (!ipAddress) {
      throw event.error(400, "Missing ip_address in request body");
    }

    // Verify the admin key to prevent unauthorized activations
    const adminKey = event.request.headers.get("x-admin-key");
    const expectedKey = event.env.get("TELLODB_ADMIN_KEY") || "82a2cd542b86763b5941fba04db9802928c53a27256fcccb64e12f414f69826a";

    if (adminKey !== expectedKey) {
      throw event.error(401, "Unauthorized - Invalid admin key");
    }

    const supabase = getAdminSupabaseClient(event.env);
    if (!supabase) throw event.error(500, "Database connection offline");

    // Update the cluster status to active and set its endpoint_url pointing to the newly running VM IP
    const { data, error } = await supabase
      .from("clusters")
      .update({
        status: "active",
        endpoint_url: `http://${ipAddress}:3000`,
      })
      .eq("id", clusterId)
      .select();

    if (error || !data || data.length === 0) {
      console.error("Failed to activate cluster:", error);
      throw event.error(500, "Failed to update cluster status");
    }

    event.json(200, { success: true, message: "Cluster successfully activated" });
  } catch (e: any) {
    if (e?.headers?.location) throw e;
    captureError(e, { action: "activateCluster" });
    throw e;
  }
};
