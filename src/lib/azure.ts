import type { RequestEventCommon } from "@builder.io/qwik-city";
import { captureError } from "./sentry";

export interface AzureProvisioningStep {
  step: number;
  message: string;
  timestamp: string;
}

export function getProvisioningSteps(
  createdAt: string,
  region: string,
  size: string,
): AzureProvisioningStep[] {
  const start = new Date(createdAt).getTime();
  const elapsed = Math.floor((Date.now() - start) / 1000);

  const steps = [
    {
      elapsed: 0,
      msg: `Authenticating with Azure Resource Manager in ${region}...`,
    },
    { elapsed: 8, msg: `Creating resource group: tellodb-rg-${region}...` },
    { elapsed: 15, msg: `Allocating virtual network and public IP address...` },
    {
      elapsed: 24,
      msg: `Provisioning dedicated VM (${size}) on Azure compute nodes...`,
    },
    {
      elapsed: 38,
      msg: `Bootstrapping VM image & downloading Tellodb engine binary...`,
    },
    {
      elapsed: 48,
      msg: `Initializing SQLite databases and configuring graph/vector namespaces...`,
    },
    {
      elapsed: 55,
      msg: `Performing final health checks and API endpoint routing...`,
    },
  ];

  return steps
    .filter((s) => elapsed >= s.elapsed)
    .map((s, idx) => {
      const stepTime = new Date(start + s.elapsed * 1000);
      return {
        step: idx + 1,
        message: s.msg,
        timestamp: stepTime.toLocaleTimeString(),
      };
    });
}

interface AzureAccessToken {
  token: string;
  expiresOn: number;
}

async function getAzureToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<AzureAccessToken> {
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://management.azure.com/.default",
  });

  const res = await fetch(authUrl, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    token: data.access_token,
    expiresOn: Date.now() + data.expires_in * 1000,
  };
}

async function ensureResourceGroup(
  token: string,
  subscriptionId: string,
  region: string,
): Promise<void> {
  const rgName = `tellodb-rg-${region}`;
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups/${rgName}?api-version=2021-04-01`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ location: region }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create resource group: ${text}`);
  }
}

function buildARMTemplate(
  clusterId: string,
  size: string,
  storageGb: number,
  region: string,
  adminKey: string,
): object {
  const vmName = `tellodb-vm-${clusterId.slice(0, 8)}`;
  const nicName = `${vmName}-nic`;
  const publicIpName = `${vmName}-pip`;
  const nsgName = `${vmName}-nsg`;
  const vnetName = `${vmName}-vnet`;
  const osDiskName = `${vmName}-osdisk`;
  const dataDiskName = `${vmName}-datadisk`;

  return {
    $schema:
      "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    parameters: {},
    variables: {},
    resources: [
      {
        type: "Microsoft.Network/publicIPAddresses",
        apiVersion: "2023-09-01",
        name: publicIpName,
        location: region,
        sku: { name: "Standard" },
        properties: {
          publicIPAllocationMethod: "Static",
          dnsSettings: {
            domainNameLabel: vmName.toLowerCase(),
          },
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
              name: "Tellodb-API",
              properties: {
                protocol: "Tcp",
                sourcePortRange: "*",
                destinationPortRange: "8443",
                sourceAddressPrefix: "*",
                destinationAddressPrefix: "*",
                access: "Allow",
                priority: 1001,
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
              offer: "0001-com-ubuntu-server-jammy",
              sku: "22_04-lts-gen2",
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
            linuxConfiguration: {
              disablePasswordAuthentication: false,
            },
          },
          networkProfile: {
            networkInterfaces: [
              {
                id: `[resourceId('Microsoft.Network/networkInterfaces', '${nicName}')]`,
                properties: { primary: true },
              },
            ],
          },
          diagnosticsProfile: {
            bootDiagnostics: { enabled: false },
          },
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
            commandToExecute: `curl -sSfL "https://tellodb.com/install.sh" | bash -s -- --admin-key "${adminKey}" --cluster-id "${clusterId}" --data-disk "/dev/disk/azure/scsi1/lun0"`,
          },
        },
        dependsOn: [vmName],
      },
    ],
    outputs: {
      vmName: { type: "string", value: vmName },
      publicIP: {
        type: "string",
        value: `[reference(resourceId('Microsoft.Network/publicIPAddresses', '${publicIpName}')).dnsSettings.fqdn]`,
      },
      endpointURL: {
        type: "string",
        value: `[concat('https://', reference(resourceId('Microsoft.Network/publicIPAddresses', '${publicIpName}')).dnsSettings.fqdn, ':8443')]`,
      },
    },
  };
}

function generatePassword(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "Tellodb1!";
  for (let i = 0; i < 20; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Real Azure REST API provisioning client.
 * Single-attempt deployment of a dedicated Azure VM via ARM template.
 */
function getSizeFallbacks(requested: string): string[] {
  const fallbackMap: Record<string, string[]> = {
    Standard_B2als_v2: ["Standard_B2als_v2"],
    Standard_D2as_v5: ["Standard_D2as_v5", "Standard_D2s_v5"],
    Standard_D4as_v5: ["Standard_D4as_v5", "Standard_D4s_v5"],
    Standard_D8as_v5: ["Standard_D8as_v5"],
    Standard_NC4as_T4: ["Standard_NC4as_T4"],
  };
  return fallbackMap[requested] || [requested, "Standard_D2as_v5"];
}

const FALLBACK_REGIONS = ["westus2", "westeurope"];

/**
 * Provisions a single dedicated Azure VM via ARM template for the exact
 * SKU and region requested. No fallback — either the SKU is available
 * or the deployment fails with a clear error.
 */
export async function triggerAzureVMProvisioning(
  env: RequestEventCommon["env"],
  clusterId: string,
  tier: string,
  region: string,
  size: string,
  storageGb: number = 50,
): Promise<{
  success: boolean;
  mode: "real" | "error";
  details?: string;
  endpointUrl?: string;
}> {
  const clientId = env.get("AZURE_CLIENT_ID");
  const clientSecret = env.get("AZURE_CLIENT_SECRET");
  const tenantId = env.get("AZURE_TENANT_ID");
  const subscriptionId = env.get("AZURE_SUBSCRIPTION_ID");
  const adminKey = env.get("TELLODB_ADMIN_KEY") || "";

  if (!clientId || !clientSecret || !tenantId || !subscriptionId) {
    return {
      success: false,
      mode: "error",
      details:
        "Azure credentials not configured. Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, and AZURE_SUBSCRIPTION_ID.",
    };
  }

  try {
    console.log(`[Azure Provisioning] Authenticating with Azure AD...`);
    const { token } = await getAzureToken(tenantId, clientId, clientSecret);

    const rgName = `tellodb-rg-${region}`;
    const deploymentName = `tellodb-vm-deploy-${clusterId}`;
    const deploymentUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups/${rgName}/providers/Microsoft.Resources/deployments/${deploymentName}?api-version=2021-04-01`;

    console.log(`[Azure Provisioning] Ensuring resource group ${rgName}...`);
    await ensureResourceGroup(token, subscriptionId, region);

    const armTemplate = buildARMTemplate(
      clusterId,
      size,
      storageGb,
      region,
      adminKey,
    );

    console.log(
      `[Azure Provisioning] Submitting ARM deployment — VM size ${size}, ${storageGb} GB SSD, region ${region}...`,
    );

    const deployRes = await fetch(deploymentUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          mode: "Incremental",
          template: armTemplate,
        },
      }),
    });

    if (!deployRes.ok) {
      const text = await deployRes.text();
      const isSkuError = text.includes("SkuNotAvailable");
      const message = isSkuError
        ? `VM size ${size} is not available in ${region}. Try a different region or VM size.`
        : `ARM deployment failed (${deployRes.status}). Please check Azure subscription limits.`;
      throw new Error(message);
    }

    const deployData = await deployRes.json();
    const outputs = deployData.properties?.outputs || {};
    const endpointUrl =
      outputs.endpointURL?.value || `https://${clusterId}.vm.tellodb.com:8443`;

    console.log(
      `[Azure Provisioning] Deployment submitted. VM will boot at ${endpointUrl}`,
    );

    return {
      success: true,
      mode: "real",
      details: `ARM deployment ${deploymentName} submitted in ${region}. VM provisioning takes 3-5 minutes.`,
      endpointUrl,
    };
  } catch (err: any) {
    captureError(err, {
      action: "azureVMProvisioning",
      clusterId,
      region,
      size,
    });
    console.error(
      `[Azure Provisioning] Deployment failed for cluster ${clusterId}:`,
      err.message,
    );
    return {
      success: false,
      mode: "error",
      details: err.message,
    };
  }
}
