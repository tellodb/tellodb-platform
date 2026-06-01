import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function reportError(
  error: Error | unknown,
  context: Record<string, unknown> = {},
) {
  const dsn = Deno.env.get("SENTRY_DSN") || "";
  if (!dsn) {
    console.error("[sentry]", error, context);
    return;
  }
  const projectId = dsn.split("/").pop();
  const host = new URL(dsn).host;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const payload = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      level: "error",
      platform: "deno",
      exception: { values: [{ type: err.name, value: err.message }] },
      extra: context,
      tags: { environment: "edge" },
    };
    const envelope =
      JSON.stringify({
        event_id: eventId,
        sent_at: new Date().toISOString(),
        dsn,
      }) +
      "\n" +
      JSON.stringify({
        type: "event",
        content_type: "application/json",
        length: JSON.stringify(payload).length,
      }) +
      "\n" +
      JSON.stringify(payload);
    await fetch(`https://${host}/api/${projectId}/envelope/`, {
      method: "POST",
      body: envelope,
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

interface ProvisionRequest {
  clusterId: string;
  tier: string;
  region: string;
  vmSize: string;
  storageGb: number;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let clusterId = "";
  let region = "";
  try {
    const body: ProvisionRequest = await req.json();
    const { tier, vmSize, storageGb } = body;
    clusterId = body.clusterId;
    region = body.region;
    console.log(
      `[provision-vm] start: clusterId=${clusterId} region=${region} vmSize=${vmSize}`,
    );

    if (!clusterId || !tier || !region || !vmSize) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get("AZURE_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET") || "";
    const tenantId = Deno.env.get("AZURE_TENANT_ID") || "";
    const subscriptionId = Deno.env.get("AZURE_SUBSCRIPTION_ID") || "";
    const adminKey = Deno.env.get("ALETHEIADB_ADMIN_KEY") || "";

    if (!clientId || !clientSecret || !tenantId || !subscriptionId) {
      await supabase
        .from("clusters")
        .update({ status: "failed" })
        .eq("id", clusterId);
      return new Response(
        JSON.stringify({ error: "Azure credentials not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log("[provision-vm] Authenticating with Azure AD...");
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const authRes = await fetch(authUrl, {
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
      const text = await authRes.text();
      const oauthError = new Error(
        `Azure OAuth failed (${authRes.status}): ${text}`,
      );
      reportError(oauthError, { step: "azure_oauth", clusterId, region });
      throw oauthError;
    }

    const { access_token: token } = await authRes.json();
    console.log("[provision-vm] Auth succeeded");

    const rgName = `tellodb-rg-${region}`;
    console.log(`[provision-vm] Creating resource group: ${rgName}...`);
    const rgUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups/${rgName}?api-version=2021-04-01`;
    const rgRes = await fetch(rgUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ location: region }),
    });

    if (!rgRes.ok) {
      const rgError = new Error(
        `Resource group creation failed: ${await rgRes.text()}`,
      );
      reportError(rgError, { step: "rg_creation", clusterId, region });
      throw rgError;
    }
    console.log("[provision-vm] Resource group ready");

    const vmName = `tellodb-vm-${clusterId.slice(0, 8)}`;
    const deploymentName = `tellodb-vm-deploy-${clusterId}`;
    const deployUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups/${rgName}/providers/Microsoft.Resources/deployments/${deploymentName}?api-version=2021-04-01`;

    const platformUrl = "https://tellodb.com";
    const armTemplate = buildARMTemplate(
      clusterId,
      vmName,
      vmSize,
      storageGb,
      region,
      adminKey,
      platformUrl,
      tier,
    );

    console.log(
      `[provision-vm] Submitting ARM deployment to ${rgName} (size ${vmSize})...`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const deployRes = await fetch(deployUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { mode: "Incremental", template: armTemplate },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    console.log(
      `[provision-vm] Azure response: status=${deployRes.status} ok=${deployRes.ok}`,
    );

    if (!deployRes.ok) {
      const text = await deployRes.text();
      const isSkuError = text.includes("SkuNotAvailable");
      const errorMsg = isSkuError
        ? `VM size ${vmSize} is not available in ${region}. Try a different region.`
        : text.includes("QuotaExceeded")
          ? `Azure quota exceeded for ${vmSize} in ${region}.`
          : `ARM deployment failed (${deployRes.status}): ${text.slice(0, 400)}`;

      reportError(new Error(errorMsg), {
        step: "arm_deployment",
        clusterId,
        region,
      });
      console.error(`[provision-vm] Deployment rejected: ${errorMsg}`);
      await supabase
        .from("clusters")
        .update({ status: "failed" })
        .eq("id", clusterId);

      return new Response(
        JSON.stringify({ error: errorMsg, skuError: isSkuError }),
        {
          status: isSkuError ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log("[provision-vm] Deployment accepted by Azure");
    await supabase.from("clusters").update({ region }).eq("id", clusterId);

    return new Response(JSON.stringify({ submitted: true, region }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      reportError(err, { step: "timeout", clusterId, region });
      console.error("[provision-vm] ARM deployment timed out (55s)");
      return new Response(
        JSON.stringify({
          error:
            "ARM deployment timed out after 55s. Azure may be slow in this region.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    reportError(err, { step: "top_level", clusterId, region });
    console.error(`[provision-vm] Exception: ${err.message.slice(0, 300)}`);
    return new Response(JSON.stringify({ error: err.message.slice(0, 500) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function buildARMTemplate(
  clusterId: string,
  vmName: string,
  size: string,
  storageGb: number,
  region: string,
  adminKey: string,
  platformUrl: string,
  tier: string,
): Record<string, unknown> {
  const nicName = `${vmName}-nic`;
  const publicIpName = `${vmName}-pip`;
  const nsgName = `${vmName}-nsg`;
  const vnetName = `${vmName}-vnet`;
  const osDiskName = `${vmName}-osdisk`;
  const dataDiskName = `${vmName}-datadisk`;

  const isGpu = tier === "azure_gpu";
  const binaryName = isGpu ? "tellodb-cuda-latest" : "tellodb-latest";

  const bootstrapCmd = `set -e
LOG=/var/log/tellodb-bootstrap.log
exec > >(tee -a $LOG) 2>&1

echo "[1/6] Bootstrap for cluster ${clusterId}"

# Format and mount data disk
if [ -e "/dev/disk/azure/scsi1/lun0" ]; then
  echo "[2/6] Formatting data disk..."
  sudo mkfs.ext4 -F /dev/disk/azure/scsi1/lun0 || true
  echo "[2/6] Mounting data disk..."
  sudo mkdir -p /var/lib/tellodb
  sudo mount /dev/disk/azure/scsi1/lun0 /var/lib/tellodb || true
else
  echo "[2/6] No data disk, using OS disk"
  sudo mkdir -p /var/lib/tellodb
fi

sudo chown -R tellodb:tellodb /var/lib/tellodb 2>/dev/null || true

# Install deps
echo "[3/6] Installing dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq libgomp1 curl
${
  isGpu
    ? `
echo "[3.5/6] Installing NVIDIA drivers..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ubuntu-drivers-common
sudo DEBIAN_FRONTEND=noninteractive ubuntu-drivers autoinstall || true
`
    : ""
}

# Download engine binary
BINARY_URL="\${platformUrl}/api/storage/${binaryName}"
echo "[4/6] Downloading engine binary..."
sudo mkdir -p /usr/local/lib/tellodb
cd /tmp
# Try Supabase Storage first, then fallback URL
curl -sSfL -o tellodb-engine \\
  "https://fnovrnadrvimlvqwecgs.supabase.co/storage/v1/object/public/tellodb-binaries/${binaryName}" \\
  -H "User-Agent: tellodb-bootstrap" || \\
curl -sSfL -o tellodb-engine "$BINARY_URL" || \\
{ echo "[4/6] Binary download failed - will build from source" | tee -a $LOG; BUILD_FROM_SOURCE=1; }

if [ -f tellodb-engine ] && [ -s tellodb-engine ]; then
  sudo mv tellodb-engine /usr/local/bin/tellodb-engine
  sudo chmod +x /usr/local/bin/tellodb-engine
  echo "[4/6] Binary installed: $(file /usr/local/bin/tellodb-engine | head -c 80)"
else
  echo "[4/6] Binary not available - engine not installed"
fi

# Write systemd service
echo "[5/6] Configuring systemd service..."
sudo tee /etc/systemd/system/tellodb.service > /dev/null <<SERVICEEOF
[Unit]
Description=Tellodb Core Engine
After=network.target

[Service]
Type=simple
User=tellodb
WorkingDirectory=/var/lib/tellodb
ExecStart=/usr/local/bin/tellodb-engine
Restart=on-failure
RestartSec=5
Environment=ALETHEIA_API_KEY=${adminKey}
Environment=ALETHEIA_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
Environment=PORT=3000
Environment=ALETHEIA_DATA_DIR=/var/lib/tellodb

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Start engine
if [ -f /usr/local/bin/tellodb-engine ]; then
  sudo systemctl daemon-reload
  sudo systemctl enable tellodb
  sudo systemctl start tellodb
  echo "[5/6] Engine started, waiting for health..."
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
      echo "[5/6] Engine is healthy after \${i}s"
      break
    fi
    sleep 2
  done
fi

# Activate
echo "[6/6] Getting public IP..."
PUBLIC_IP=$(curl -s -H "Metadata:true" "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text" 2>/dev/null)
[ -z "$PUBLIC_IP" ] && PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || curl -s https://api.ipify.org 2>/dev/null || echo "unknown")
echo "[6/6] Activating cluster ${clusterId} with IP $PUBLIC_IP"
ACTIVATE_URL="${platformUrl}/api/clusters/${clusterId}/activate"
ACTIVATE_RESULT=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ACTIVATE_URL" \\
  -H "x-admin-key: ${adminKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"ip_address":"'"$PUBLIC_IP"'"}')
echo "[6/6] Activation result: $ACTIVATE_RESULT"

echo "Bootstrap complete for cluster ${clusterId}"`;

  const encodedScript = btoa(
    new TextEncoder()
      .encode(bootstrapCmd)
      .reduce((s, b) => s + String.fromCharCode(b), ""),
  );

  return {
    $schema:
      "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    parameters: {},
    resources: [
      {
        type: "Microsoft.Network/publicIPAddresses",
        apiVersion: "2023-09-01",
        name: publicIpName,
        location: region,
        sku: { name: "Standard" },
        properties: {
          publicIPAllocationMethod: "Static",
          dnsSettings: { domainNameLabel: vmName.toLowerCase() },
        },
      },
      {
        type: "Microsoft.Network/networkSecurityGroups",
        apiVersion: "2023-09-01",
        name: nsgName,
        location: region,
        properties: {
          securityRules: [
            {
              name: "SSH",
              properties: {
                protocol: "Tcp",
                sourcePortRange: "*",
                destinationPortRange: "22",
                sourceAddressPrefix: "*",
                destinationAddressPrefix: "*",
                access: "Allow",
                priority: 1000,
                direction: "Inbound",
              },
            },
            {
              name: "Engine-API",
              properties: {
                protocol: "Tcp",
                sourcePortRange: "*",
                destinationPortRange: "3000",
                sourceAddressPrefix: "*",
                destinationAddressPrefix: "*",
                access: "Allow",
                priority: 1010,
                direction: "Inbound",
              },
            },
            {
              name: "Tellodb-API",
              properties: {
                protocol: "Tcp",
                sourcePortRange: "*",
                destinationPortRange: "8443",
                sourceAddressPrefix: "*",
                destinationAddressPrefix: "*",
                access: "Allow",
                priority: 1020,
                direction: "Inbound",
              },
            },
          ],
        },
      },
      {
        type: "Microsoft.Network/virtualNetworks",
        apiVersion: "2023-09-01",
        name: vnetName,
        location: region,
        properties: {
          addressSpace: { addressPrefixes: ["10.0.0.0/16"] },
          subnets: [
            {
              name: "default",
              properties: {
                addressPrefix: "10.0.0.0/24",
                networkSecurityGroup: {
                  id: `[resourceId('Microsoft.Network/networkSecurityGroups', '${nsgName}')]`,
                },
              },
            },
          ],
        },
        dependsOn: [nsgName],
      },
      {
        type: "Microsoft.Network/networkInterfaces",
        apiVersion: "2023-09-01",
        name: nicName,
        location: region,
        properties: {
          ipConfigurations: [
            {
              name: "ipconfig1",
              properties: {
                subnet: {
                  id: `[resourceId('Microsoft.Network/virtualNetworks/subnets', '${vnetName}', 'default')]`,
                },
                publicIPAddress: {
                  id: `[resourceId('Microsoft.Network/publicIPAddresses', '${publicIpName}')]`,
                },
              },
            },
          ],
        },
        dependsOn: [vnetName, publicIpName],
      },
      {
        type: "Microsoft.Compute/virtualMachines",
        apiVersion: "2023-09-01",
        name: vmName,
        location: region,
        properties: {
          hardwareProfile: { vmSize: size },
          storageProfile: {
            imageReference: {
              publisher: "Canonical",
              offer: "ubuntu-24_04-lts",
              sku: "server",
              version: "latest",
            },
            osDisk: {
              name: osDiskName,
              createOption: "FromImage",
              managedDisk: { storageAccountType: "Premium_LRS" },
              diskSizeGB: 30,
            },
            dataDisks: [
              {
                name: dataDiskName,
                lun: 0,
                createOption: "Empty",
                diskSizeGB: storageGb,
                managedDisk: { storageAccountType: "Premium_LRS" },
              },
            ],
          },
          osProfile: {
            computerName: vmName,
            adminUsername: "tellodb",
            adminPassword: generatePassword(),
            linuxConfiguration: { disablePasswordAuthentication: false },
          },
          networkProfile: {
            networkInterfaces: [
              {
                id: `[resourceId('Microsoft.Network/networkInterfaces', '${nicName}')]`,
                properties: { primary: true },
              },
            ],
          },
          diagnosticsProfile: { bootDiagnostics: { enabled: false } },
        },
        dependsOn: [nicName],
      },
      {
        type: "Microsoft.Compute/virtualMachines/extensions",
        apiVersion: "2023-09-01",
        name: `${vmName}/bootstrap`,
        location: region,
        properties: {
          publisher: "Microsoft.Azure.Extensions",
          type: "CustomScript",
          typeHandlerVersion: "2.1",
          autoUpgradeMinorVersion: true,
          settings: {
            commandToExecute: `echo ${encodedScript} | base64 -d | bash`,
          },
        },
        dependsOn: [vmName],
      },
    ],
  };
}

function generatePassword(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let p = "Tellodb1!";
  for (let i = 0; i < 20; i++) {
    p += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return p;
}
