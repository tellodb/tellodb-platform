import type { RequestHandler } from "@builder.io/qwik-city";
import { getAdminSupabaseClient } from "~/lib/supabase";
import { requireAuth } from "~/lib/auth";
import { captureError } from "~/lib/sentry";

export const onPost: RequestHandler = async (event) => {
  const user = requireAuth(event);
  const clusterId = event.params.id;
  const supabase = getAdminSupabaseClient(event.env);
  if (!supabase) throw event.error(500, "Database connection offline");

  const { data: cluster, error } = await supabase
    .from("clusters")
    .select("id, user_id, tier, region, status, storage_gb")
    .eq("id", clusterId)
    .single();

  if (error || !cluster) throw event.error(404, "Cluster not found");
  if (cluster.user_id !== user.user_id) throw event.error(403, "Forbidden");
  if (cluster.status === "active") throw event.error(400, "Cluster is already active");

  const vmSizeMap: Record<string, string> = {
    azure_micro: "Standard_B2als_v2",
    azure_standard: "Standard_D2as_v5",
    azure_pro: "Standard_D4as_v5",
    azure_scale: "Standard_D8as_v5",
    azure_gpu: "Standard_NC4as_T4",
  };

  const tier = cluster.tier || "azure_standard";
  const vmSize = vmSizeMap[tier] || "Standard_D2s_v5";
  const storageGb = cluster.storage_gb || 50;
  const region = cluster.region === "shared" ? "westus2" : (cluster.region || "westus2");

  let body: { region?: string; vmSize?: string } = {};
  try {
    body = (await event.parseBody()) as { region?: string; vmSize?: string } | null || {};
  } catch (e: any) {
    captureError(e, { action: "provisionCluster", context: "parseBody" });
  }

  const finalRegion = body.region || region;
  const finalVmSize = body.vmSize || vmSize;

  await supabase.from("clusters").update({
    status: "provisioning",
    region: finalRegion,
  }).eq("id", clusterId);

  const supabaseUrl = (import.meta.env.PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const functionUrl = `${supabaseUrl}/functions/v1/provision-vm`;

  try {
    const fnRes = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: event.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      },
      body: JSON.stringify({
        clusterId,
        tier,
        region: finalRegion,
        vmSize: finalVmSize,
        storageGb,
      }),
    });

    const fnResult = await fnRes.json();

    if (fnResult.submitted) {
      await supabase.from("clusters").update({
        tier,
        storage_gb: storageGb,
        region: finalRegion,
      }).eq("id", clusterId);
      event.json(200, { success: true, message: `Provisioning submitted in ${finalRegion}`, region: finalRegion });
    } else {
      await supabase.from("clusters").update({
        status: "failed",
        tier,
        storage_gb: storageGb,
      }).eq("id", clusterId);
      event.json(200, { success: false, error: fnResult.error || "Provisioning failed" });
    }
  } catch (fnErr: any) {
    captureError(fnErr, { action: "provisionCluster", context: "edgeFunction" });
    await supabase.from("clusters").update({
      status: "failed",
    }).eq("id", clusterId);
    event.json(500, { success: false, error: fnErr.message || "Edge function call failed" });
  }
};
