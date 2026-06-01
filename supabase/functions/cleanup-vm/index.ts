import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

async function reportError(error: Error | unknown, context: Record<string, unknown> = {}) {
  const dsn = Deno.env.get("SENTRY_DSN") || "";
  if (!dsn) { console.error("[sentry]", error, context); return; }
  const projectId = dsn.split("/").pop();
  const host = new URL(dsn).host;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const payload = { event_id: eventId, timestamp: Date.now() / 1000, level: "error", platform: "deno", exception: { values: [{ type: err.name, value: err.message }] }, extra: context, tags: { environment: "edge" } };
    const envelope = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn }) + "\n" + JSON.stringify({ type: "event", content_type: "application/json", length: JSON.stringify(payload).length }) + "\n" + JSON.stringify(payload);
    await fetch(`https://${host}/api/${projectId}/envelope/`, { method: "POST", body: envelope, signal: AbortSignal.timeout(3000) });
  } catch {}
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let clusterId = "";
  let region = "";
  try {
    const body = await req.json();
    clusterId = body.clusterId;
    region = body.region;

    if (!clusterId || !region) {
      return new Response(JSON.stringify({ error: "Missing clusterId or region" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("AZURE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET") || "";
    const tenantId = Deno.env.get("AZURE_TENANT_ID") || "";
    const subscriptionId = Deno.env.get("AZURE_SUBSCRIPTION_ID") || "";

    if (!clientId || !clientSecret || !tenantId || !subscriptionId) {
      return new Response(JSON.stringify({ error: "Azure credentials not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://management.azure.com/.default",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!authRes.ok) {
      const oauthError = new Error(`Azure OAuth failed: ${await authRes.text()}`);
      reportError(oauthError, { step: "azure_oauth", clusterId, region });
      throw oauthError;
    }
    const { access_token: token } = await authRes.json();

    const vmName = `tellodb-vm-${clusterId.slice(0, 8)}`;
    const nicName = `${vmName}-nic`;
    const publicIpName = `${vmName}-pip`;
    const nsgName = `${vmName}-nsg`;
    const vnetName = `${vmName}-vnet`;
    const osDiskName = `${vmName}-osdisk`;
    const dataDiskName = `${vmName}-datadisk`;
    const rgName = `tellodb-rg-${region}`;
    const deploymentName = `tellodb-vm-deploy-${clusterId}`;

    const apiBase = `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups/${rgName}`;

    async function deleteResource(type: string, name: string, ver: string): Promise<string> {
      for (let attempt = 0; attempt < 3; attempt++) {
        const url = `${apiBase}/providers/${type}/${name}?api-version=${ver}`;
        const res = await fetch(url, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) return `${name}: already-gone`;
        if (res.ok || res.status === 202) return `${name}: deleted`;
        if (attempt < 2) await delay(3000);
      }
      return `${name}: failed`;
    }

    // 1. Delete VM (must complete before deleting NIC/disks)
    const vmResult = await deleteResource("Microsoft.Compute/virtualMachines", vmName, "2023-09-01");
    await delay(5000);

    // 2. Disks (can be deleted after VM is gone)
    const diskResults = [
      await deleteResource("Microsoft.Compute/disks", osDiskName, "2023-09-01"),
      await deleteResource("Microsoft.Compute/disks", dataDiskName, "2023-09-01"),
    ];

    // 3. NIC (requires VM gone)
    await delay(3000);
    const nicResult = await deleteResource("Microsoft.Network/networkInterfaces", nicName, "2023-09-01");

    // 4. Public IP (requires NIC gone)
    const pipResult = await deleteResource("Microsoft.Network/publicIPAddresses", publicIpName, "2023-09-01");

    // 5. NSG and VNet (best-effort, may be shared)
    const nsgResult = await deleteResource("Microsoft.Network/networkSecurityGroups", nsgName, "2023-09-01");
    const vnetResult = await deleteResource("Microsoft.Network/virtualNetworks", vnetName, "2023-09-01");

    // 6. Deployment record
    const deployResult = await deleteResource("Microsoft.Resources/deployments", deploymentName, "2021-04-01");

    return new Response(JSON.stringify({
      deleted: true,
      results: [vmResult, ...diskResults, nicResult, pipResult, nsgResult, vnetResult, deployResult],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    reportError(err, { step: "top_level", clusterId, region });
    console.error(`[cleanup-vm] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});