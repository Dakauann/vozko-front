import type {
  AddonDefinition,
  AddonDefinitionInput,
  AddonPurchasePreview,
  AddonSubscription,
  PurchaseAddonInput,
  WorkspaceEntitlement,
} from "@/lib/workspace-addon/types";
import { apiClient } from "@/lib/api/browser-client";

export async function adminListAddonsAction(includeArchived = false): Promise<{
  addons: AddonDefinition[];
  error?: string | null;
}> {
  const params = new URLSearchParams();
  if (includeArchived) params.set("includeArchived", "true");
  const path = params.size > 0 ? `/admin/addons?${params}` : "/admin/addons";

  const response = await apiClient<AddonDefinition[]>(path, { method: "GET" });
  if (response.error) {
    return { addons: [], error: response.error.message };
  }
  return { addons: response.data ?? [], error: null };
}

export async function adminCreateAddonAction(input: AddonDefinitionInput): Promise<{
  addon: AddonDefinition | null;
  error?: string | null;
}> {
  const response = await apiClient<AddonDefinition>("/admin/addons", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (response.error) {
    return { addon: null, error: response.error.message };
  }
  return { addon: response.data ?? null, error: null };
}

export async function adminUpdateAddonAction(
  addonId: string,
  input: AddonDefinitionInput,
): Promise<{ addon: AddonDefinition | null; error?: string | null }> {
  const response = await apiClient<AddonDefinition>(`/admin/addons/${encodeURIComponent(addonId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (response.error) {
    return { addon: null, error: response.error.message };
  }
  return { addon: response.data ?? null, error: null };
}

export async function adminArchiveAddonAction(addonId: string): Promise<{
  success: boolean;
  error?: string | null;
}> {
  const response = await apiClient<{ status: string }>(
    `/admin/addons/${encodeURIComponent(addonId)}/archive`,
    { method: "PATCH" },
  );
  if (response.error) {
    return { success: false, error: response.error.message };
  }
  return { success: response.data?.status === "archived", error: null };
}

export async function listAvailableAddonsAction(workspaceId: string): Promise<{
  addons: AddonDefinition[];
  error?: string | null;
}> {
  const response = await apiClient<AddonDefinition[]>(
    `/workspaces/${encodeURIComponent(workspaceId)}/addons/available`,
    { method: "GET" },
  );
  if (response.error) {
    return { addons: [], error: response.error.message };
  }
  return { addons: response.data ?? [], error: null };
}

export async function listWorkspaceAddonsAction(workspaceId: string): Promise<{
  subscriptions: AddonSubscription[];
  error?: string | null;
}> {
  const response = await apiClient<AddonSubscription[]>(
    `/workspaces/${encodeURIComponent(workspaceId)}/addons`,
    { method: "GET" },
  );
  if (response.error) {
    return { subscriptions: [], error: response.error.message };
  }
  return { subscriptions: response.data ?? [], error: null };
}

export async function getWorkspaceEntitlementsAction(workspaceId: string): Promise<{
  entitlements: WorkspaceEntitlement[];
  error?: string | null;
}> {
  const response = await apiClient<WorkspaceEntitlement[]>(
    `/workspaces/${encodeURIComponent(workspaceId)}/entitlements`,
    { method: "GET" },
  );
  if (response.error) {
    return { entitlements: [], error: response.error.message };
  }
  return { entitlements: response.data ?? [], error: null };
}

export async function purchaseAddonAction(
  workspaceId: string,
  input: PurchaseAddonInput,
): Promise<{
  subscription: AddonSubscription | null;
  insufficientBalance: boolean;
  error?: string | null;
}> {
  const response = await apiClient<AddonSubscription>(
    `/workspaces/${encodeURIComponent(workspaceId)}/addons`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (response.error) {
    if (response.error.status === 402) {
      return { subscription: null, insufficientBalance: true, error: null };
    }
    return { subscription: null, insufficientBalance: false, error: response.error.message };
  }
  return { subscription: response.data ?? null, insufficientBalance: false, error: null };
}

export async function previewAddonPurchaseAction(
  workspaceId: string,
  input: PurchaseAddonInput,
): Promise<{ preview: AddonPurchasePreview | null; error?: string | null }> {
  const response = await apiClient<AddonPurchasePreview>(
    `/workspaces/${encodeURIComponent(workspaceId)}/addons/preview`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (response.error) {
    return { preview: null, error: response.error.message };
  }
  return { preview: response.data ?? null, error: null };
}

export async function cancelAddonSubscriptionAction(
  workspaceId: string,
  subscriptionId: string,
): Promise<{ subscription: AddonSubscription | null; error?: string | null }> {
  const response = await apiClient<AddonSubscription>(
    `/workspaces/${encodeURIComponent(workspaceId)}/addons/${encodeURIComponent(subscriptionId)}/cancel`,
    { method: "POST" },
  );
  if (response.error) {
    return { subscription: null, error: response.error.message };
  }
  return { subscription: response.data ?? null, error: null };
}
